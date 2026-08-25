import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders badge text with default variant classes", () => {
    render(<Badge>New</Badge>);
    const badge = screen.getByText("New");
    expect(badge.getAttribute("data-slot")).toBe("badge");
    expect(badge.className).toContain("bg-primary");
  });

  it("applies secondary and outline variants", () => {
    const { rerender } = render(<Badge variant="secondary">Sec</Badge>);
    expect(screen.getByText("Sec").className).toContain("bg-secondary");
    rerender(<Badge variant="outline">Out</Badge>);
    expect(screen.getByText("Out").className).toContain("border-border");
  });
});
