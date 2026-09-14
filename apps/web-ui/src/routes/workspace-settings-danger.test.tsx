import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceDangerSection } from "./workspace-settings-danger";

describe("WorkspaceDangerSection", () => {
  it("calls onDelete when Delete workspace is clicked", () => {
    const onDelete = vi.fn();
    render(<WorkspaceDangerSection busy={false} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete workspace" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("disables delete while busy", () => {
    render(<WorkspaceDangerSection busy onDelete={() => undefined} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Delete workspace"
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});
