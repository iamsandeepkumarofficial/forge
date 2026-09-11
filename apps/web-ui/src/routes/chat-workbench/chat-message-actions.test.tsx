import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AssistantMessageActions } from "./chat-message-actions";

describe("AssistantMessageActions", () => {
  it("renders copy and branch", () => {
    const onBranch = vi.fn();
    render(<AssistantMessageActions text="hello" onBranch={onBranch} />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Branch chat" }));
    expect(onBranch).toHaveBeenCalled();
  });
});
