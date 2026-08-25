import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Separator } from "./separator";

describe("Separator", () => {
  it("renders a horizontal separator by default", () => {
    const { container } = render(<Separator />);
    const el = container.querySelector('[data-slot="separator"]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute("data-orientation") ?? "horizontal").toMatch(
      /horizontal/
    );
  });

  it("supports vertical orientation", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const el = container.querySelector('[data-slot="separator"]');
    expect(el?.getAttribute("data-orientation")).toBe("vertical");
  });
});
