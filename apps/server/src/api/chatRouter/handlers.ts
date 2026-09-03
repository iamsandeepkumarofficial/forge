import type { AgentMode } from "@forge/core";
import { parseAgentMode } from "@forge/core";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import type { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import type {
  ChatTurnChunkRepository,
  ChatTurnRepository,
  SessionMessageRepository
} from "../../catalog/sessionChatRepository.js";
import {
  cancelInteractiveChatTurn,
  isInteractiveChatTurnRunning,
  newTurnId,
  startInteractiveChatTurn
} from "../../orchestration/chatTemporalClient.js";

const N_202 = 202;
const N_250 = 250;
const N_400 = 400;
const N_404 = 404;
const N_409 = 409;
const N_500 = 500;
const N_503 = 503;

export async function handleListChatMessages(options: {
  req: Request;
  res: Response;
  features: ChatFeatureRepository;
  messages: SessionMessageRepository;
}): Promise<void> {
  const { req, res, features, messages } = options;
  const sessionId = String(req.params.sessionId ?? "");
  const userId = (req as AuthedRequest).forgeUser.id;
  try {
    const card = await features.getBySessionId(sessionId);
    if (card && card.userId !== userId) {
      res.status(N_404).json({ error: "session not found" });
      return;
    }
    const rows = await messages.listBySessionId(sessionId);
    res.json({
      messages: rows.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        createdAt: m.createdAt
      }))
    });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

function parseChatBody(body: Record<string, unknown> | undefined): {
  text: string;
  mode: AgentMode;
  provider: "openai" | "anthropic" | "openai-compatible";
  model: string | undefined;
  reasoningEffort: "low" | "medium" | "high" | undefined;
} {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const mode = parseAgentMode(body?.mode) ?? "agent";
  const providerRaw =
    typeof body?.provider === "string"
      ? body.provider.toLowerCase()
      : "openai-compatible";
  const provider =
    providerRaw === "openai" || providerRaw === "anthropic"
      ? providerRaw
      : "openai-compatible";
  const model =
    typeof body?.model === "string" && body.model.trim()
      ? body.model.trim()
      : undefined;
  const reasoningEffortRaw =
    typeof body?.reasoningEffort === "string"
      ? body.reasoningEffort
      : undefined;
  const reasoningEffort =
    reasoningEffortRaw === "low" ||
    reasoningEffortRaw === "medium" ||
    reasoningEffortRaw === "high"
      ? reasoningEffortRaw
      : undefined;
  return { text, mode, provider, model, reasoningEffort };
}

