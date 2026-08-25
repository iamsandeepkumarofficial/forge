import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Label } from "./label";

describe("Label", () => {
  it("renders a label associated with an input via htmlFor", () => {
    render(
      <>
        <Label htmlFor="title">Title</Label>
        <input id="title" />
      </>
    );
    const label = screen.getByText("Title");
    expect(label.getAttribute("data-slot")).toBe("label");
    expect(label.getAttribute("for")).toBe("title");
  });
});
