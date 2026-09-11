import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import type { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import type { SessionMessageRepository } from "../../catalog/sessionChatRepository.js";

const N_400 = 400;
const N_404 = 404;
const N_409 = 409;
const N_500 = 500;

function sameOwnerScope(
  source: {
    userId: string;
    projectId: string | null;
    workspaceId: string | null;
  },
  target: {
    userId: string;
    projectId: string | null;
    workspaceId: string | null;
  }
): boolean {
  if (source.userId !== target.userId) return false;
  if (source.workspaceId && target.workspaceId) {
    return source.workspaceId === target.workspaceId;
  }
  if (source.projectId && target.projectId) {
    return source.projectId === target.projectId;
  }
  return false;
}

export async function handleDeleteMessagesFrom(options: {
  req: Request;
  res: Response;
  features: ChatFeatureRepository;
  messages: SessionMessageRepository;
  restoreFromTurn?: (input: {
    sessionId: string;
    turnId: string | null;
  }) => Promise<{ workspaceRestored: boolean }>;
}): Promise<void> {
  const { req, res, features, messages } = options;
  const sessionId = String(req.params.sessionId ?? "");
  const messageId = String(req.params.messageId ?? "");
  const userId = (req as AuthedRequest).forgeUser.id;
  if (!sessionId.trim() || !messageId.trim()) {
    res.status(N_400).json({ error: "sessionId and messageId required" });
    return;
  }
  try {
    const card = await features.getBySessionId(sessionId);
    if (card && card.userId !== userId) {
      res.status(N_404).json({ error: "session not found" });
      return;
    }
    const live = await messages.listBySessionId(sessionId);
    const target = live.find((row) => row.id === messageId);
    if (!target) {
      res.status(N_404).json({ error: "message not found" });
      return;
    }
    const restoreFromTurn =
      options.restoreFromTurn ??
      (await import("../../projects/workspaceCheckpoint.js"))
        .restoreSessionWorkspaceFromTurn;
    const { workspaceRestored } = await restoreFromTurn({
      sessionId,
      turnId: target.turnId
    });
    const deleted = await messages.deleteFromMessage(sessionId, messageId);
    if (deleted === 0) {
      res.status(N_404).json({ error: "message not found" });
      return;
    }
    res.json({ deleted, workspaceRestored });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleBranchSessionMessages(options: {
  req: Request;
  res: Response;
  features: ChatFeatureRepository;
  messages: SessionMessageRepository;
}): Promise<void> {
  const { req, res, features, messages } = options;
  const sourceSessionId = String(req.params.sessionId ?? "");
  const body = (req.body ?? {}) as Record<string, unknown>;
  const untilMessageId =
    typeof body.untilMessageId === "string" ? body.untilMessageId.trim() : "";
  const targetSessionId =
    typeof body.targetSessionId === "string" ? body.targetSessionId.trim() : "";
  const userId = (req as AuthedRequest).forgeUser.id;
  if (!sourceSessionId.trim() || !untilMessageId || !targetSessionId) {
    res.status(N_400).json({
      error: "sessionId, untilMessageId, and targetSessionId required"
    });
    return;
  }
  try {
    const source = await features.getBySessionId(sourceSessionId);
    const target = await features.getBySessionId(targetSessionId);
    if (!source || source.userId !== userId) {
      res.status(N_404).json({ error: "session not found" });
      return;
    }
    if (!target || target.userId !== userId) {
      res.status(N_404).json({ error: "target session not found" });
      return;
    }
    if (!sameOwnerScope(source, target)) {
      res.status(N_400).json({ error: "cannot branch across projects" });
      return;
    }
    const existing = await messages.listBySessionId(targetSessionId);
    if (existing.length > 0) {
      res.status(N_409).json({ error: "target session already has messages" });
      return;
    }
    const copied = await messages.copyUntil({
      sourceSessionId,
      targetSessionId,
      untilMessageId
    });
    if (copied === 0) {
      res.status(N_404).json({ error: "message not found" });
      return;
    }
    res.json({ copied });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
