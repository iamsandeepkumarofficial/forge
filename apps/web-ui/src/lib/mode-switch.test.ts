import { describe, it, expect } from "vitest";
import {
  findAppliedModeSwitch,
  findPendingModeSwitch,
  MODE_SWITCH_TIMEOUT_MS,
  MODE_SWITCH_TIMEOUT_SECONDS,
  modeSwitchContinueMessage,
  parseComposerMode
} from "./mode-switch";
import type { ToolPart } from "./tool-display";
import type { UiChatMessage } from "./chat-agent";

describe("mode-switch", () => {
  it("exposes a 45s approval timeout", () => {
    expect(MODE_SWITCH_TIMEOUT_SECONDS).toBe(45);
    expect(MODE_SWITCH_TIMEOUT_MS).toBe(45_000);
  });

  it("modeSwitchContinueMessage asks the agent to continue", () => {
    expect(modeSwitchContinueMessage("plan")).toBe(
      "Approved — continue in Plan mode."
    );
    expect(modeSwitchContinueMessage("ask")).toBe(
      "Approved — continue in Ask mode."
    );
  });

  it("parseComposerMode accepts known ids", () => {
    expect(parseComposerMode("ask")).toBe("ask");
    expect(parseComposerMode("ASK")).toBe("ask");
    expect(parseComposerMode("nope")).toBeNull();
  });

  it("findPendingModeSwitch reads needsConfirmation metadata", () => {
    const live: ToolPart[] = [
      {
        type: "tool-invocation",
        toolCallId: "c1",
        toolName: "switch_mode",
        state: "result",
        output: "Proposed switch to ask.",
        metadata: {
          applied: false,
          target: "ask",
          needsConfirmation: true
        }
      }
    ];
    expect(
      findPendingModeSwitch({
        messages: [],
        liveToolParts: live,
        dismissedIds: new Set()
      })
    ).toEqual({ toolCallId: "c1", target: "ask" });
    expect(
      findPendingModeSwitch({
        messages: [],
        liveToolParts: live,
        dismissedIds: new Set(["c1"])
      })
    ).toBeNull();
  });

  it("findAppliedModeSwitch reads Auto-applied switches", () => {
    const messages: UiChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-invocation",
            toolCallId: "c2",
            toolName: "switch_mode",
            state: "result",
            metadata: { applied: true, target: "plan", mode: "plan" }
          }
        ]
      }
    ];
    expect(findAppliedModeSwitch({ messages, liveToolParts: [] })).toBe("plan");
  });
});
