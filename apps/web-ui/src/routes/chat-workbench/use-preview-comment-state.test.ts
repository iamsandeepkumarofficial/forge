import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePreviewCommentState } from "./use-preview-comment-state";

const postPreviewChatMessage = vi.fn();

vi.mock("./preview-comment-bus.js", () => ({
  postPreviewChatMessage: (...args: unknown[]) =>
    postPreviewChatMessage(...args)
}));

describe("usePreviewCommentState", () => {
  it("sends a formatted comment and clears pick state", () => {
    const onCommentSent = vi.fn();
    const { result } = renderHook(() => usePreviewCommentState(onCommentSent));
    act(() => {
      result.current.setCommenting(true);
      result.current.setDraft("looks good");
      result.current.setPick({
        url: "http://localhost:3000/",
        tag: "button",
        selector: "#go",
        text: "Go"
      });
    });
    act(() => {
      result.current.sendComment();
    });
    expect(postPreviewChatMessage).toHaveBeenCalledWith(
      expect.stringContaining("I left a comment on the preview.")
    );
    expect(result.current.pick).toBeNull();
    expect(result.current.commenting).toBe(false);
    expect(result.current.draft).toBe("");
    expect(onCommentSent).toHaveBeenCalled();
  });

  it("does not send without a pick", () => {
    postPreviewChatMessage.mockClear();
    const { result } = renderHook(() => usePreviewCommentState());
    act(() => {
      result.current.sendComment();
    });
    expect(postPreviewChatMessage).not.toHaveBeenCalled();
  });
});
