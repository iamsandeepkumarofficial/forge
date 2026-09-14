import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  clearWorkspaceEnvironmentDepsCache,
  clearWorkspaceEnvironmentLaunch,
  getWorkspaceEnvironment
} from "./workspaces-environment-api";

describe("workspaces-environment-api", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          launch: { apps: [] },
          updatedAt: null,
          sourceSessionId: null,
          depsVolumeName: "v1"
        })
      )
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getWorkspaceEnvironment returns status", async () => {
    const status = await getWorkspaceEnvironment("w1");
    expect(status.depsVolumeName).toBe("v1");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/workspaces/w1/environment")
    );
  });

  it("clear helpers issue DELETE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 }))
    );
    await clearWorkspaceEnvironmentLaunch("w1");
    await clearWorkspaceEnvironmentDepsCache("w1");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
