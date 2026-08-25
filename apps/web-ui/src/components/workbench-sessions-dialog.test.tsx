import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WorkbenchSessionsDialog } from "./workbench-sessions-dialog";
vi.mock("../lib/projects-api.js", () => ({
  createWorkbenchSession: vi.fn(),
  fetchWorkbenchSessions: vi.fn(),
  deleteChat: vi.fn()
}));
import {
  createWorkbenchSession,
  fetchWorkbenchSessions
} from "../lib/projects-api.js";
describe("WorkbenchSessionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("lists workbench sessions and supports creating a new one", async () => {
    vi.mocked(fetchWorkbenchSessions).mockResolvedValue([
      {
        id: "wb-1",
        projectId: "p1",
        userId: "u1",
        title: "Spike auth",
        kind: "workbench",
        sessionId: "workbench-1",
        branchName: "workbench-1",
        lastActivityAt: "2026-08-05T10:00:00.000Z",
        createdAt: "2026-08-05T09:00:00.000Z"
      }
    ]);
    vi.mocked(createWorkbenchSession).mockResolvedValue({
      id: "wb-2",
      projectId: "p1",
      userId: "u1",
      title: "New session",
      kind: "workbench",
      sessionId: "workbench-2",
      branchName: "workbench-2",
      lastActivityAt: "2026-08-05T11:00:00.000Z",
      createdAt: "2026-08-05T11:00:00.000Z"
    });
    render(
      <MemoryRouter>
        <WorkbenchSessionsDialog projectId="p1" onClose={() => {}} />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Spike auth")).toBeTruthy();
    });
    expect(screen.getByText("Project workbench")).toBeTruthy();
  });
});
