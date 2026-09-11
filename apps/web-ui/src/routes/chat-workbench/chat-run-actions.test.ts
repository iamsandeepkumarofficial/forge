import { describe, expect, it } from "vitest";
import type { UiChatMessage } from "../../lib/chat-agent.js";
import {
  extractRunAssistantText,
  groupTranscriptMessages,
  lastPersistedAssistantId,
  shouldShowRunActions
} from "./chat-run-actions";

function msg(
  id: string,
  role: UiChatMessage["role"],
  text?: string
): UiChatMessage {
  return {
    id,
    role,
    parts: text ? [{ type: "text", text }] : []
  };
}

describe("groupTranscriptMessages", () => {
  it("groups consecutive assistant messages as one run", () => {
    const groups = groupTranscriptMessages([
      msg("u1", "user", "hi"),
      msg("a1", "assistant", "looking"),
      msg("a2", "assistant", "done"),
      msg("u2", "user", "again"),
      msg("a3", "assistant", "ok")
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["user", "run", "user", "run"]);
    expect(groups[1]).toMatchObject({
      kind: "run",
      messages: [{ id: "a1" }, { id: "a2" }]
    });
    expect(groups[3]).toMatchObject({
      kind: "run",
      messages: [{ id: "a3" }]
    });
  });
});

describe("lastPersistedAssistantId", () => {
  it("returns the last persisted assistant in a run", () => {
    expect(
      lastPersistedAssistantId([
        msg("a1", "assistant", "one"),
        msg("local-2", "assistant", "two"),
        msg("a3", "assistant", "three")
      ])
    ).toBe("a3");
  });
});

describe("shouldShowRunActions", () => {
  it("hides the in-progress last run while streaming", () => {
    expect(
      shouldShowRunActions({
        isLastRun: true,
        isStreaming: true
      })
    ).toBe(false);
    expect(
      shouldShowRunActions({
        isLastRun: false,
        isStreaming: true
      })
    ).toBe(true);
    expect(
      shouldShowRunActions({
        isLastRun: true,
        isStreaming: false
      })
    ).toBe(true);
  });
});

describe("extractRunAssistantText", () => {
  it("joins assistant text from the run", () => {
    expect(
      extractRunAssistantText([
        msg("a1", "assistant", "looking"),
        msg("a2", "assistant", "done")
      ])
    ).toBe("looking\n\ndone");
  });
});
