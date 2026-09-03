import type { Request, Response } from "express";
import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import {
  ChatTurnChunkRepository,
  ChatTurnRepository,
  SessionMessageRepository
} from "../../catalog/sessionChatRepository.js";

const N_201 = 201;
const N_400 = 400;
const N_404 = 404;
const N_500 = 500;

export async function handleListSessionMessages(options: {
  req: Request;
  res: Response;
  messages: SessionMessageRepository;
}): Promise<void> {
  const { req, res, messages } = options;
  const sessionId = String(req.params.sessionId ?? "");
  if (!sessionId.trim()) {
    res.status(N_400).json({ error: "sessionId required" });
    return;
  }
  try {
    const rows = await messages.listBySessionId(sessionId);
    res.json({
      messages: rows.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        turnId: m.turnId,
        createdAt: m.createdAt
      }))
    });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleCreateSessionMessage(options: {
  req: Request;
  res: Response;
  messages: SessionMessageRepository;
}): Promise<void> {
  const { req, res, messages } = options;
  const sessionId = String(req.params.sessionId ?? "");
  const role = typeof req.body?.role === "string" ? req.body.role : "";
  const parts = Array.isArray(req.body?.parts)
    ? (req.body.parts as unknown[])
    : null;
  const turnId = typeof req.body?.turnId === "string" ? req.body.turnId : null;
  if (!sessionId.trim() || !role || !parts) {
    res.status(N_400).json({ error: "sessionId, role, and parts required" });
    return;
  }
  if (!["user", "assistant", "system", "tool"].includes(role)) {
    res.status(N_400).json({ error: "invalid role" });
    return;
  }
  try {
    const created = await messages.create({
      sessionId,
      role: role as "user" | "assistant" | "system" | "tool",
      parts,
      turnId
    });
    res.status(N_201).json(created);
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handlePatchMessageParts(options: {
  req: Request;
  res: Response;
  messages: SessionMessageRepository;
}): Promise<void> {
  const { req, res, messages } = options;
  const id = String(req.params.id ?? "");
  const parts = Array.isArray(req.body?.parts)
    ? (req.body.parts as unknown[])
    : null;
  if (!id || !parts) {
    res.status(N_400).json({ error: "id and parts required" });
    return;
  }
  try {
    const updated = await messages.updateParts(id, parts);
    if (!updated) {
      res.status(N_404).json({ error: "message not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleGetTurn(options: {
  req: Request;
  res: Response;
  turns: ChatTurnRepository;
}): Promise<void> {
  const { req, res, turns } = options;
  const turnId = String(req.params.turnId ?? "");
  try {
    const turn = await turns.getById(turnId);
    if (!turn) {
      res.status(N_404).json({ error: "turn not found" });
      return;
    }
    res.json(turn);
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleCreateTurn(options: {
  req: Request;
  res: Response;
  turns: ChatTurnRepository;
}): Promise<void> {
  const { req, res, turns } = options;
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const workflowId =
    typeof req.body?.workflowId === "string" ? req.body.workflowId : "";
  const id = typeof req.body?.id === "string" ? req.body.id : undefined;
  if (!sessionId.trim() || !workflowId.trim()) {
    res.status(N_400).json({ error: "sessionId and workflowId required" });
    return;
  }
  try {
    const turn = await turns.create({
      id,
      sessionId,
      workflowId,
      mode: typeof req.body?.mode === "string" ? req.body.mode : "build",
      provider:
        typeof req.body?.provider === "string" ? req.body.provider : null,
      model: typeof req.body?.model === "string" ? req.body.model : null
    });
    res.status(N_201).json(turn);
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleFinishTurn(options: {
  req: Request;
  res: Response;
  turns: ChatTurnRepository;
}): Promise<void> {
  const { req, res, turns } = options;
  const turnId = String(req.params.turnId ?? "");
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  if (!["completed", "cancelled", "failed"].includes(status)) {
    res
      .status(N_400)
      .json({ error: "status must be completed|cancelled|failed" });
    return;
  }
  try {
    const turn = await turns.finish({
      id: turnId,
      status: status as "completed" | "cancelled" | "failed",
      error: typeof req.body?.error === "string" ? req.body.error : null
    });
    if (!turn) {
      res.status(N_404).json({ error: "turn not found" });
      return;
    }
    try {
      const features = new ChatFeatureRepository();
      const card = await features.getBySessionId(turn.sessionId);
      if (card) await features.updateLastActivity(card.id);
    } catch (err) {
      console.warn(
        `[chat] last activity after turn finish failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    res.json(turn);
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleAppendChunk(options: {
  req: Request;
  res: Response;
  chunks: ChatTurnChunkRepository;
}): Promise<void> {
  const { req, res, chunks } = options;
  const turnId = String(req.params.turnId ?? "");
  const eventType =
    typeof req.body?.eventType === "string" ? req.body.eventType : "";
  const payload =
    req.body?.payload !== undefined &&
    typeof req.body.payload === "object" &&
    req.body.payload !== null
      ? (req.body.payload as Record<string, unknown>)
      : {};
  if (!turnId || !eventType) {
    res.status(N_400).json({ error: "turnId and eventType required" });
    return;
  }
  try {
    const chunk = await chunks.append({ turnId, eventType, payload });
    res.status(N_201).json(chunk);
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleListChunks(options: {
  req: Request;
  res: Response;
  chunks: ChatTurnChunkRepository;
}): Promise<void> {
  const { req, res, chunks } = options;
  const turnId = String(req.params.turnId ?? "");
  const afterSeq = Number(req.query.afterSeq ?? 0);
  try {
    const rows = await chunks.listAfter(
      turnId,
      Number.isFinite(afterSeq) ? afterSeq : 0
    );
    res.json({ chunks: rows });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
