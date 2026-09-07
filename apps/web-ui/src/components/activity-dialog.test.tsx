import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ActivityDialog } from "./activity-dialog.js";

vi.mock("../lib/runtime-activity-api.js", () => ({
  fetchRuntimeActivity: vi.fn(async () => ({
    runtimeKind: "host",
    sessions: [
      {
        sessionId: "sess-1",
        chatId: "chat-1",
        projectId: "proj-1",
        workspaceId: null,
        title: "Demo chat",
        status: "ready",
        running: true,
        runtime: "host"
      }
    ],
    apps: [],
    ports: [{ sessionId: "sess-1", ports: [40001] }]
  })),
  stopRuntimeSession: vi.fn(),
  stopRuntimeApp: vi.fn(),
  chatHrefForSession: () => "/projects/proj-1/chats/chat-1"
}));

describe("ActivityDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists sessions and runtime kind", async () => {
    render(
      <MemoryRouter>
        <ActivityDialog onClose={vi.fn()} />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Demo chat")).toBeTruthy();
    });
    expect(screen.getByText(/Runtime: host/i)).toBeTruthy();
    expect(screen.getByText(/Ports: 40001/i)).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Stop")).toBeTruthy();
  });
});
