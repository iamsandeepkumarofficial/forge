import { describe, it, expect, vi } from "vitest";
import { errorMessage, maybeCreateChat } from "./dashboard-empty-uploads";

vi.mock("../lib/projects-api.js", () => ({
  ConnectProjectError: class extends Error {
    help?: string;
    constructor(message: string, options?: { help?: string }) {
      super(message);
      this.help = options?.help;
    }
  },
  connectProject: vi.fn(),
  createChat: vi.fn(async () => ({ id: "c1" })),
  uploadProject: vi.fn()
}));

vi.mock("../lib/zip-project-files.js", () => ({
  archiveNameForFolder: (n: string) => `${n}.zip`,
  entriesFromDataTransfer: vi.fn(),
  entriesFromFileList: vi.fn(),
  zipProjectEntries: vi.fn()
}));

describe("dashboard-empty-uploads", () => {
  it("errorMessage formats plain errors", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("maybeCreateChat no-ops for empty titles", async () => {
    await maybeCreateChat({ projectId: "p1", title: "" });
  });
});
