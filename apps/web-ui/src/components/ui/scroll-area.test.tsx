import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScrollArea } from "./scroll-area";

describe("ScrollArea", () => {
  it("renders children inside a scroll viewport", () => {
    render(
      <ScrollArea className="h-24">
        <p>Scrollable content</p>
      </ScrollArea>
    );
    expect(document.querySelector('[data-slot="scroll-area"]')).toBeTruthy();
    expect(
      document.querySelector('[data-slot="scroll-area-viewport"]')
    ).toBeTruthy();
    expect(screen.getByText("Scrollable content")).toBeTruthy();
  });
});
