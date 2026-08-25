import { describe, it, expect } from "vitest";
import { DEFAULT_WORKFLOW_ID } from "./new-chat-dialog-shared";

describe("new-chat-dialog-shared", () => {
  it("exposes the default workflow id", () => {
    expect(DEFAULT_WORKFLOW_ID).toBe("sdlc");
  });
});
