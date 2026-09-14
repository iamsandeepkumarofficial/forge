import { describe, it, expect, vi } from "vitest";
import { HomeLoaded } from "./home-loaded.js";

describe("HomeLoaded", () => {
  it("exports a loaded home view component", () => {
    expect(typeof HomeLoaded).toBe("function");
    expect(vi).toBeTruthy();
  });
});
