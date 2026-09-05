import { createRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppLogXtermPane, FollowXtermPane } from "./terminal-xterm-follow";
import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";

const followState = vi.hoisted(() => ({
  connected: true,
  hasOutput: false,
  error: null as string | null
}));

vi.mock("./terminal-xterm-helpers.js", () => ({
  fitTerminal: vi.fn(),
  useContainWheel: vi.fn(),
  useXtermHost: () => ({
    hostRef: createRef<HTMLDivElement | null>(),
    termRef: createRef(),
    fitRef: createRef()
  })
}));

vi.mock("./use-xterm-stream.js", () => ({
  useLogFollowStream: () => ({
    connected: followState.connected,
    hasOutput: followState.hasOutput,
    error: followState.error
  })
}));

vi.mock("./terminal-xterm.js", () => ({
  xtermWriteDelta: () => ({ reset: false, chunk: "" })
}));

vi.mock("../../lib/terminal-session-client.js", () => ({
  streamIdForAppTab: (tabId: string) => tabId,
  streamIdForJobTab: (name: string) => `job:${name}`
}));

const client = {} as TerminalSessionClient;

describe("FollowXtermPane", () => {
  it("renders a read-only follow host", () => {
    render(
      <FollowXtermPane
        tabId="follow-1"
        active
        visible
        fitSignal={0}
        text=""
        pending
        emptyMessage="No output"
      />
    );
    expect(screen.getByText("read-only")).toBeTruthy();
    expect(screen.getByTestId("follow-xterm-follow-1")).toBeTruthy();
  });
});

describe("AppLogXtermPane", () => {
  beforeEach(() => {
    followState.connected = true;
    followState.hasOutput = false;
    followState.error = null;
  });

  it("shows Waiting for output when idle with no output", () => {
    render(
      <AppLogXtermPane
        client={client}
        appName="web"
        tabId="app:web"
        active
        visible
        running={false}
        fitSignal={0}
      />
    );
    expect(screen.getByText("read-only")).toBeTruthy();
    expect(screen.getByText("Waiting for output…")).toBeTruthy();
    expect(screen.getByTestId("follow-xterm-app:web")).toBeTruthy();
  });

  it("shows Starting while the app is running without output", () => {
    render(
      <AppLogXtermPane
        client={client}
        appName="web"
        tabId="app:web"
        active
        visible
        running
        fitSignal={0}
      />
    );
    expect(screen.getByText("Starting…")).toBeTruthy();
  });

  it("hides the waiting overlay once output exists", () => {
    followState.hasOutput = true;
    render(
      <AppLogXtermPane
        client={client}
        appName="web"
        tabId="app:web"
        active
        visible
        running
        fitSignal={0}
      />
    );
    expect(screen.queryByText("Starting…")).toBeNull();
    expect(screen.queryByText("Waiting for output…")).toBeNull();
  });
});
