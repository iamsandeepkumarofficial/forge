import { describe, it, expect, beforeEach } from "vitest";
import {
  IDLE_LEFT_PCT,
  PREVIEW_LEFT_PCT,
  initialSplitPct,
  isAdaptiveDefault,
  leftPctForMinWidth,
  nextSplitPct,
  shouldCollapseLeft
} from "./workbench-split";
import { SPLIT_KEY } from "./storage.js";

describe("workbench-split", () => {
  beforeEach(() => {
    localStorage.removeItem(SPLIT_KEY);
  });

  it("treats idle, preview, and legacy 38 as adaptive defaults", () => {
    expect(isAdaptiveDefault(IDLE_LEFT_PCT)).toBe(true);
    expect(isAdaptiveDefault(PREVIEW_LEFT_PCT)).toBe(true);
    expect(isAdaptiveDefault(38)).toBe(true);
    expect(isAdaptiveDefault(45)).toBe(false);
  });

  it("narrows chat when a preview is running and the split is still a default", () => {
    expect(
      nextSplitPct({ current: 50, hasPreview: true, userOverride: false })
    ).toBe(PREVIEW_LEFT_PCT);
  });

  it("widens chat when preview stops and the split is still a default", () => {
    expect(
      nextSplitPct({ current: 32, hasPreview: false, userOverride: false })
    ).toBe(IDLE_LEFT_PCT);
  });

  it("keeps a user override", () => {
    expect(
      nextSplitPct({ current: 50, hasPreview: true, userOverride: true })
    ).toBe(50);
  });

  it("does not adapt when a split is already stored", () => {
    expect(
      nextSplitPct({
        current: 41,
        hasPreview: true,
        userOverride: false,
        hasStoredSplit: true
      })
    ).toBe(41);
    expect(
      nextSplitPct({
        current: 50,
        hasPreview: true,
        userOverride: false,
        hasStoredSplit: true
      })
    ).toBe(50);
  });

  it("reads a stored split", () => {
    localStorage.setItem(SPLIT_KEY, "41");
    expect(initialSplitPct()).toBe(41);
  });

  it("collapses the left pane once it drops below the min width", () => {
    expect(shouldCollapseLeft(1000, 20)).toBe(true);
    expect(shouldCollapseLeft(1000, 32)).toBe(false);
    expect(leftPctForMinWidth(1000)).toBe(28);
  });
});
