import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import {
  ChatFeatureValidationError,
  assertValidChatFeatureType
} from "../../projects/chatFeatureService.js";
import {
  validateDescriptionDocument,
  DescriptionValidationError
} from "../../catalog/descriptionDocument.js";
import { provisionSessionSandbox } from "../../projects/sessionSandbox.js";
import { finalizeSessionProvision } from "../../projects/sessionProvision.js";
import {
  assertCloudSandboxAvailable,
  readExecutionTarget
} from "../executionTarget.js";
import {
  chatFeatureService,
  chatRepo,
  param,
  projectRepo,
  VALID_PRIORITIES
} from "./shared.js";

const N_201 = 201;
const N_400 = 400;
const N_404 = 404;
const N_409 = 409;

function normalizeCreateDescription(
  description: unknown
):
  | { ok: true; description: ReturnType<typeof validateDescriptionDocument> }
  | { ok: false; message: string } {
  if (description === undefined || description === null) {
    return { ok: true, description: null };
  }
  if (typeof description === "string") {
    const text = description.trim();
    return {
      ok: true,
      description: text
        ? {
            version: 1,
            blocks: [{ type: "text", content: [{ text }] }]
          }
        : null
    };
  }
  try {
    return { ok: true, description: validateDescriptionDocument(description) };
  } catch (error: unknown) {
    if (error instanceof DescriptionValidationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

function validateCreateBody(body: {
  type?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  description?: unknown;
}):
  | {
      ok: true;
      description: ReturnType<typeof validateDescriptionDocument>;
    }
  | { ok: false; message: string } {
  if (body.type !== undefined) {
    try {
      assertValidChatFeatureType(body.type as string);
    } catch (error: unknown) {
      if (error instanceof ChatFeatureValidationError) {
        return { ok: false, message: error.message };
      }
      throw error;
    }
  }
  if (
    body.priority !== undefined &&
    !VALID_PRIORITIES.includes(body.priority as string)
  ) {
    return {
      ok: false,
      message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}`
    };
  }
  if (
    body.dueDate !== undefined &&
    body.dueDate !== null &&
    Number.isNaN(Date.parse(body.dueDate as string))
  ) {
    return { ok: false, message: "Invalid dueDate" };
  }
  return normalizeCreateDescription(body.description);
}

export async function handleCreateChat(
  req: Request,
  res: Response
): Promise<void> {
  const projectId = param(req.params.projectId);
  const userId = (req as AuthedRequest).forgeUser.id;
  const { title, type, parentId, priority, dueDate, description, workflowId } =
    req.body;
  const executionTarget = readExecutionTarget(req.body);
  const validation = validateCreateBody({
    type,
    priority,
    dueDate,
    description
  });
  if (!validation.ok) {
    res.status(N_400).json({ error: validation.message });
    return;
  }
  try {
    await assertCloudSandboxAvailable(executionTarget);
    const project = await projectRepo.getById(projectId);
    if (!project) {
      res.status(N_404).json({ error: "Project not found" });
      return;
    }
    const chat = await chatFeatureService.create({
      projectId,
      userId,
      title,
      type,
      parentId,
      priority,
      dueDate:
        dueDate === undefined
          ? undefined
          : dueDate === null
            ? null
            : new Date(dueDate),
      description: validation.description,
      workflowId: typeof workflowId === "string" ? workflowId : undefined,
      executionTarget
    });
    void provisionSessionSandbox(chat.sessionId)
      .then(() => finalizeSessionProvision(chat.sessionId))
      .catch((err) => {
        console.warn(
          `[chat ${chat.id}] sandbox provisioning failed (will retry on open): ${err instanceof Error ? err.message : String(err)}`
        );
      });
    res.json(chat);
  } catch (error: unknown) {
    if (error instanceof ChatFeatureValidationError) {
      res.status(N_400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already")) {
      res.status(N_409).json({ error: message });
      return;
    }
    res.status(N_400).json({ error: message });
  }
}

export async function handleGetChat(
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
    res.json(chat);
  } catch (error: unknown) {
    res
      .status(N_400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function handleCreateWorkbench(
  req: Request,
  res: Response
): Promise<void> {
  const projectId = param(req.params.projectId);
  const userId = (req as AuthedRequest).forgeUser.id;
  const title =
    typeof req.body?.title === "string" ? req.body.title : undefined;
  const executionTarget = readExecutionTarget(req.body);
  try {
    await assertCloudSandboxAvailable(executionTarget);
    const project = await projectRepo.getById(projectId);
    if (!project) {
      res.status(N_404).json({ error: "Project not found" });
      return;
    }
    const session = await chatFeatureService.createWorkbench({
      projectId,
      userId,
      title,
      executionTarget
    });
    void provisionSessionSandbox(session.sessionId)
      .then(() => finalizeSessionProvision(session.sessionId))
      .catch((err) => {
        console.warn(
          `[workbench ${session.id}] sandbox provisioning failed (will retry on open): ${err instanceof Error ? err.message : String(err)}`
        );
      });
    res.status(N_201).json(session);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already")) {
      res.status(N_409).json({ error: message });
      return;
    }
    res.status(N_400).json({ error: message });
  }
}
