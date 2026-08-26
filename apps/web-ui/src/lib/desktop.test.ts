import { describe, it, expect, afterEach } from "vitest";
import { isDesktop, pickFolder } from "./desktop";

describe("desktop", () => {
  afterEach(() => {
    delete (window as { __TAURI__?: unknown }).__TAURI__;
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("isDesktop is false without Tauri globals", () => {
    expect(isDesktop()).toBe(false);
  });

  it("isDesktop is true when __TAURI_INTERNALS__ is present", () => {
    (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    expect(isDesktop()).toBe(true);
  });

  it("pickFolder returns null when not desktop", async () => {
    await expect(pickFolder()).resolves.toBeNull();
  });
});
