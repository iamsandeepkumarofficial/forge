import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import type { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import type { ChatTurnRepository } from "../../catalog/sessionChatRepository.js";

const N_400 = 400;
const N_404 = 404;
const N_500 = 500;

export async function handleTurnAnswer(options: {
  req: Request;
  res: Response;
  features: ChatFeatureRepository;
  turns: ChatTurnRepository;
}): Promise<void> {
  const { req, res, features, turns } = options;
  const sessionId = String(req.params.sessionId ?? "");
  const turnId = String(req.params.turnId ?? "");
  const userId = (req as AuthedRequest).forgeUser.id;
  const body = req.body as Record<string, unknown> | undefined;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const taskId = typeof body?.taskId === "string" ? body.taskId : undefined;
  const decision =
    body?.decision === "approve" ||
    body?.decision === "reject" ||
    body?.decision === "skip"
      ? body.decision
      : undefined;
  const hasPayload = body !== undefined && "payload" in body;
  if (!text && !hasPayload) {
    res.status(N_400).json({ error: "text or payload required" });
    return;
  }
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
    const { Client, Connection } = await import("@temporalio/client");
    const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";
    const connection = await Connection.connect({ address });
    const client = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || "default"
    });
    await client.workflow.getHandle(turn.workflowId).signal("userAnswer", {
      ...(text ? { text } : {}),
      ...(taskId ? { taskId } : {}),
      ...(decision ? { decision } : {}),
      ...(hasPayload ? { payload: body?.payload } : {})
    });
    res.json({ ok: true });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
