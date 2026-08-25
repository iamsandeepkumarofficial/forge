import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "./input";

describe("Input", () => {
  it("renders an input with placeholder and type", () => {
    render(<Input placeholder="Email" type="email" />);
    const input = screen.getByPlaceholderText("Email");
    expect(input.getAttribute("data-slot")).toBe("input");
    expect(input.getAttribute("type")).toBe("email");
  });

  it("fires change events", () => {
    const onChange = vi.fn();
    render(<Input aria-label="Name" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada" }
    });
    expect(onChange).toHaveBeenCalled();
  });
});
