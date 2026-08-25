import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import {
  ChatFeatureValidationError,
  SINGLE_LEVEL_PARENT_ERROR,
  assertValidChatFeatureType
} from "../../projects/chatFeatureService.js";
import {
  validateDescriptionDocument,
  DescriptionValidationError
} from "../../catalog/descriptionDocument.js";
import { destroySessionSandbox } from "../../projects/sessionSandbox.js";
import {
  chatFeatureService,
  chatRepo,
  param,
  projectRepo,
  valuesEqual,
  VALID_PRIORITIES,
  VALID_STATUSES,
  writeHistory
} from "./shared.js";

const N_204 = 204;
const N_400 = 400;
const N_404 = 404;

function parsePatchValidationError(body: {
  status?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  type?: unknown;
  description?: unknown;
}):
  | {
      ok: true;
      normalizedDescription?: ReturnType<typeof validateDescriptionDocument>;
    }
  | { ok: false; message: string } {
  const { status, priority, dueDate, type, description } = body;
  if (status !== undefined && !VALID_STATUSES.includes(status as string)) {
    return {
      ok: false,
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
    };
  }
  if (
    priority !== undefined &&
    !VALID_PRIORITIES.includes(priority as string)
  ) {
    return {
      ok: false,
      message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}`
    };
  }
  if (
    dueDate !== undefined &&
    dueDate !== null &&
    Number.isNaN(Date.parse(dueDate as string))
  ) {
    return { ok: false, message: "Invalid dueDate" };
  }
  if (type !== undefined) {
    try {
      assertValidChatFeatureType(type as string);
    } catch (error: unknown) {
      if (error instanceof ChatFeatureValidationError) {
        return { ok: false, message: error.message };
      }
      throw error;
    }
  }
  let normalizedDescription:
    | ReturnType<typeof validateDescriptionDocument>
    | undefined;
  if (description !== undefined) {
    try {
      normalizedDescription = validateDescriptionDocument(description);
    } catch (error: unknown) {
      if (error instanceof DescriptionValidationError) {
        return { ok: false, message: error.message };
      }
      throw error;
    }
  }
  return { ok: true, normalizedDescription };
}

function buildPatchUpdates(options: {
  chat: NonNullable<Awaited<ReturnType<typeof chatRepo.getById>>>;
  body: Record<string, unknown>;
  normalizedDescription?: ReturnType<typeof validateDescriptionDocument>;
}): {
  updates: Record<string, unknown>;
  historyWrites: Array<{ field: string; from: unknown; to: unknown }>;
} {
  const chat = options.chat;
  const { status, order, title, priority, dueDate, type, parentId } =
    options.body;
  const updates: Record<string, unknown> = {};
  const historyWrites: Array<{ field: string; from: unknown; to: unknown }> =
    [];
  const track = (entry: { field: string; from: unknown; to: unknown }) => {
    if (!valuesEqual(entry.from, entry.to)) historyWrites.push(entry);
  };
  if (status !== undefined) {
    updates.status = status;
    track({ field: "status", from: chat.status, to: status });
  }
  if (order !== undefined) updates.order = order;
  if (title !== undefined) {
    updates.title = title;
    track({ field: "title", from: chat.title, to: title });
  }
  if (priority !== undefined) {
    updates.priority = priority;
    track({ field: "priority", from: chat.priority, to: priority });
  }
  if (dueDate !== undefined) {
    const nextDue = dueDate === null ? null : new Date(dueDate as string);
    updates.dueDate = nextDue;
    track({ field: "dueDate", from: chat.dueDate, to: nextDue });
  }
  if (type !== undefined) {
    updates.type = type;
    track({ field: "type", from: chat.type, to: type });
  }
  if (parentId !== undefined) {
    updates.parentId = parentId;
    track({ field: "parent", from: chat.parentId, to: parentId });
  }
  if (options.normalizedDescription !== undefined) {
    updates.description = options.normalizedDescription;
    track({
      field: "description",
      from: chat.description,
      to: options.normalizedDescription
    });
  }
  return { updates, historyWrites };
}

async function applyDoneCascade(options: {
  projectId: string;
  chatId: string;
  userId: string;
  parentId: string | null;
  status: unknown;
  oldStatus: string;
}): Promise<void> {
  if (
    typeof options.status !== "string" ||
    options.status !== "done" ||
    options.oldStatus === "done" ||
    options.parentId
  ) {
    return;
  }
  const siblings = await chatRepo.listByProjectId(options.projectId);
  const openChildren = siblings.filter(
    (c) => c.parentId === options.chatId && c.status !== "done"
  );
  for (const child of openChildren) {
    const prev = child.status;
    await chatRepo.update({ ...child, status: "done", id: child.id });
    await writeHistory({
      chatFeatureId: child.id,
      userId: options.userId,
      field: "status",
      from: prev,
      to: "done"
    });
  }
}

async function applyPatchUpdates(options: {
  projectId: string;
  chatId: string;
  userId: string;
  chat: NonNullable<Awaited<ReturnType<typeof chatRepo.getById>>>;
  body: Record<string, unknown>;
  normalizedDescription?: ReturnType<typeof validateDescriptionDocument>;
}): Promise<void> {
  const parentId = options.body.parentId;
  if (parentId !== undefined && parentId !== null) {
    await chatFeatureService.assertSingleLevelParent({
      projectId: options.projectId,
      chatId: options.chatId,
      parentId: String(parentId)
    });
  }
  const oldStatus = options.chat.status;
  const { updates, historyWrites } = buildPatchUpdates({
    chat: options.chat,
    body: options.body,
    normalizedDescription: options.normalizedDescription
  });
  await chatRepo.update({ ...options.chat, ...updates, id: options.chatId });
  await chatRepo.updateLastActivity(options.chatId);
  await projectRepo.updateLastActivity(options.projectId);
  for (const entry of historyWrites) {
    await writeHistory({
      chatFeatureId: options.chatId,
      userId: options.userId,
      field: entry.field,
      from: entry.from,
      to: entry.to
    });
  }
  await applyDoneCascade({
    projectId: options.projectId,
    chatId: options.chatId,
    userId: options.userId,
    parentId: options.chat.parentId,
    status: options.body.status,
    oldStatus
  });
}

export async function handlePatchChat(
  req: Request,
  res: Response
): Promise<void> {
  const projectId = param(req.params.projectId);
  const chatId = param(req.params.chatId);
  const userId = (req as AuthedRequest).forgeUser.id;
  const body = req.body as Record<string, unknown>;
  const validation = parsePatchValidationError(body);
  if (!validation.ok) {
    res.status(N_400).json({ error: validation.message });
    return;
  }
  try {
    const chat = await chatRepo.getById(chatId);
    if (!chat || chat.projectId !== projectId || chat.userId !== userId) {
      res.status(N_404).json({ error: "Chat not found" });
      return;
    }
    await applyPatchUpdates({
      projectId,
      chatId,
      userId,
      chat,
      body,
      normalizedDescription: validation.normalizedDescription
    });
    res.json(await chatRepo.getById(chatId));
  } catch (error: unknown) {
    if (error instanceof ChatFeatureValidationError) {
      res.status(N_400).json({
        error:
          error.message === SINGLE_LEVEL_PARENT_ERROR
            ? SINGLE_LEVEL_PARENT_ERROR
            : error.message
      });
      return;
    }
    res.status(N_400).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function handleDeleteChat(
  req: Request,
  res: Response
): Promise<void> {
  const projectId = param(req.params.projectId);
  const chatId = param(req.params.chatId);
  const userId = (req as AuthedRequest).forgeUser.id;
  try {
    const chat = await chatRepo.getById(chatId);
    if (!chat || chat.projectId !== projectId || chat.userId !== userId) {
      res.status(N_404).json({ error: "Chat not found" });
      return;
    }
    await chatRepo.deleteChatFeature(chatId);
    void destroySessionSandbox(chat.sessionId).catch((err) => {
      console.warn(
        `[chat ${chatId}] sandbox teardown failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });
    res.status(N_204).end();
  } catch (error: unknown) {
    res
      .status(N_400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
}
