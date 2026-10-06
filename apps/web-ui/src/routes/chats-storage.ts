import type { LlmProvider } from "../lib/chat-agent.js";
import { coerceLlmProvider } from "../lib/chat-agent.js";
import type { ComposerAgentMode } from "../components/chat-composer.js";

export const N_50 = 50;
export const N_57 = 57;
export const N_60 = 60;

export const PROVIDER_KEY = "forge.workbench.provider";
export const MODEL_MAP_KEY = "forge.workbench.model-map";
export const AUTO_MODEL_KEY = "forge.workbench.auto-model";
export const AGENT_MODE_KEY = "forge.workbench.agent-mode";
export const MODE_KEY = "forge.workbench.mode";

export function formatActivity(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function titleFromPrompt(prompt: string): string {
  const t = prompt.trim().replace(/\s+/g, " ");
  if (!t) return "New chat";
  return t.length > N_60 ? `${t.slice(0, N_57)}…` : t;
}

export function loadStoredProvider(): LlmProvider {
  try {
    return coerceLlmProvider(localStorage.getItem(PROVIDER_KEY));
  } catch {
    void 0;
  }
  return "openai-compatible";
}

export function loadStoredModelMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MODEL_MAP_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    void 0;
  }
  return {};
}

export function loadStoredAutoModel(): boolean {
  try {
    const v = localStorage.getItem(AUTO_MODEL_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    void 0;
  }
  return true;
}

export function loadStoredAgentMode(): ComposerAgentMode {
  try {
    const v = localStorage.getItem(AGENT_MODE_KEY);
    if (
      v === "agent" ||
      v === "plan" ||
      v === "debug" ||
      v === "ask" ||
      v === "auto"
    ) {
      return v;
    }
    if (v === "build" || v === "multitask") {
      return "agent";
    }
  } catch {
    void 0;
  }
  try {
    const legacy = localStorage.getItem(MODE_KEY);
    if (legacy === "plan") return "plan";
    if (legacy === "build" || legacy === "multitask") return "agent";
    if (
      legacy === "agent" ||
      legacy === "debug" ||
      legacy === "ask" ||
      legacy === "auto"
    ) {
      return legacy;
    }
  } catch {
    void 0;
  }
  return "agent";
}
