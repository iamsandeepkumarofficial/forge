import type { Request, Response } from "express";
import {
  resolveModelTokenLimits,
  type ChatLlmProvider
} from "./modelContextWindow.js";
import { listModelsForProvider } from "./modelsList.js";

const N_200 = 200;
const N_400 = 400;
const N_502 = 502;

export type { ChatLlmProvider };
export { listModelsForProvider };

export function parseProvider(raw: string): ChatLlmProvider {
  const lower = raw.toLowerCase();
  if (lower === "openai" || lower === "anthropic") return lower;
  if (
    lower === "openai-compatible" ||
    lower === "custom" ||
    lower === "ollama"
  ) {
    return "openai-compatible";
  }
  return "openai-compatible";
}

export async function handleModelsList(
  req: Request,
  res: Response
): Promise<void> {
  const provider = parseProvider(
    String(req.query.provider ?? "openai-compatible")
  );
  try {
    const body = await listModelsForProvider(provider);
    res.status(body.error && body.data.length === 0 ? N_502 : N_200).json(body);
  } catch (err) {
    res.status(N_502).json({
      object: "list",
      data: [],
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

export async function handleModelContextWindow(
  req: Request,
  res: Response
): Promise<void> {
  const provider = parseProvider(
    String(req.query.provider ?? "openai-compatible")
  );
  const model =
    typeof req.query.model === "string" ? req.query.model.trim() : "";
  if (!model) {
    res.status(N_400).json({ error: "model query required" });
    return;
  }
  try {
    const limits = await resolveModelTokenLimits(provider, model);
    res.json({
      provider,
      model,
      contextWindow: limits.contextWindow,
      maxOutputTokens: limits.maxOutputTokens,
      source: limits.contextWindow == null ? "unknown" : "resolved"
    });
  } catch (err) {
    res.status(N_502).json({
      provider,
      model,
      contextWindow: null,
      maxOutputTokens: null,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}
