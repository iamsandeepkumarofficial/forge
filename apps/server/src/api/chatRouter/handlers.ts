import type { AgentMode } from "@forge/core";
import { parseAgentMode } from "@forge/core";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import type { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import type {
  ChatTurnRepository,
  SessionMessageRepository
} from "../../catalog/sessionChatRepository.js";
import {
  isInteractiveChatTurnRunning,
  newTurnId,
  startInteractiveAgentWorkflow,
  startInteractiveChatTurn
} from "../../orchestration/chatTemporalClient.js";
import { WorkflowPlanRepository } from "../../catalog/workflowPlanRepository.js";
import { planJsonWithLiveTasks } from "./planHandlers.js";

export {
  handleBranchSessionMessages,
  handleDeleteMessagesFrom
} from "./sessionCopyHandlers.js";
export { handleGetCurrentPlan } from "./planHandlers.js";
export { handleStreamTurn, handleCancelTurn } from "./streamHandlers.js";
export { handleTurnAnswer } from "./turnAnswer.js";

const N_202 = 202;
const N_400 = 400;
const N_404 = 404;
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
  forceSend: boolean;
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
  const forceSend = body?.forceSend === true;
  return { text, mode, provider, model, reasoningEffort, forceSend };
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
  const useAgentWorkflow = options.mode !== "ask";
  const workflowId = useAgentWorkflow
    ? `agent-${options.sessionId}-${turnId}`
    : `chat-${options.sessionId}-${turnId}`;
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
    const startOpts = {
      sessionId: options.sessionId,
      turnId,
      userText: options.text,
      mode: options.mode,
      provider: options.provider,
      model: options.model,
      reasoningEffort: options.reasoningEffort
    };
    if (useAgentWorkflow) {
      await startInteractiveAgentWorkflow({
        ...startOpts,
        maxConcurrency: 4
      });
    } else {
      await startInteractiveChatTurn(startOpts);
    }
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
    let plan: unknown = null;
    const plans = new WorkflowPlanRepository();
    if (turn) {
      const row = await plans.getByTurnId(turn.id);
      if (row) plan = await planJsonWithLiveTasks(plans, row);
    } else {
      const current = await plans.getCurrentBySessionId(sessionId);
      if (current) plan = await planJsonWithLiveTasks(plans, current);
    }
    res.json({
      turn: turn
        ? { id: turn.id, workflowId: turn.workflowId, status: "running" }
        : null,
      plan
    });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function queueFollowUp(options: {
  running: { id: string; workflowId: string };
  parsed: ReturnType<typeof parseChatBody>;
}): Promise<void> {
  const plans = new WorkflowPlanRepository();
  const plan = await plans.getByTurnId(options.running.id);
  if (plan) {
    await plans.update(plan.id, {
      queuedFollowUp: {
        text: options.parsed.text,
        mode: options.parsed.mode,
        provider: options.parsed.provider,
        model: options.parsed.model,
        reasoningEffort: options.parsed.reasoningEffort
      }
    });
  }
  try {
    const { Client, Connection } = await import("@temporalio/client");
    const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";
    const connection = await Connection.connect({ address });
    const client = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || "default"
    });
    await client.workflow
      .getHandle(options.running.workflowId)
      .signal("queueFollowUp", {
        text: options.parsed.text,
        mode: options.parsed.mode,
        provider: options.parsed.provider,
        model: options.parsed.model,
        reasoningEffort: options.parsed.reasoningEffort
      });
  } catch {
    void 0;
  }
}

async function cancelRunningForForceSend(options: {
  running: { id: string; workflowId: string };
  turns: ChatTurnRepository;
}): Promise<void> {
  try {
    await cancelInteractiveChatTurn(options.running.workflowId);
  } catch {
    void 0;
  }
  await options.turns.finish({ id: options.running.id, status: "cancelled" });
  const plans = new WorkflowPlanRepository();
  const plan = await plans.getByTurnId(options.running.id);
  if (plan) {
    await plans.update(plan.id, {
      status: "cancelled",
      queuedFollowUp: null
    });
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
    if (running && !parsed.forceSend) {
      await queueFollowUp({ running, parsed });
      res.status(N_202).json({
        queued: true,
        turnId: running.id,
        workflowId: running.workflowId,
        streamUrl: `/api/sessions/${encodeURIComponent(sessionId)}/turns/${running.id}/stream`
      });
      return;
    }
    if (running) {
      await cancelRunningForForceSend({ running, turns });
    }
    const { turnId, workflowId } = await launchTurn({
      sessionId,
      text: parsed.text,
      mode: parsed.mode,
      provider: parsed.provider,
      model: parsed.model,
      reasoningEffort: parsed.reasoningEffort,
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

export async function handleStartPlan(options: {
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
    const { Client, Connection } = await import("@temporalio/client");
    const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";
    const connection = await Connection.connect({ address });
    const client = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || "default"
    });
    await client.workflow.getHandle(turn.workflowId).signal("startPlan");
    res.json({ ok: true });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
