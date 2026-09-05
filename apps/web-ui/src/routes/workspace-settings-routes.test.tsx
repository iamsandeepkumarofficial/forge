import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceRoutesSection } from "./workspace-settings-routes";

const baseProps = {
  routesDirty: false,
  routesError: null as string | null,
  suggestedRoutes: [] as Array<{ pathPrefix: string; target: string }>,
  memberRepoNames: [] as string[],
  membersEmpty: true,
  busy: false,
  onApplySuggested: vi.fn(),
  onUpdateRow: vi.fn(),
  onRemoveRow: vi.fn(),
  onAddRoute: vi.fn(),
  onSaveRoutes: vi.fn()
};

describe("WorkspaceRoutesSection", () => {
  it("shows empty suggest copy when there are no members", () => {
    render(<WorkspaceRoutesSection {...baseProps} routeRows={[]} />);
    expect(screen.getByText("Network plane")).toBeTruthy();
    expect(
      screen.getByText(/Add projects above to suggest network-plane routes./i)
    ).toBeTruthy();
  });

  it("applies suggested routes when none are configured", () => {
    const onApplySuggested = vi.fn();
    render(
      <WorkspaceRoutesSection
        {...baseProps}
        routeRows={[]}
        membersEmpty={false}
        memberRepoNames={["frontend", "backend"]}
        suggestedRoutes={[
          { pathPrefix: "/api", target: "backend" },
          { pathPrefix: "/", target: "frontend" }
        ]}
        onApplySuggested={onApplySuggested}
      />
    );
    expect(screen.getByText("Suggested routes")).toBeTruthy();
    expect(screen.getByText("/api")).toBeTruthy();
    expect(screen.getByText("backend")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use suggested" }));
    expect(onApplySuggested).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Use suggested routes" })
    );
    expect(onApplySuggested).toHaveBeenCalledTimes(2);
  });

  it("edits path and saves dirty routes", () => {
    const onUpdateRow = vi.fn();
    const onSaveRoutes = vi.fn();
    render(
      <WorkspaceRoutesSection
        {...baseProps}
        routeRows={[{ key: "r1", pathPrefix: "/", target: "frontend" }]}
        routesDirty
        membersEmpty={false}
        memberRepoNames={["frontend"]}
        onUpdateRow={onUpdateRow}
        onSaveRoutes={onSaveRoutes}
      />
    );
    fireEvent.change(screen.getByDisplayValue("/"), {
      target: { value: "/api" }
    });
    expect(onUpdateRow).toHaveBeenCalledWith("r1", { pathPrefix: "/api" });
    fireEvent.click(screen.getByRole("button", { name: /Save routes/i }));
    expect(onSaveRoutes).toHaveBeenCalledTimes(1);
  });
});
