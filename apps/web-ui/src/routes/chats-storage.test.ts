import { describe, it, expect } from "vitest";
import {
  formatActivity,
  loadStoredProvider,
  titleFromPrompt
} from "./chats-storage";

describe("chats-storage", () => {
  it("builds titles from prompts", () => {
    expect(titleFromPrompt("")).toBe("New chat");
    expect(titleFromPrompt("hello world")).toBe("hello world");
    expect(titleFromPrompt("a".repeat(80)).endsWith("…")).toBe(true);
  });

  it("formats activity timestamps", () => {
    expect(formatActivity("not-a-date")).toBeTruthy();
  });

  it("defaults provider when storage is empty", () => {
    expect(loadStoredProvider()).toBe("openai-compatible");
  });
});
