import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceOverviewPanel } from "./workspace-settings-overview";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";

function emptyWorkspace(overrides?: Partial<WorkspaceDetail>): WorkspaceDetail {
  return {
    id: "w1",
    userId: "u1",
    name: "Demo Forge",
    routes: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    lastActivityAt: "2024-01-01T00:00:00.000Z",
    members: [],
    ...overrides
  };
}

function overviewProps(
  overrides: Partial<Parameters<typeof WorkspaceOverviewPanel>[0]> = {}
) {
  return {
    workspace: emptyWorkspace({
      members: [
        {
          id: "m1",
          workspaceId: "w1",
          projectId: "p1",
          repoName: "frontend",
          sortOrder: 0,
          dependsOn: [],
          env: {},
          createdAt: "2024-01-01T00:00:00.000Z",
          project: {
            id: "p1",
            name: "frontend",
            source: "local",
            dedupeKey: "p1",
            status: "available"
          }
        }
      ]
    }),
    projects: [],
    busy: false,
    healthStatus: "ready",
    healthFindings: [],
    setupCtaMode: "analyze" as const,
    setupDrawer: null,
    setupDrawerOpen: false,
    onSetup: vi.fn(),
    membersError: null,
    editingDepends: null,
    selectedIds: new Set<string>(),
    available: [
      { id: "p2", name: "backend", source: "github", status: "available" }
    ],
    routeRows: [{ key: "r1", pathPrefix: "/", target: "frontend" }],
    routesDirty: false,
    routesError: null,
    suggestedRoutes: [],
    onToggleSelected: vi.fn(),
    onAddSelected: vi.fn(),
    onEditDepends: vi.fn(),
    onSaveDepends: vi.fn(),
    onCancelEdit: vi.fn(),
    onRemoveMember: vi.fn(),
    onApplySuggested: vi.fn(),
    onUpdateRow: vi.fn(),
    onRemoveRow: vi.fn(),
    onAddRoute: vi.fn(),
    onSaveRoutes: vi.fn(),
    onDelete: vi.fn(),
    ...overrides
  };
}

describe("WorkspaceOverviewPanel", () => {
  it("composes health, members, routes, and danger sections", () => {
    render(<WorkspaceOverviewPanel {...overviewProps()} />);
    expect(screen.getByText("Workspace health")).toBeTruthy();
    expect(screen.getByText("Projects in this workspace")).toBeTruthy();
    expect(screen.getByText("Network plane")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Delete workspace" })
    ).toBeTruthy();
    expect(screen.getAllByText("frontend").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("/")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeTruthy();
  });

  it("wires Analyze and Delete callbacks", () => {
    const onSetup = vi.fn();
    const onDelete = vi.fn();
    render(
      <WorkspaceOverviewPanel {...overviewProps({ onSetup, onDelete })} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(onSetup).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Delete workspace" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("shows Fix CTA and findings when unhealthy", () => {
    render(
      <WorkspaceOverviewPanel
        {...overviewProps({
          setupCtaMode: "fix",
          healthStatus: "warnings",
          healthFindings: [
            {
              code: "missing-env-key",
              severity: "warning",
              message: "JWT_SECRET missing"
            }
          ]
        })}
      />
    );
    expect(screen.getByRole("button", { name: "Fix" })).toBeTruthy();
    expect(screen.getByText(/JWT_SECRET missing/)).toBeTruthy();
  });
});
