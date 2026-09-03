import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  PreviewCommentCard,
  commentWidgetPosition
} from "./preview-comment-card";

const pane = { left: 800, top: 100, width: 600, height: 800 };

describe("PreviewCommentCard", () => {
  it("places the widget beside the selected element", () => {
    expect(
      commentWidgetPosition({
        pane,
        anchor: { x: 40, y: 80, w: 80, h: 40 },
        viewport: { w: 600, h: 800 }
      })
    ).toEqual({ left: 932, top: 180 });
  });

  it("keeps the widget inside the preview pane", () => {
    expect(
      commentWidgetPosition({
        pane,
        anchor: { x: 16, y: 200, w: 568, h: 48 },
        viewport: { w: 600, h: 800 }
      }).left
    ).toBeGreaterThanOrEqual(812);
    expect(
      commentWidgetPosition({
        pane,
        anchor: { x: 16, y: 200, w: 568, h: 48 },
        viewport: { w: 600, h: 800 }
      }).left
    ).toBeLessThan(800 + 600);
  });

  it("shows the selected element and sends a comment", () => {
    const onSend = vi.fn();
    const onDraft = vi.fn();
    render(
      <PreviewCommentCard
        pick={{
          url: "http://app.test/",
          tag: "button",
          selector: "button.cta",
          text: "Go",
          nearby: "Hero Go"
        }}
        draft="Make it primary"
        onDraft={onDraft}
        onCancel={vi.fn()}
        onSend={onSend}
      />
    );
    const dialog = screen.getByRole("dialog", {
      name: "Comment on this element"
    });
    expect(dialog).toBeTruthy();
    expect(dialog.className).toContain("fixed");
    expect(screen.getByText(/button.cta/)).toBeTruthy();
    expect(screen.getByText(/Nearby: Hero Go/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send to chat" }));
    expect(onSend).toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(/What should change/), {
      target: { value: "Bigger" }
    });
    expect(onDraft).toHaveBeenCalledWith("Bigger");
  });
});