async function launchTurn(options: {
  sessionId: string;
  text: string;
  mode: AgentMode;
  provider: "openai" | "anthropic" | "openai-compatible";
  model: string | undefined;
  reasoningEffort: "low" | "medium" | "high" | undefined;
  card: { id: string } | null;
  features: ChatFeatureRepository;
  turns: ChatTurnRepository;
}): Promise<{ turnId: string; workflowId: string }> {
  const turnId = newTurnId();
  const workflowId = `chat-${options.sessionId}-${turnId}`;
  await options.turns.create({
    id: turnId,
    sessionId: options.sessionId,
    workflowId,
    mode: options.mode,
    provider: options.provider,
    model: options.model ?? null
  });
  if (options.card) {
    void options.features.updateLastActivity(options.card.id).catch((err) => {
      console.warn(
        `[chat] last activity update failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  }
  try {
    await startInteractiveChatTurn({
      sessionId: options.sessionId,
      turnId,
      userText: options.text,
      mode: options.mode,
      provider: options.provider,
      model: options.model,
      reasoningEffort: options.reasoningEffort
    });
  } catch (err) {
    await options.turns.finish({
      id: turnId,
      status: "failed",
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
  return { turnId, workflowId };
}

/** Drop stale DB "running" rows when Temporal no longer has the workflow. */
async function reconcileRunningTurn(
  turns: ChatTurnRepository,
  sessionId: string
): Promise<{ id: string; workflowId: string } | null> {
  const running = await turns.getRunningBySessionId(sessionId);
  if (!running) return null;
  const stillRunning = await isInteractiveChatTurnRunning(running.workflowId);
  if (stillRunning) {
    return { id: running.id, workflowId: running.workflowId };
  }
  await turns.finish({
    id: running.id,
    status: "failed",
    error: "reconciled: temporal workflow no longer running"
  });
  return null;
}

export async function handleGetRunningTurn(options: {
  req: Request;
  res: Response;
  features: ChatFeatureRepository;
  turns: ChatTurnRepository;
}): Promise<void> {
  const { req, res, features, turns } = options;
  const sessionId = String(req.params.sessionId ?? "");
  const userId = (req as AuthedRequest).forgeUser.id;
  try {
    const card = await features.getBySessionId(sessionId);
    if (card && card.userId !== userId) {
      res.status(N_404).json({ error: "session not found" });
      return;
    }
    const turn = await reconcileRunningTurn(turns, sessionId);
    res.json({
      turn: turn
        ? { id: turn.id, workflowId: turn.workflowId, status: "running" }
        : null
    });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleStartChat(options: {
  req: Request;
  res: Response;
  features: ChatFeatureRepository;
  turns: ChatTurnRepository;
}): Promise<void> {
  const { req, res, features, turns } = options;
  const sessionId = String(req.params.sessionId ?? "");
  const userId = (req as AuthedRequest).forgeUser.id;
  const parsed = parseChatBody(req.body as Record<string, unknown> | undefined);
  if (!parsed.text) {
    res.status(N_400).json({ error: "text required" });
    return;
  }
  try {
    const card = await features.getBySessionId(sessionId);
    if (card && card.userId !== userId) {
      res.status(N_404).json({ error: "session not found" });
      return;
    }
    const running = await reconcileRunningTurn(turns, sessionId);
    if (running) {
      res.status(N_409).json({
        error: "A turn is already running for this session",
        turnId: running.id,
        workflowId: running.workflowId
      });
      return;
    }
    const { turnId, workflowId } = await launchTurn({
      sessionId,
      ...parsed,
      card,
      features,
      turns
    });
    res.status(N_202).json({
      turnId,
      workflowId,
      streamUrl: `/api/sessions/${encodeURIComponent(sessionId)}/turns/${turnId}/stream`
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const unreachable =
      /Connection refused|ECONNREFUSED|tcp connect error/i.test(message);
    res.status(unreachable ? N_503 : N_500).json({
      error: unreachable
        ? `Temporal unreachable at ${process.env.TEMPORAL_ADDRESS || "localhost:7233"}. Start with: pnpm temporal:dev`
        : message
    });
  }
}

async function writeTurnStream(options: {
  req: Request;
  res: Response;
  turnId: string;
  afterSeq: number;
  turns: ChatTurnRepository;
  chunks: ChatTurnChunkRepository;
}): Promise<void> {
  const { req, res, turnId, turns, chunks } = options;
  let afterSeq = options.afterSeq;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  let closed = false;
  req.on("close", () => {
    closed = true;
  });
  const writeEvent = (event: {
    seq: number;
    eventType: string;
    payload: unknown;
  }) => {
    res.write(`id: ${event.seq}\n`);
    res.write(`event: ${event.eventType}\n`);
    res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
  };
  while (!closed) {
    const batch = await chunks.listAfter(turnId, afterSeq);
    for (const c of batch) {
      afterSeq = c.seq;
      writeEvent({
        seq: c.seq,
        eventType: c.eventType,
        payload: c.payload
      });
    }
    const latest = await turns.getById(turnId);
    if (!latest) break;
    if (latest.status !== "running") {
      writeEvent({
        seq: afterSeq + 1,
        eventType: "turn_status",
        payload: {
          status: latest.status,
          error: latest.error
        }
      });
      break;
    }
    await new Promise((r) => setTimeout(r, N_250));
  }
  res.end();
}

export async function handleStreamTurn(options: {
  req: Request;
  res: Response;
  features: ChatFeatureRepository;
  turns: ChatTurnRepository;
  chunks: ChatTurnChunkRepository;
}): Promise<void> {
  const { req, res, features, turns, chunks } = options;
  const sessionId = String(req.params.sessionId ?? "");
  const turnId = String(req.params.turnId ?? "");
  const userId = (req as AuthedRequest).forgeUser.id;
  const lastEventIdHeader = req.headers["last-event-id"];
  let afterSeq = Number(
    typeof lastEventIdHeader === "string" && lastEventIdHeader.trim()
      ? lastEventIdHeader
      : (req.query.afterSeq ?? 0)
  );
  if (!Number.isFinite(afterSeq) || afterSeq < 0) afterSeq = 0;
  try {
    const card = await features.getBySessionId(sessionId);
    if (card && card.userId !== userId) {
      res.status(N_404).json({ error: "session not found" });
      return;
    }
    const turn = await turns.getById(turnId);
    if (!turn || turn.sessionId !== sessionId) {
      res.status(N_404).json({ error: "turn not found" });
      return;
    }
    await writeTurnStream({ req, res, turnId, afterSeq, turns, chunks });
  } catch (err) {
    if (!res.headersSent) {
      res
        .status(N_500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    } else {
      res.end();
    }
  }
}

export async function handleCancelTurn(options: {
  req: Request;
  res: Response;
  features: ChatFeatureRepository;
  turns: ChatTurnRepository;
}): Promise<void> {
  const { req, res, features, turns } = options;
  const sessionId = String(req.params.sessionId ?? "");
  const turnId = String(req.params.turnId ?? "");
  const userId = (req as AuthedRequest).forgeUser.id;
  try {
    const card = await features.getBySessionId(sessionId);
    if (card && card.userId !== userId) {
      res.status(N_404).json({ error: "session not found" });
      return;
    }
    const turn = await turns.getById(turnId);
    if (!turn || turn.sessionId !== sessionId) {
      res.status(N_404).json({ error: "turn not found" });
      return;
    }
    if (turn.status === "running") {
      try {
        await cancelInteractiveChatTurn(turn.workflowId);
      } catch (err) {
        console.warn(
          `[chat] cancel workflow failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await turns.finish({ id: turnId, status: "cancelled" });
    }
    res.json({ ok: true, status: "cancelled" });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
