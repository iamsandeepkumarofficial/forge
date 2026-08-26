import type { Request, Response } from "express";
import {
  readForgeLlmConfig,
  writeForgeLlmConfig,
  type ForgeLlmConfig
} from "../settings/forgeLlmConfig.js";

const N_200 = 200;
const N_400 = 400;

export type LlmSettingsBody = {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  openaiCompatibleBaseUrl?: string;
  openaiCompatibleApiKey?: string;
  openaiCompatibleModel?: string;
};

function toClient(llm: ForgeLlmConfig): LlmSettingsBody {
  return {
    openaiApiKey: llm.openaiApiKey ?? "",
    anthropicApiKey: llm.anthropicApiKey ?? "",
    openaiCompatibleBaseUrl: llm.baseUrl ?? "",
    openaiCompatibleApiKey: llm.apiKey ?? "",
    openaiCompatibleModel: llm.model ?? ""
  };
}

function fromClient(body: LlmSettingsBody): ForgeLlmConfig {
  return {
    provider: "openai-compatible",
    openaiApiKey: String(body.openaiApiKey ?? "").trim(),
    anthropicApiKey: String(body.anthropicApiKey ?? "").trim(),
    baseUrl: String(body.openaiCompatibleBaseUrl ?? "").trim(),
    apiKey: String(body.openaiCompatibleApiKey ?? "").trim(),
    model: String(body.openaiCompatibleModel ?? "").trim()
  };
}

export async function handleGetLlmSettings(
  _req: Request,
  res: Response
): Promise<void> {
  const llm = await readForgeLlmConfig();
  res.status(N_200).json(toClient(llm));
}

export async function handlePutLlmSettings(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.body || typeof req.body !== "object") {
    res.status(N_400).json({ error: "JSON body required" });
    return;
  }
  const saved = await writeForgeLlmConfig(fromClient(req.body as LlmSettingsBody));
  res.status(N_200).json(toClient(saved.llm ?? {}));
}
