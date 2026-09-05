import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemberCard } from "./workspace-settings-member-card";
import type { WorkspaceMember } from "../lib/workspaces-api.js";

function member(overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: "m1",
    workspaceId: "w1",
    projectId: "p1",
    repoName: "api",
    sortOrder: 0,
    dependsOn: [],
    env: {},
    createdAt: "2024-01-01T00:00:00.000Z",
    project: {
      id: "p1",
      name: "API Service",
      source: "local",
      dedupeKey: "local:api",
      status: "ready"
    },
    ...overrides
  };
}

describe("MemberCard", () => {
  it("removes a member", () => {
    const onRemove = vi.fn();
    render(
      <MemberCard
        member={member()}
        allRepoNames={["api", "web"]}
        editing={false}
        busy={false}
        onEdit={() => undefined}
        onSaveDepends={() => undefined}
        onCancelEdit={() => undefined}
        onRemove={onRemove}
      />
    );
    expect(screen.getByText("API Service")).toBeTruthy();
    expect(screen.getByText("Local")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("edits and saves dependencies", () => {
    const onSaveDepends = vi.fn();
    const onCancelEdit = vi.fn();
    render(
      <MemberCard
        member={member({ dependsOn: ["web"] })}
        allRepoNames={["api", "web"]}
        editing
        busy={false}
        onEdit={() => undefined}
        onSaveDepends={onSaveDepends}
        onCancelEdit={onCancelEdit}
        onRemove={() => undefined}
      />
    );
    expect(screen.getByText(/Start after these projects/i)).toBeTruthy();
    const dep = screen.getByRole("button", { name: "web" });
    expect(dep.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(dep);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveDepends).toHaveBeenCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });
});
