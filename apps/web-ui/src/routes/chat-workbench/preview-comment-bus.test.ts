import { describe, expect, it, vi } from "vitest";
import {
  onPreviewChatMessage,
  postPreviewChatMessage
} from "./preview-comment-bus";

describe("preview-comment-bus", () => {
  it("delivers posted messages to subscribed handlers", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onPreviewChatMessage(a);
    const offB = onPreviewChatMessage(b);
    postPreviewChatMessage("hello");
    expect(a).toHaveBeenCalledWith("hello");
    expect(b).toHaveBeenCalledWith("hello");
    offA();
    postPreviewChatMessage("again");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledWith("again");
    offB();
  });

  it("does nothing when there are no handlers", () => {
    expect(() => postPreviewChatMessage("solo")).not.toThrow();
  });
});
