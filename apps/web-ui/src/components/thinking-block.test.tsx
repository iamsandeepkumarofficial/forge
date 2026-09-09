import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThinkingBlock } from "./thinking-block";

describe("ThinkingBlock", () => {
  it("renders nothing for empty text", () => {
    const { container } = render(<ThinkingBlock text="  " />);
    expect(container.firstChild).toBeNull();
  });

  it("toggles collapsed reasoning", () => {
    render(<ThinkingBlock text="because reasons" defaultOpen={false} />);
    expect(screen.queryByText("because reasons")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /thought/i }));
    expect(screen.getByText("because reasons")).toBeTruthy();
  });
});
