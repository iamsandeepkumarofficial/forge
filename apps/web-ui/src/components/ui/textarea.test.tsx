import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders a textarea with placeholder", () => {
    render(<Textarea placeholder="Notes" />);
    const el = screen.getByPlaceholderText("Notes");
    expect(el.tagName).toBe("TEXTAREA");
    expect(el.getAttribute("data-slot")).toBe("textarea");
  });

  it("fires change events", () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="Body" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Body"), {
      target: { value: "hello" }
    });
    expect(onChange).toHaveBeenCalled();
  });
});
