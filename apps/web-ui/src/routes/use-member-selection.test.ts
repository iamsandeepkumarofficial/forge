import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMemberSelection } from "./use-member-selection";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";
import type { ProjectSummary } from "../lib/projects-api.js";

const workspace: WorkspaceDetail = {
  id: "w1",
  userId: "u1",
  name: "Demo",
  routes: [],
  createdAt: "",
  lastActivityAt: "",
  members: [
    {
      id: "m1",
      workspaceId: "w1",
      projectId: "p1",
      repoName: "p1",
      sortOrder: 0,
      dependsOn: [],
      env: {},
      createdAt: "",
      project: {
        id: "p1",
        name: "p1",
        source: "local",
        dedupeKey: "p1",
        status: "ready"
      }
    }
  ]
};

const projects: ProjectSummary[] = [
  { id: "p1", name: "p1", source: "local", status: "ready" },
  { id: "p2", name: "p2", source: "local", status: "ready" }
];

describe("useMemberSelection", () => {
  it("lists projects that are not already members", () => {
    const { result } = renderHook(() =>
      useMemberSelection({ workspace, projects })
    );
    expect(result.current.available.map((p) => p.id)).toEqual(["p2"]);
  });

  it("toggles selected project ids", () => {
    const { result } = renderHook(() =>
      useMemberSelection({ workspace, projects })
    );
    act(() => {
      result.current.toggleSelected("p2");
    });
    expect([...result.current.selectedIds]).toEqual(["p2"]);
    act(() => {
      result.current.toggleSelected("p2");
    });
    expect([...result.current.selectedIds]).toEqual([]);
  });
});
