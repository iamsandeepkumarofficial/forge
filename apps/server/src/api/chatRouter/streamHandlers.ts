import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import type { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import type {
  ChatTurnChunkRepository,
  ChatTurnRepository
} from "../../catalog/sessionChatRepository.js";
import { cancelInteractiveChatTurn } from "../../orchestration/chatTemporalClient.js";

const N_250 = 250;
const N_404 = 404;
const N_500 = 500;

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
