import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceMembersSection } from "./workspace-settings-members";
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

const baseProps = {
  selectedIds: new Set<string>(),
  membersError: null as string | null,
  editingDepends: null as string | null,
  busy: false,
  onToggleSelected: vi.fn(),
  onAddSelected: vi.fn(),
  onEditDepends: vi.fn(),
  onSaveDepends: vi.fn(),
  onCancelEdit: vi.fn(),
  onRemoveMember: vi.fn()
};

describe("WorkspaceMembersSection", () => {
  it("shows empty copy when there are no members", () => {
    render(
      <WorkspaceMembersSection
        {...baseProps}
        workspace={emptyWorkspace()}
        available={[]}
      />
    );
    expect(screen.getByText("Projects in this workspace")).toBeTruthy();
    expect(
      screen.getByText(/No projects yet. Pick from available projects below./i)
    ).toBeTruthy();
  });

  it("toggles available projects and adds selected", () => {
    const onToggleSelected = vi.fn();
    const onAddSelected = vi.fn();
    render(
      <WorkspaceMembersSection
        {...baseProps}
        workspace={emptyWorkspace()}
        available={[
          { id: "p1", name: "frontend", source: "local", status: "available" },
          { id: "p2", name: "backend", source: "github", status: "available" }
        ]}
        selectedIds={new Set(["p1"])}
        onToggleSelected={onToggleSelected}
        onAddSelected={onAddSelected}
      />
    );
    expect(screen.getByText("Add projects")).toBeTruthy();
    fireEvent.click(screen.getByText("backend"));
    expect(onToggleSelected).toHaveBeenCalledWith("p2");
    fireEvent.click(screen.getByRole("button", { name: /Add selected/i }));
    expect(onAddSelected).toHaveBeenCalledTimes(1);
  });

  it("lists members and removes one", () => {
    const onRemoveMember = vi.fn();
    render(
      <WorkspaceMembersSection
        {...baseProps}
        workspace={emptyWorkspace({
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
        })}
        available={[]}
        onRemoveMember={onRemoveMember}
      />
    );
    expect(screen.getAllByText("frontend").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/All connected projects are already in this workspace./i)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemoveMember).toHaveBeenCalledWith("p1");
  });
});
