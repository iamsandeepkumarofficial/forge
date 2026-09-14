import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  WorkspaceSettingsError,
  WorkspaceSettingsLoading,
  WorkspaceSettingsTabNav
} from "./workspace-settings-shell";

describe("workspace-settings-shell", () => {
  it("shows a loading state", () => {
    render(<WorkspaceSettingsLoading />);
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("shows an error message", () => {
    render(<WorkspaceSettingsError message="Failed to load" />);
    expect(screen.getByText("Failed to load")).toBeTruthy();
  });

  it("switches tabs when a nav button is clicked", () => {
    const onTab = vi.fn();
    render(<WorkspaceSettingsTabNav tab="overview" onTab={onTab} />);
    expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Parameter store" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Databases" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Environment" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Environment" }));
    expect(onTab).toHaveBeenCalledWith("environment");
  });
});
