import type { LanguageModel } from "ai";
import {
  normalizeOpenAICompatibleBaseUrl,
  resolveLanguageModel
} from "./model.js";
import { resolveProvider, type LlmProvider } from "./env.js";

export type { LlmProvider };
export type ChatLlmProvider = LlmProvider;

export { normalizeOpenAICompatibleBaseUrl };

export function coerceChatProvider(raw: string | undefined): LlmProvider {
  return resolveProvider(raw);
}

export async function resolveChatLanguageModel(
  provider: LlmProvider | string,
  modelId?: string
): Promise<LanguageModel> {
  return resolveLanguageModel({
    provider: coerceChatProvider(
      typeof provider === "string" ? provider : String(provider)
    ),
    modelId
  });
}
