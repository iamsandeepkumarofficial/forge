import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ProjectService } from "./project.service.js";

describe("ProjectService", () => {
  it("connectGithub rejects empty slug", async () => {
    const svc = new ProjectService();
    await assert.rejects(
      () => svc.connectGithub("", "u1"),
      /Invalid GitHub slug/
    );
  });

  it("deleteProject throws when missing", async () => {
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
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        lastActivityAt: new Date("2024-01-02T00:00:00.000Z")
      }
    ]);
    const rows = await svc.listProjects("u1");
    assert.deepEqual(rows, [
      {
        id: "p1",
        name: "n",
        source: "github",
        status: "available",
        createdAt: "2024-01-01T00:00:00.000Z",
        lastActivityAt: "2024-01-02T00:00:00.000Z"
      }
    ]);
  });
});
