import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders a button with the given label", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("applies variant and size classes and fires click", () => {
    const onClick = vi.fn();
    render(
      <Button variant="outline" size="sm" onClick={onClick}>
        Edit
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Edit" });
    expect(btn.getAttribute("data-slot")).toBe("button");
    expect(btn.className).toContain("border-border");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("honors the disabled attribute", () => {
    render(<Button disabled>Disabled</Button>);
    expect(
      screen.getByRole("button", { name: "Disabled" }).hasAttribute("disabled")
    ).toBe(true);
  });
});
