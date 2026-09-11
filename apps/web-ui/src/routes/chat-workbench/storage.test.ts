import { describe, it, expect, beforeEach } from "vitest";
import {
  PROVIDER_KEY,
  MODEL_MAP_KEY,
  MODE_KEY,
  AGENT_MODE_KEY,
  AUTO_MODEL_KEY,
  TERMINAL_OPEN_KEY,
  TERMINAL_HEIGHT_KEY,
  TERMINAL_TAB_LIST_WIDTH_KEY,
  DOCK_MODE_KEY,
  loadStoredProvider,
  loadStoredModelMap,
  loadStoredMode,
  loadStoredAgentMode,
  loadStoredAutoModel,
  loadTerminalOpen,
  loadTerminalHeight,
  loadTerminalTabListWidth,
  loadDockMode,
  loadDockExtras,
  persistTerminalOpen,
  persistTerminalHeight,
  persistTerminalTabListWidth,
  persistDockMode,
  persistDockExtras
} from "./storage";

describe("chat-workbench storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults provider/mode/agent mode when empty", () => {
    expect(loadStoredProvider()).toBe("openai-compatible");
    expect(loadStoredMode()).toBe("agent");
    expect(loadStoredAgentMode()).toBe("agent");
    expect(loadStoredAutoModel()).toBe(false);
    expect(loadStoredModelMap()).toEqual({});
    expect(loadTerminalOpen()).toBe(false);
    expect(loadTerminalHeight()).toBeGreaterThan(0);
    expect(loadTerminalTabListWidth()).toBeGreaterThan(0);
    expect(loadDockMode()).toBe("terminal");
    expect(loadDockExtras()).toEqual([]);
  });

  it("migrates a persisted DevTools dock mode into extras", () => {
    persistDockMode("devtools");
    expect(loadDockExtras()).toEqual(["devtools"]);
  });

  it("reads stored values from localStorage", () => {
    localStorage.setItem(PROVIDER_KEY, "openai");
    localStorage.setItem(MODE_KEY, "plan");
    localStorage.setItem(AGENT_MODE_KEY, "ask");
    localStorage.setItem(AUTO_MODEL_KEY, "1");
    localStorage.setItem(MODEL_MAP_KEY, JSON.stringify({ openai: "gpt-4o" }));
    expect(loadStoredProvider()).toBe("openai");
    expect(loadStoredMode()).toBe("plan");
    expect(loadStoredAgentMode()).toBe("ask");
    expect(loadStoredAutoModel()).toBe(true);
    expect(loadStoredModelMap()).toEqual({ openai: "gpt-4o" });
    persistTerminalOpen(true);
    persistTerminalHeight(loadTerminalHeight());
    persistTerminalTabListWidth(180);
    persistDockMode("devtools");
    expect(localStorage.getItem(TERMINAL_OPEN_KEY)).toBe("1");
    expect(localStorage.getItem(DOCK_MODE_KEY)).toBe("devtools");
    expect(loadTerminalOpen()).toBe(true);
    expect(loadDockMode()).toBe("devtools");
    persistDockExtras(["devtools"]);
    expect(loadDockExtras()).toEqual(["devtools"]);
    expect(Number(localStorage.getItem(TERMINAL_HEIGHT_KEY))).toBe(
      loadTerminalHeight()
    );
    expect(Number(localStorage.getItem(TERMINAL_TAB_LIST_WIDTH_KEY))).toBe(180);
    expect(loadTerminalTabListWidth()).toBe(180);
  });

  it("maps legacy custom/ollama providers to openai-compatible", () => {
    localStorage.setItem(PROVIDER_KEY, "custom");
    expect(loadStoredProvider()).toBe("openai-compatible");
    localStorage.setItem(PROVIDER_KEY, "ollama");
    expect(loadStoredProvider()).toBe("openai-compatible");
  });
});
