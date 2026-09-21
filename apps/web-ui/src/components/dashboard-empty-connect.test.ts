import { describe, it, expect, vi } from "vitest";
import {
  errorMessage,
  maybeCreateWorkspaceChat
} from "./dashboard-empty-connect";

vi.mock("../lib/projects-api.js", () => ({
  ConnectProjectError: class extends Error {
    help?: string;
    constructor(message: string, options?: { help?: string }) {
      super(message);
      this.help = options?.help;
    }
  },
  connectProject: vi.fn(),
  connectLocalProject: vi.fn()
}));

vi.mock("../lib/workspaces-api.js", () => ({
  createWorkspaceChat: vi.fn(async () => ({ id: "c1" }))
}));

describe("dashboard-empty-connect", () => {
  it("errorMessage formats plain errors", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("maybeCreateWorkspaceChat no-ops for empty titles", async () => {
    await maybeCreateWorkspaceChat({ workspaceId: "w1", title: "" });
  });
});
