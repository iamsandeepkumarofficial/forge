import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddAppForm } from "./add-app-form";

vi.mock("../../lib/tool-runner.js", () => ({
  saveAppsConfig: vi.fn(async () => undefined)
}));

describe("AddAppForm", () => {
  it("renders required fields and save control", () => {
    render(<AddAppForm sessionId="s1" apps={[]} onDone={vi.fn()} />);
    expect(screen.getByPlaceholderText(/name/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/cwd/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
});
