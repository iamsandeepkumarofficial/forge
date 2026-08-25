import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextUsageRing, ContextUsagePopover } from "./context-usage";

describe("context-usage", () => {
  it("ContextUsageRing reports percent via aria-label", () => {
    render(<ContextUsageRing ratio={0.5} open={false} onClick={vi.fn()} />);
    expect(screen.getByLabelText(/Context usage 50%/i)).toBeTruthy();
  });

  it("ContextUsagePopover lists token rows", () => {
    const onClose = vi.fn();
    render(
      <ContextUsagePopover
        percentFull={40}
        usageSubtitle="40% Full"
        rows={[{ label: "Conversation", tokens: 120, dot: "bg-orange-700/70" }]}
        onClose={onClose}
      />
    );
    expect(screen.getByText("Conversation")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Close context usage/i));
    expect(onClose).toHaveBeenCalled();
  });
});
