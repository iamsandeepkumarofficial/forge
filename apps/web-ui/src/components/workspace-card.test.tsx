import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceCard } from "./workspace-card";

describe("WorkspaceCard", () => {
  it("renders name and route count", () => {
    render(
      <WorkspaceCard
        name="Checkout"
        routeCount={2}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText("Checkout")).toBeTruthy();
    expect(screen.getByText(/2 gateway routes/)).toBeTruthy();
  });

  it("calls onOpen when the card is activated", () => {
    const onOpen = vi.fn();
    render(
      <WorkspaceCard
        name="Checkout"
        routeCount={0}
        onOpen={onOpen}
        onDelete={vi.fn()}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open workspace Checkout" })
    );
    expect(onOpen).toHaveBeenCalled();
  });
});
