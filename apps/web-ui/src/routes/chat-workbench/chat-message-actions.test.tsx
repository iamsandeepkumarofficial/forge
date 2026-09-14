import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantMessageActions } from "./chat-message-actions";

describe("AssistantMessageActions", () => {
  it("renders copy and branch", () => {
    const onBranch = vi.fn();
    render(<AssistantMessageActions text="hello" onBranch={onBranch} />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Branch chat" }));
    expect(onBranch).toHaveBeenCalled();
  });

  it("keeps branch busy until the handler finishes", async () => {
    let resolve!: () => void;
    const onBranch = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        })
    );
    render(<AssistantMessageActions text="hello" onBranch={onBranch} />);
    fireEvent.click(screen.getByRole("button", { name: "Branch chat" }));
    const btn = screen.getByRole("button", { name: "Branch chat" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    resolve();
    await waitFor(() => {
      expect(
        (
          screen.getByRole("button", {
            name: "Branch chat"
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false);
    });
  });
});
