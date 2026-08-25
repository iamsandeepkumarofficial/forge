import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders a pulsing placeholder with custom class", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const el = container.querySelector('[data-slot="skeleton"]');
    expect(el).toBeTruthy();
    expect(el?.className).toContain("animate-pulse");
    expect(el?.className).toContain("h-4");
    expect(el?.className).toContain("w-20");
  });
});
