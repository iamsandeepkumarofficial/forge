import type { ChatMode, LlmProvider } from "../../lib/chat-agent.js";
import { coerceLlmProvider } from "../../lib/chat-agent.js";
import type { ComposerAgentMode } from "../../components/chat-composer.js";

export const PROVIDER_KEY = "forge.workbench.provider";
export const MODEL_MAP_KEY = "forge.workbench.model-map";
export const MODE_KEY = "forge.workbench.mode";
export const AGENT_MODE_KEY = "forge.workbench.agent-mode";
export const AUTO_MODEL_KEY = "forge.workbench.auto-model";
export const SPLIT_KEY = "forge.workbench.split";
export const TERMINAL_OPEN_KEY = "forge.workbench.terminal-open";
export const TERMINAL_HEIGHT_KEY = "forge.workbench.terminal-height";
export const DOCK_MODE_KEY = "forge.workbench.dock-mode";

const N_120 = 120;
const N_220 = 220;
const N_480 = 480;

export function loadTerminalOpen(): boolean {
  try {
    const v = localStorage.getItem(TERMINAL_OPEN_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    void 0;
  }
  return false;
}

export function loadTerminalHeight(): number {
  try {
    const n = Number(localStorage.getItem(TERMINAL_HEIGHT_KEY));
    if (Number.isFinite(n) && n >= N_120 && n <= N_480) {
      return n;
    }
  } catch {
    void 0;
  }
  return N_220;
}

export function persistTerminalOpen(open: boolean): void {
  try {
    localStorage.setItem(TERMINAL_OPEN_KEY, open ? "1" : "0");
  } catch {
    void 0;
  }
}

export function persistTerminalHeight(height: number): void {
  try {
    localStorage.setItem(TERMINAL_HEIGHT_KEY, String(Math.round(height)));
  } catch {
    void 0;
  }
}

export function loadDockMode(): "terminal" | "devtools" {
  try {
    if (localStorage.getItem(DOCK_MODE_KEY) === "devtools") return "devtools";
  } catch {
    void 0;
  }
  return "terminal";
}

export function persistDockMode(mode: "terminal" | "devtools"): void {
  try {
    localStorage.setItem(DOCK_MODE_KEY, mode);
  } catch {
    void 0;
  }
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
    if (raw) return JSON.parse(raw);
  } catch {
    void 0;
  }
  return {};
}
function parseStoredAgentMode(raw: string | null): ComposerAgentMode | null {
  if (
    raw === "agent" ||
    raw === "plan" ||
    raw === "debug" ||
    raw === "multitask" ||
    raw === "ask" ||
    raw === "auto"
  ) {
    return raw;
  }
  if (raw === "build") {
    return "agent";
  }
  return null;
}

export function loadStoredMode(): ChatMode {
  try {
    return parseStoredAgentMode(localStorage.getItem(MODE_KEY)) ?? "agent";
  } catch {
    return "agent";
  }
}
export function loadStoredAgentMode(): ComposerAgentMode {
  try {
    const fromAgent = parseStoredAgentMode(
      localStorage.getItem(AGENT_MODE_KEY)
    );
    if (fromAgent) {
      return fromAgent;
    }
  } catch {
    void 0;
  }
  return loadStoredMode();
}
export function loadStoredAutoModel(): boolean {
  try {
    const v = localStorage.getItem(AUTO_MODEL_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    void 0;
  }
  return false;
}
