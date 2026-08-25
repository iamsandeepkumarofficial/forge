import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useVirtualFileTree } from "./use-virtual-file-tree";

describe("useVirtualFileTree", () => {
  it("builds rows from getChildren", async () => {
    const getChildren = vi.fn(async () => [
      { name: "a.ts", path: "a.ts", isDir: false }
    ]);
    const { result } = renderHook(() =>
      useVirtualFileTree({
        getChildren,
        defaultExpanded: false,
        resetKey: "1"
      })
    );
    await waitFor(() => {
      expect(result.current.rows.some((r) => r.path === "a.ts")).toBe(true);
    });
  });
});
