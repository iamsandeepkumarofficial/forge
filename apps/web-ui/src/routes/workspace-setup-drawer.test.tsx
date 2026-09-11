import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  WorkspaceSetupDrawer,
  setupCtaModeFromFindings,
  initialPromptForSetupMode,
  shouldSeedSetupPrompt,
  ensureSetupChat,
  WORKSPACE_SETUP_ANALYZE_PROMPT,
  WORKSPACE_SETUP_FIX_PROMPT
} from "./workspace-setup-drawer";

const analyzeWorkspace = vi.fn();
const getWorkspaceHealth = vi.fn();
const listWorkspaceChats = vi.fn();
const createWorkspaceChat = vi.fn();
const fetchWorkspaceChat = vi.fn();
const startSession = vi.fn().mockResolvedValue(undefined);
const fetchSessionMessages = vi.fn();
const fetchRunningTurn = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  analyzeWorkspace: (...args: unknown[]) => analyzeWorkspace(...args),
  getWorkspaceHealth: (...args: unknown[]) => getWorkspaceHealth(...args),
  listWorkspaceChats: (...args: unknown[]) => listWorkspaceChats(...args),
  createWorkspaceChat: (...args: unknown[]) => createWorkspaceChat(...args),
  fetchWorkspaceChat: (...args: unknown[]) => fetchWorkspaceChat(...args)
}));

vi.mock("../lib/projects-api.js", () => ({
  startSession: (...args: unknown[]) => startSession(...args)
}));

vi.mock("../lib/chat-agent.js", () => ({
  fetchSessionMessages: (...args: unknown[]) => fetchSessionMessages(...args),
  fetchRunningTurn: (...args: unknown[]) => fetchRunningTurn(...args)
}));

vi.mock("./chat-workbench/chat-pane.js", () => ({
  ChatPane: (props: { initialPrompt?: string }) => (
    <div data-testid="chat-pane">{props.initialPrompt ?? ""}</div>
  )
}));

describe("setupCtaModeFromFindings", () => {
  it("returns analyze when no warning/error findings", () => {
    expect(setupCtaModeFromFindings([])).toBe("analyze");
    expect(
      setupCtaModeFromFindings([{ code: "x", severity: "info", message: "ok" }])
    ).toBe("analyze");
  });

  it("returns fix when warning or error findings exist", () => {
    expect(
      setupCtaModeFromFindings([
        { code: "x", severity: "warning", message: "missing env" }
      ])
    ).toBe("fix");
    expect(
      setupCtaModeFromFindings([
        { code: "x", severity: "error", message: "blocked" }
      ])
    ).toBe("fix");
  });

  it("returns fix while health is computing even without findings", () => {
    expect(setupCtaModeFromFindings([], "computing")).toBe("fix");
  });
});

describe("initialPromptForSetupMode", () => {
  it("maps analyze vs fix prompts", () => {
    expect(initialPromptForSetupMode("analyze")).toBe(
      WORKSPACE_SETUP_ANALYZE_PROMPT
    );
    expect(initialPromptForSetupMode("fix")).toBe(WORKSPACE_SETUP_FIX_PROMPT);
    expect(WORKSPACE_SETUP_ANALYZE_PROMPT).toContain("numbered task list");
    expect(WORKSPACE_SETUP_ANALYZE_PROMPT).toContain(
      "Do not stop after the task list"
    );
  });
});

describe("shouldSeedSetupPrompt", () => {
  it("never seeds while a turn is running", () => {
    expect(
      shouldSeedSetupPrompt({
        mode: "fix",
        turnRunning: true,
        lastUserText: null
      })
    ).toBe(false);
  });

  it("seeds empty chat", () => {
    expect(
      shouldSeedSetupPrompt({
        mode: "fix",
        turnRunning: false,
        lastUserText: null
      })
    ).toBe(true);
  });

  it("does not re-seed the same mode", () => {
    expect(
      shouldSeedSetupPrompt({
        mode: "fix",
        turnRunning: false,
        lastUserText: WORKSPACE_SETUP_FIX_PROMPT
      })
    ).toBe(false);
    expect(
      shouldSeedSetupPrompt({
        mode: "analyze",
        turnRunning: false,
        lastUserText: WORKSPACE_SETUP_ANALYZE_PROMPT
      })
    ).toBe(false);
  });

  it("seeds Fix after an Analyze turn", () => {
    expect(
      shouldSeedSetupPrompt({
        mode: "fix",
        turnRunning: false,
        lastUserText: WORKSPACE_SETUP_ANALYZE_PROMPT
      })
    ).toBe(true);
  });
});

