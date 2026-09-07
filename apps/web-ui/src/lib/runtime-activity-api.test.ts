import { describe, expect, it } from "vitest";
import { chatHrefForSession } from "./runtime-activity-api.js";

describe("runtime-activity-api", () => {
  it("builds chat hrefs for project and workspace sessions", () => {
    expect(
      chatHrefForSession({
        sessionId: "s1",
        chatId: "c1",
        projectId: "p1",
        workspaceId: null,
        title: "t",
        status: "ready",
        running: true,
        runtime: "host"
      })
    ).toBe("/projects/p1/chats/c1");
    expect(
      chatHrefForSession({
        sessionId: "s1",
        chatId: "c1",
        projectId: null,
        workspaceId: "w1",
        title: "t",
        status: "ready",
        running: true,
        runtime: "host"
      })
    ).toBe("/workspaces/w1/chats/c1");
    expect(
      chatHrefForSession({
        sessionId: "s1",
        title: "t",
        status: "absent",
        running: false,
        runtime: "host"
      })
    ).toBeNull();
  });
});
