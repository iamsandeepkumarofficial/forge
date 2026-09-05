import { describe, expect, it, vi } from "vitest";
import { previewHistoryActions } from "./preview-history-actions";

describe("previewHistoryActions", () => {
  it("submits the typed address into history", () => {
    const setAddress = vi.fn();
    const setHistory = vi.fn();
    const setHistIndex = vi.fn();
    const setApiPath = vi.fn();
    const actions = previewHistoryActions({
      address: "http://localhost:3000/",
      appUrl: "http://localhost:3000/",
      active: undefined,
      surface: "browser",
      history: ["http://localhost:3000/"],
      histIndex: 0,
      setAddress,
      setHistory,
      setHistIndex,
      setApiPath
    });
    actions.submitAddress("/about");
    expect(setAddress).toHaveBeenCalledWith("http://localhost:3000/about");
    expect(setHistory).toHaveBeenCalled();
    expect(setHistIndex).toHaveBeenCalledWith(1);
  });

  it("navigates history and syncs api path", () => {
    const setAddress = vi.fn();
    const setHistIndex = vi.fn();
    const setApiPath = vi.fn();
    const actions = previewHistoryActions({
      address: "http://localhost:3000/b",
      appUrl: "http://localhost:3000/",
      active: undefined,
      surface: "api",
      history: ["http://localhost:3000/a", "http://localhost:3000/b"],
      histIndex: 1,
      setAddress,
      setHistory: vi.fn(),
      setHistIndex,
      setApiPath
    });
    actions.goHistory(0);
    expect(setHistIndex).toHaveBeenCalledWith(0);
    expect(setAddress).toHaveBeenCalledWith("http://localhost:3000/a");
    expect(setApiPath).toHaveBeenCalledWith("/a");
  });
});
