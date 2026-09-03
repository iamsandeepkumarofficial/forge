import { describe, it, expect, afterEach, vi } from "vitest";
import { electronPreview, isDesktop, isElectronPreview, pickFolder } from "./desktop";

describe("desktop", () => {
  afterEach(() => {
    delete (window as { forgeDesktop?: unknown }).forgeDesktop;
    vi.resetModules();
  });

  it("isDesktop is false without desktop globals", () => {
    expect(isDesktop()).toBe(false);
    expect(isElectronPreview()).toBe(false);
  });

  it("isDesktop is true when forgeDesktop is present", () => {
    window.forgeDesktop = { pickFolder: async () => "/tmp" };
    expect(isDesktop()).toBe(true);
  });

  it("isElectronPreview is true only with preview bridge", () => {
    window.forgeDesktop = {
      pickFolder: async () => "/tmp",
      preview: { setVisible: async () => undefined } as never
    };
    expect(isElectronPreview()).toBe(true);
    expect(electronPreview()).toBe(window.forgeDesktop.preview);
  });

  it("pickFolder returns null when not desktop", async () => {
    await expect(pickFolder()).resolves.toBeNull();
  });

  it("pickFolder uses forgeDesktop when present", async () => {
    window.forgeDesktop = { pickFolder: async () => "/picked" };
    await expect(pickFolder()).resolves.toBe("/picked");
  });
});
