import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadElectronPreviewPage,
  resetElectronPreviewOpsForTests
} from "./electron-preview-ops";

describe("electron-preview-ops", () => {
  afterEach(() => {
    resetElectronPreviewOpsForTests();
  });

  it("loads the target url", async () => {
    const loadURL = vi.fn(async () => undefined);
    const setVisible = vi.fn(async () => undefined);
    const reload = vi.fn(async () => undefined);
    loadElectronPreviewPage({
      api: { loadURL, setVisible, reload },
      url: "http://app.test/"
    });
    await vi.waitFor(() => {
      expect(loadURL).toHaveBeenCalledWith("http://app.test/");
    });
    expect(setVisible).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not let a stale blank clobber a newer load", async () => {
    const order: string[] = [];
    const loadURL = vi.fn(async (url: string) => {
      order.push(url);
    });
    const api = {
      loadURL,
      setVisible: vi.fn(async () => undefined),
      reload: vi.fn(async () => undefined)
    };
    loadElectronPreviewPage({ api, url: "" });
    loadElectronPreviewPage({ api, url: "http://app.test/" });
    await vi.waitFor(() => {
      expect(order.at(-1)).toBe("http://app.test/");
    });
    expect(order).toEqual(["http://app.test/"]);
  });

  it("reloads when requested", async () => {
    const reload = vi.fn(async () => undefined);
    loadElectronPreviewPage({
      api: {
        loadURL: vi.fn(async () => undefined),
        setVisible: vi.fn(async () => undefined),
        reload
      },
      url: "http://app.test/",
      reload: true,
      ignoreCache: true
    });
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledWith(true);
    });
  });
});