describe("WorkspaceSetupDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listWorkspaceChats.mockResolvedValue([]);
    createWorkspaceChat.mockResolvedValue({
      id: "c1",
      sessionId: "s1",
      title: "Workspace setup"
    });
    fetchWorkspaceChat.mockResolvedValue({
      id: "c1",
      sessionId: "s1",
      title: "Workspace setup"
    });
    fetchSessionMessages.mockResolvedValue([]);
    fetchRunningTurn.mockResolvedValue(null);
    analyzeWorkspace.mockResolvedValue({
      workspaceId: "w1",
      status: "computing",
      report: {},
      computedAt: null
    });
    getWorkspaceHealth.mockResolvedValue({
      workspaceId: "w1",
      status: "ready",
      report: { findings: [] },
      computedAt: null
    });
  });

  it("opens setup chat with analyze prompt and refreshes shadows", async () => {
    const onHealthUpdated = vi.fn();
    render(
      <MemoryRouter>
        <WorkspaceSetupDrawer
          workspaceId="w1"
          mode="analyze"
          open
          onClose={vi.fn()}
          onHealthUpdated={onHealthUpdated}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId("workspace-setup-drawer")).toBeTruthy();
    expect(screen.getByText("Analyze workspace")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("chat-pane").textContent).toContain(
        "numbered task list"
      );
    });
    expect(createWorkspaceChat).toHaveBeenCalledWith({
      workspaceId: "w1",
      title: "Workspace setup"
    });
    expect(analyzeWorkspace).toHaveBeenCalledWith("w1");
    await waitFor(() => {
      expect(onHealthUpdated).toHaveBeenCalled();
    });
  });

  it("reuses existing Workspace setup chat for fix mode", async () => {
    listWorkspaceChats.mockResolvedValue([
      { id: "c-existing", sessionId: "s-existing", title: "Workspace setup" }
    ]);
    fetchWorkspaceChat.mockResolvedValue({
      id: "c-existing",
      sessionId: "s-existing",
      title: "Workspace setup"
    });

    render(
      <MemoryRouter>
        <WorkspaceSetupDrawer
          workspaceId="w1"
          mode="fix"
          open
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("chat-pane").textContent).toContain(
        "fix setup blockers"
      );
    });
    expect(createWorkspaceChat).not.toHaveBeenCalled();
    expect(fetchWorkspaceChat).toHaveBeenCalledWith("w1", "c-existing");
  });

  it("opens without seeding when a turn is already running", async () => {
    listWorkspaceChats.mockResolvedValue([
      { id: "c1", sessionId: "s1", title: "Workspace setup" }
    ]);
    fetchWorkspaceChat.mockResolvedValue({
      id: "c1",
      sessionId: "s1",
      title: "Workspace setup"
    });
    fetchSessionMessages.mockResolvedValue([
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: WORKSPACE_SETUP_FIX_PROMPT }]
      }
    ]);
    fetchRunningTurn.mockResolvedValue({
      id: "t1",
      workflowId: "chat-s1-t1",
      status: "running"
    });

    render(
      <MemoryRouter>
        <WorkspaceSetupDrawer
          workspaceId="w1"
          mode="fix"
          open
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("chat-pane")).toBeTruthy();
    });
    expect(screen.getByTestId("chat-pane").textContent).toBe("");
  });

  it("closes when backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <WorkspaceSetupDrawer
          workspaceId="w1"
          mode="analyze"
          open
          onClose={onClose}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText("Close setup drawer"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not re-call startSession when onHealthUpdated identity changes", async () => {
    listWorkspaceChats.mockResolvedValue([
      { id: "c1", sessionId: "s1", title: "Workspace setup" }
    ]);
    fetchWorkspaceChat.mockResolvedValue({
      id: "c1",
      sessionId: "s1",
      title: "Workspace setup"
    });
    getWorkspaceHealth.mockResolvedValue({
      workspaceId: "w1",
      status: "ready",
      report: { findings: [] },
      computedAt: null
    });

    const { rerender } = render(
      <MemoryRouter>
        <WorkspaceSetupDrawer
          workspaceId="w1"
          mode="fix"
          open
          onClose={vi.fn()}
          onHealthUpdated={() => undefined}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("chat-pane")).toBeTruthy();
    });
    const callsAfterReady = startSession.mock.calls.length;
    expect(callsAfterReady).toBeGreaterThanOrEqual(1);

    rerender(
      <MemoryRouter>
        <WorkspaceSetupDrawer
          workspaceId="w1"
          mode="fix"
          open
          onClose={vi.fn()}
          onHealthUpdated={() => undefined}
        />
      </MemoryRouter>
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(startSession.mock.calls.length).toBe(callsAfterReady);
  });

  it("coalesces concurrent ensureSetupChat calls into one create", async () => {
    listWorkspaceChats.mockResolvedValue([]);
    let releaseCreate: (() => void) | undefined;
    createWorkspaceChat.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseCreate = () =>
            resolve({
              id: "c1",
              sessionId: "s1",
              title: "Workspace setup"
            });
        })
    );
    const first = ensureSetupChat("w-mutex");
    const second = ensureSetupChat("w-mutex");
    await waitFor(() => {
      expect(createWorkspaceChat).toHaveBeenCalledTimes(1);
    });
    releaseCreate?.();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(createWorkspaceChat).toHaveBeenCalledTimes(1);
  });
});
