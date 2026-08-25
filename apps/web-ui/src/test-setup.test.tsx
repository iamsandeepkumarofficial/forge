import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

describe("test-setup", () => {
  it("cleans up rendered trees via testing-library cleanup", () => {
    render(<p>setup-ok</p>);
    expect(screen.getByText("setup-ok")).toBeTruthy();
    cleanup();
    expect(screen.queryByText("setup-ok")).toBeNull();
  });

  it("provides localStorage for workbench storage helpers", () => {
    localStorage.setItem("k", "v");
    expect(localStorage.getItem("k")).toBe("v");
    localStorage.clear();
    expect(localStorage.getItem("k")).toBeNull();
  });
});
