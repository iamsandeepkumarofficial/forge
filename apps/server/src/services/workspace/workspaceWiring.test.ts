import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findDependsOnCycle,
  normalizeRepoName,
  resolveEnvTemplates,
  topoSortRepoNames,
  validateWorkspaceRoutes
} from "./workspaceWiring.js";

describe("workspaceWiring", () => {
  it("detects dependsOn cycles", () => {
    const cycle = findDependsOnCycle([
      { repoName: "a", dependsOn: ["b"] },
      { repoName: "b", dependsOn: ["c"] },
      { repoName: "c", dependsOn: ["a"] }
    ]);
    assert.ok(cycle);
    assert.ok(cycle!.includes("a"));
  });

  it("topo-sorts dependents after dependencies", () => {
    const order = topoSortRepoNames([
      { repoName: "frontend", dependsOn: ["backend"] },
      { repoName: "backend", dependsOn: ["payments"] },
      { repoName: "payments", dependsOn: [] }
    ]);
    assert.deepEqual(order, ["payments", "backend", "frontend"]);
  });

  it("rejects unsafe repo names", () => {
    assert.throws(() => normalizeRepoName("../escape"));
    assert.throws(() => normalizeRepoName("a/b"));
  });

  it("requires catch-all / to be last in routes", () => {
    const names = new Set(["frontend", "backend"]);
    assert.throws(() =>
      validateWorkspaceRoutes(
        [
          { pathPrefix: "/", target: "frontend" },
          { pathPrefix: "/api", target: "backend" }
        ],
        names
      )
    );
    const ok = validateWorkspaceRoutes(
      [
        { pathPrefix: "/api", target: "backend" },
        { pathPrefix: "/", target: "frontend" }
      ],
      names
    );
    assert.equal(ok.length, 2);
  });

  it("resolves env templates for internal and public urls", () => {
    const resolved = resolveEnvTemplates(
      {
        API_URL: "{{backend.internalUrl}}",
        VITE_API: "{{backend.publicUrl}}/v1"
      },
      {
        backend: {
          internalUrl: "http://localhost:3001",
          publicUrl: "http://s-abc.preview.localhost:8081/api"
        }
      }
    );
    assert.equal(resolved.API_URL, "http://localhost:3001");
    assert.equal(
      resolved.VITE_API,
      "http://s-abc.preview.localhost:8081/api/v1"
    );
  });
});
