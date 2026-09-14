import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  usePreviewAppBinding,
  usePreviewApiAddressSync
} from "./use-preview-app-binding";

describe("usePreviewAppBinding", () => {
  it("rebinds address and history when the active app changes", () => {
    const setAddress = vi.fn();
    const setHistory = vi.fn();
    const setHistIndex = vi.fn();
    const setApiPath = vi.fn();
    const { rerender, result } = renderHook(
      ({ name, url }) =>
        usePreviewAppBinding({
          active: { name, url, running: true } as never,
          appUrl: url,
          surface: "browser",
          setAddress,
          setHistory,
          setHistIndex,
          setApiPath,
          setZoom: vi.fn(),
          setCacheBust: vi.fn()
        }),
      { initialProps: { name: "web", url: "http://localhost:3000/" } }
    );
    expect(result.current).toBe("http://localhost:3000/");
    setAddress.mockClear();
    setHistory.mockClear();
    rerender({ name: "api", url: "http://localhost:4000/" });
    expect(setAddress).toHaveBeenCalledWith("http://localhost:4000/");
    expect(setHistory).toHaveBeenCalledWith(["http://localhost:4000/"]);
    expect(setHistIndex).toHaveBeenCalledWith(0);
  });
});

describe("usePreviewApiAddressSync", () => {
  it("syncs address from api path", () => {
    const setAddress = vi.fn();
    renderHook(() =>
      usePreviewApiAddressSync({
        surface: "api",
        appUrl: "http://localhost:3000/",
        active: undefined,
        apiPath: "/users",
        setAddress
      })
    );
    expect(setAddress).toHaveBeenCalledWith("http://localhost:3000/users");
  });
});
