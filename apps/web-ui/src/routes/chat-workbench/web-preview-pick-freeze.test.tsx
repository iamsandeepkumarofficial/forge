import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PreviewPickFreeze } from "./web-preview-pick-freeze";
import type { PreviewPick } from "./preview-nav";

describe("PreviewPickFreeze", () => {
  it("renders nothing without a page shot", () => {
    const { container } = render(
      <PreviewPickFreeze
        pick={{ url: "/", tag: "div", selector: "", text: "" }}
      />
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders freeze layer when pageShot is present", () => {
    const pick: PreviewPick = {
      url: "http://localhost:3000/",
      tag: "button",
      selector: "#go",
      text: "Go",
      pageShot: "data:image/png;base64,aaa",
      anchor: { x: 10, y: 20, w: 40, h: 20 },
      viewport: { w: 800, h: 600 }
    };
    const { container } = render(<PreviewPickFreeze pick={pick} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "data:image/png;base64,aaa"
    );
  });
});
