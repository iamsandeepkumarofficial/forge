import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModePicker } from "./mode-picker";

describe("ModePicker", () => {
  it("renders the current agent mode label", () => {
    render(<ModePicker value="agent" onChange={vi.fn()} />);
    expect(screen.getByText("Agent")).toBeTruthy();
  });

  it("includes Auto in the mode menu", () => {
    render(<ModePicker value="auto" onChange={vi.fn()} />);
    expect(screen.getByText("Auto")).toBeTruthy();
  });
});
