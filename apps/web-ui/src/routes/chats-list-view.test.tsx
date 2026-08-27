import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatsListView } from "./chats-list-view";
import type { ChatsPageState } from "./use-chats-page";

const recentIso = new Date().toISOString();
const staleIso = new Date(
  Date.now() - 20 * 24 * 60 * 60 * 1000
).toISOString();

const state = {
  projectId: "p1",
  project: {
    id: "p1",
    name: "Forge App",
    status: "available"
  },
  sessions: [
    {
      id: "s1",
      projectId: "p1",
      userId: "u1",
      title: "Workbench A",
      kind: "workbench",
      sessionId: "sess-1",
      branchName: "forge/workbench-a",
      lastActivityAt: recentIso,
      createdAt: recentIso
    },
    {
      id: "s2",
      projectId: "p1",
      userId: "u1",
      title: "Old session",
      kind: "workbench",
      sessionId: "sess-2",
      branchName: "forge/old",
      lastActivityAt: staleIso,
      createdAt: staleIso
    }
  ],
  error: null,
  deletingId: null,
  navigate: vi.fn(),
  handleDelete: vi.fn()
} as unknown as ChatsPageState;

describe("ChatsListView", () => {
  it("lists sessions with branch badges and resume card", () => {
    render(<ChatsListView state={state} />);
    expect(screen.getAllByText("Workbench A").length).toBeGreaterThan(0);
    expect(screen.getByText("Continue where you left off")).toBeTruthy();
    expect(screen.getAllByText("forge/workbench-a").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Search chats")).toBeTruthy();
  });

  it("surfaces stale sessions under needs attention", () => {
    render(<ChatsListView state={state} />);
    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(screen.getByText('Resume "Old session"')).toBeTruthy();
  });
});
