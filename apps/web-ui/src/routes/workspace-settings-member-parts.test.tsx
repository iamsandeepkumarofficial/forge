import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import {
  MemberCardHeader,
  useMemberDependsDraft
} from "./workspace-settings-member-parts";
import type { WorkspaceMember } from "../lib/workspaces-api.js";

function member(overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: "m1",
    workspaceId: "w1",
    projectId: "p1",
    repoName: "api",
    sortOrder: 0,
    dependsOn: ["web"],
    env: {},
    createdAt: "2024-01-01T00:00:00.000Z",
    project: {
      id: "p1",
      name: "API Service",
      source: "github",
      dedupeKey: "github:api",
      status: "ready"
    },
    ...overrides
  };
}

describe("MemberCardHeader", () => {
  it("shows member details and actions", () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(
      <MemberCardHeader
        member={member()}
        editing={false}
        busy={false}
        showDepends
        onEdit={onEdit}
        onRemove={onRemove}
      />
    );
    expect(screen.getByText("API Service")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
    expect(screen.getByText("api")).toBeTruthy();
    expect(screen.getByText("web")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Depends on" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("useMemberDependsDraft", () => {
  it("toggles dependency names", () => {
    const { result } = renderHook(() =>
      useMemberDependsDraft({ editing: true, dependsOn: ["web"] })
    );
    expect(result.current.draft.has("web")).toBe(true);
    act(() => {
      result.current.toggleDep("web");
    });
    expect(result.current.draft.has("web")).toBe(false);
    act(() => {
      result.current.toggleDep("db");
    });
    expect(result.current.draft.has("db")).toBe(true);
  });
});
