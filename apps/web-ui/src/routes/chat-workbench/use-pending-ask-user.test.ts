import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePendingAskUser } from "./use-pending-ask-user";
import type { ToolPart } from "../../lib/tool-display";

const proposal: ToolPart = {
  type: "tool-invocation",
  toolCallId: "ask-1",
  toolName: "ask_user",
  state: "result",
  metadata: {
    needsUserInput: true,
    kind: "mcq",
    prompt: "Pick one?",
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" }
    ]
  }
};

describe("usePendingAskUser", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("surfaces a pending ask_user proposal", () => {
    const { result } = renderHook(() =>
      usePendingAskUser({
        sessionId: "s1",
        messages: [],
        liveToolParts: [proposal]
      })
    );
    expect(result.current.pending).toMatchObject({
      toolCallId: "ask-1",
      kind: "mcq",
      prompt: "Pick one?"
    });
  });

  it("dismisses and persists the proposal id", async () => {
    const { result } = renderHook(() =>
      usePendingAskUser({
        sessionId: "s1",
        messages: [],
        liveToolParts: [proposal]
      })
    );
    act(() => {
      result.current.onDismissAskUser();
    });
    await waitFor(() => expect(result.current.pending).toBeNull());
    expect(sessionStorage.getItem("forge:ask-user-dismissed:s1")).toContain(
      "ask-1"
    );
  });
});
