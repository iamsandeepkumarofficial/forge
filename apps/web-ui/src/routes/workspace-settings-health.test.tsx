import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceHealthSection } from "./workspace-settings-health";

describe("WorkspaceHealthSection", () => {
  it("shows empty findings and Analyze CTA", () => {
    const onSetup = vi.fn();
    render(
      <WorkspaceHealthSection
        healthStatus="ready"
        healthFindings={[]}
        setupCtaMode="analyze"
        setupDrawer={null}
        setupDrawerOpen={false}
        membersEmpty={false}
        onSetup={onSetup}
      />
    );
    expect(screen.getByText("Workspace health")).toBeTruthy();
    expect(screen.getByText("ready")).toBeTruthy();
    expect(screen.getByText(/No issues reported yet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(onSetup).toHaveBeenCalledTimes(1);
  });

  it("lists findings and shows Fix while open", () => {
    render(
      <WorkspaceHealthSection
        healthStatus="blocked"
        healthFindings={[
          {
            severity: "error",
            code: "missing_env",
            message: "DATABASE_URL missing",
            hint: "Add it in Parameter store",
            repo: "api"
          }
        ]}
        setupCtaMode="fix"
        setupDrawer="fix"
        setupDrawerOpen
        membersEmpty={false}
        onSetup={() => undefined}
      />
    );
    expect(screen.getByText("blocked")).toBeTruthy();
    expect(screen.getByText(/DATABASE_URL missing/)).toBeTruthy();
    expect(screen.getByText(/Add it in Parameter store/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Fixing…" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("disables CTA when members are empty", () => {
    render(
      <WorkspaceHealthSection
        healthStatus={null}
        healthFindings={[]}
        setupCtaMode="fix"
        setupDrawer={null}
        setupDrawerOpen={false}
        membersEmpty
        onSetup={() => undefined}
      />
    );
    expect(
      (screen.getByRole("button", { name: "Fix" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
