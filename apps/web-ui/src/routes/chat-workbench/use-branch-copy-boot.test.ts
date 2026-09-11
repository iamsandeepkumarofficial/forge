import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBranchCopyBoot } from "./use-branch-copy-boot";
import { copySessionMessagesUntil } from "../../lib/chat-agent.js";

vi.mock("../../lib/chat-agent.js", () => ({
  copySessionMessagesUntil: vi.fn(async () => undefined)
}));

describe("useBranchCopyBoot", () => {
  beforeEach(() => {
    vi.mocked(copySessionMessagesUntil).mockReset();
    vi.mocked(copySessionMessagesUntil).mockResolvedValue(undefined);
  });

  it("copies then marks ready", async () => {
    const navigate = vi.fn();
    const onReady = vi.fn();
    renderHook(() =>
      useBranchCopyBoot({
        sessionId: "s2",
        locationState: {
          branchCopy: {
            sourceSessionId: "s1",
            targetSessionId: "s2",
            untilMessageId: "m9"
          }
        },
        pathname: "/workspaces/w1/chats/c2",
        navigate,
        onReady
      })
    );
    await waitFor(() => {
      expect(copySessionMessagesUntil).toHaveBeenCalledWith({
        sourceSessionId: "s1",
        targetSessionId: "s2",
        untilMessageId: "m9"
      });
    });
    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
    });
    expect(navigate).toHaveBeenCalledWith("/workspaces/w1/chats/c2", {
      replace: true,
      state: {}
    });
  });

  it("starts immediately when there is no branch copy", async () => {
    const onReady = vi.fn();
    renderHook(() =>
      useBranchCopyBoot({
        sessionId: "s2",
        locationState: {},
        pathname: "/workspaces/w1/chats/c2",
        navigate: vi.fn(),
        onReady
      })
    );
    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
    });
    expect(copySessionMessagesUntil).not.toHaveBeenCalled();
  });
});
