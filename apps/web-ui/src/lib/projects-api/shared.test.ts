import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ConnectProjectError,
  formatBytes,
  N_100,
  N_1024,
  N_204,
  N_800
} from "./shared";

describe("ConnectProjectError", () => {
  it("stores code, help, and retryAfter", () => {
    const err = new ConnectProjectError("boom", {
      code: "RATE_LIMIT",
      help: "wait",
      retryAfter: "30s"
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ConnectProjectError");
    expect(err.message).toBe("boom");
    expect(err.code).toBe("RATE_LIMIT");
    expect(err.help).toBe("wait");
    expect(err.retryAfter).toBe("30s");
  });
});

describe("formatBytes", () => {
  it("formats zero and common sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(N_1024)).toBe("1 KB");
    expect(formatBytes(N_1024 * N_1024)).toBe("1 MB");
  });
});

describe("shared constants", () => {
  it("exposes numeric limits used by project APIs", () => {
    expect(N_100).toBe(100);
    expect(N_204).toBe(204);
    expect(N_800).toBe(800);
    expect(N_1024).toBe(1024);
  });
});

describe("pocToken", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads VITE_FORGE_POC_TOKEN from the environment", async () => {
    vi.stubEnv("VITE_FORGE_POC_TOKEN", "test-token");
    const { pocToken } = await import("./shared");
    expect(pocToken()).toBe("test-token");
  });
});
