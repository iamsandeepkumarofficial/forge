import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApps } from "./use-apps";

vi.mock("../../lib/tool-runner.js", () => ({
  fetchApps: vi.fn(async () => ({
    exists: true,
    apps: [
      { name: "web", type: "web", running: false, cwd: ".", command: "dev" }
    ]
  }))
}));

describe("useApps", () => {
  it("loads apps for a session", async () => {
    const { result } = renderHook(() => useApps("s1"));
    await waitFor(() => {
      expect(result.current.apps).toHaveLength(1);
    });
    expect(result.current.apps[0]?.name).toBe("web");
  });
});
