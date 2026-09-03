import { describe, it, expect } from "vitest";
import {
  normalizeCatchAllLast,
  suggestPreviewRoutes
} from "./suggest-preview-routes";
import type { WorkspaceMember } from "./workspaces-api.js";

function member(
  repoName: string,
  projectName = repoName
): WorkspaceMember {
  return {
    id: `m-${repoName}`,
    workspaceId: "w1",
    projectId: `p-${repoName}`,
    repoName,
    sortOrder: 0,
    dependsOn: [],
    env: {},
    createdAt: "2024-01-01T00:00:00.000Z",
    project: {
      id: `p-${repoName}`,
      name: projectName,
      source: "local",
      dedupeKey: repoName,
      status: "available"
    }
  };
}

describe("suggestPreviewRoutes", () => {
  it("maps bp-backend → /api and bp-frontend → / with catch-all last", () => {
    const routes = suggestPreviewRoutes([
      member("bp-frontend"),
      member("bp-backend")
    ]);
    expect(routes).toEqual([
      { pathPrefix: "/api", target: "bp-backend" },
      { pathPrefix: "/", target: "bp-frontend" }
    ]);
  });

  it("falls back to first unused member for catch-all", () => {
    const routes = suggestPreviewRoutes([
      member("payments"),
      member("api-gateway")
    ]);
    expect(routes[0]).toEqual({
      pathPrefix: "/api",
      target: "api-gateway"
    });
    expect(routes.at(-1)?.pathPrefix).toBe("/");
  });
});

describe("normalizeCatchAllLast", () => {
  it("moves / to the end", () => {
    expect(
      normalizeCatchAllLast([
        { pathPrefix: "/", target: "a" },
        { pathPrefix: "/api", target: "b" }
      ])
    ).toEqual([
      { pathPrefix: "/api", target: "b" },
      { pathPrefix: "/", target: "a" }
    ]);
  });
});
