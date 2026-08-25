import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ProjectService } from "./project.service.js";

describe("ProjectService", () => {
  it("uploadArchive validates missing file and non-zip names", async () => {
    const svc = new ProjectService();
    await assert.rejects(
      () => svc.uploadArchive(undefined as never, "u1"),
      /No file provided/
    );
    await assert.rejects(
      () =>
        svc.uploadArchive(
          {
            originalname: "a.txt",
            size: 10,
            buffer: Buffer.from("hi")
          } as never,
          "u1"
        ),
      /only ZIP archives/
    );
  });

  it("uploadArchive rejects oversized files", async () => {
    const prev = process.env.PROJECT_UPLOAD_MAX_MB;
    process.env.PROJECT_UPLOAD_MAX_MB = "1";
    const svc = new ProjectService();
    try {
      await assert.rejects(
        () =>
          svc.uploadArchive(
            {
              originalname: "a.zip",
              size: 2 * 1024 * 1024,
              buffer: Buffer.alloc(4)
            } as never,
            "u1"
          ),
        /File too large/
      );
    } finally {
      if (prev === undefined) delete process.env.PROJECT_UPLOAD_MAX_MB;
      else process.env.PROJECT_UPLOAD_MAX_MB = prev;
    }
  });

  it("sanitizeArchiveEntryPath rejects traversal", () => {
    const svc = new ProjectService() as unknown as {
      sanitizeArchiveEntryPath: (p: string) => string | null;
      detectWrapperPrefix: (paths: string[]) => string;
      formatBytes: (n: number) => string;
    };
    assert.equal(svc.sanitizeArchiveEntryPath("../x"), null);
    assert.equal(svc.sanitizeArchiveEntryPath("/abs"), null);
    assert.equal(svc.sanitizeArchiveEntryPath("src/a.ts"), "src/a.ts");
    assert.equal(svc.detectWrapperPrefix(["pkg/a.ts", "pkg/b.ts"]), "pkg/");
    assert.equal(svc.detectWrapperPrefix(["a.ts", "b.ts"]), "");
    assert.equal(svc.formatBytes(0), "0 B");
    assert.match(svc.formatBytes(2048), /KB/);
  });

  it("connectGithub rejects empty slug", async () => {
    const svc = new ProjectService();
    await assert.rejects(
      () => svc.connectGithub("", "u1"),
      /Invalid GitHub slug/
    );
  });

  it("deleteProject throws when missing or wrong owner", async () => {
    const svc = new ProjectService();
    const repo = (
      svc as unknown as {
        projectRepo: { getById: (id: string) => Promise<unknown> };
      }
    ).projectRepo;
    repo.getById = mock.fn(async () => null);
    await assert.rejects(
      () => svc.deleteProject("p1", "u1"),
      /Project not found/
    );
    repo.getById = mock.fn(async () => ({ id: "p1", userId: "other" }));
    await assert.rejects(
      () => svc.deleteProject("p1", "u1"),
      /Project not found/
    );
  });

  it("listProjects maps repository rows", async () => {
    const svc = new ProjectService();
    const repo = (
      svc as unknown as {
        projectRepo: { listByUserId: (id: string) => Promise<unknown[]> };
      }
    ).projectRepo;
    repo.listByUserId = mock.fn(async () => [
      {
        id: "p1",
        name: "n",
        source: "github",
        status: "available",
        createdAt: new Date("2024-01-01T00:00:00.000Z")
      }
    ]);
    const rows = await svc.listProjects("u1");
    assert.deepEqual(rows, [
      {
        id: "p1",
        name: "n",
        source: "github",
        status: "available",
        createdAt: "2024-01-01T00:00:00.000Z"
      }
    ]);
  });
});
