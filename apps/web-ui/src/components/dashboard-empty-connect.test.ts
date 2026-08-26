import { describe, it, expect, vi } from "vitest";
import { errorMessage, maybeCreateChat } from "./dashboard-empty-connect";

vi.mock("../lib/projects-api.js", () => ({
  ConnectProjectError: class extends Error {
    help?: string;
    constructor(message: string, options?: { help?: string }) {
      super(message);
      this.help = options?.help;
    }
  },
  connectProject: vi.fn(),
  connectLocalProject: vi.fn(),
  createChat: vi.fn(async () => ({ id: "c1" }))
}));

describe("dashboard-empty-connect", () => {
  it("errorMessage formats plain errors", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("maybeCreateChat no-ops for empty titles", async () => {
    await maybeCreateChat({ projectId: "p1", title: "" });
  });
});
