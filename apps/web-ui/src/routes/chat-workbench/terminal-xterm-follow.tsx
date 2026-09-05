import { useEffect, useRef } from "react";
import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";
import {
  streamIdForAppTab,
  streamIdForJobTab
} from "../../lib/terminal-session-client.js";
import { xtermWriteDelta } from "./terminal-xterm.js";
import {
  fitTerminal,
  useContainWheel,
  useXtermHost
} from "./terminal-xterm-helpers.js";
import { useLogFollowStream } from "./use-xterm-stream.js";
import "@xterm/xterm/css/xterm.css";
import "./terminal-xterm.css";

function LogFollowXtermPane(options: {
  client: TerminalSessionClient;
  stream: string;
  tabId: string;
  active: boolean;
  visible: boolean;
  running?: boolean;
  fitSignal: number;
  onConnectedChange?: (connected: boolean) => void;
}) {
  const {
    client,
    stream,
    tabId,
    active,
    visible,
    running = false,
    fitSignal,
    onConnectedChange
  } = options;
  const { hostRef, termRef, fitRef } = useXtermHost({
    resetKey: `${stream}:${tabId}`,
    disableStdin: true
  });
  const { connected, hasOutput, error } = useLogFollowStream({
    client,
    stream,
    active,
    visible,
    termRef,
    fitRef
  });
  useContainWheel(hostRef);

  useEffect(() => {
    if (!visible || !active) return;
    fitTerminal({
      fit: fitRef.current,
      term: termRef.current,
      client: null,
      stream
    });
  }, [visible, active, fitSignal, stream, fitRef, termRef]);

  useEffect(() => {
    onConnectedChange?.(connected);
  }, [connected, onConnectedChange]);

  const waitingLabel = running ? "Starting…" : "Waiting for output…";
  const showOverlay = !hasOutput && !error;
  return (
    <div className="terminal-xterm-host relative h-full min-h-0 bg-gray-950 p-1">
      <div className="pointer-events-none absolute right-2 top-1 z-10 rounded bg-gray-900/80 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-gray-400">
        read-only
      </div>
      <div
        ref={hostRef}
        className="h-full min-h-0 w-full"
        data-testid={`follow-xterm-${tabId}`}
      />
      {showOverlay ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gray-950/80 px-4 text-center font-mono text-[0.7rem] text-gray-400">
          <span>{error ? "Reconnecting…" : waitingLabel}</span>
          {error ? <span className="text-red-400">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function AppLogXtermPane(options: {
  client: TerminalSessionClient;
  appName: string;
  tabId: string;
  active: boolean;
  visible: boolean;
  running?: boolean;
  fitSignal: number;
  onConnectedChange?: (connected: boolean) => void;
}) {
  return (
    <LogFollowXtermPane
      client={options.client}
      stream={streamIdForAppTab(options.tabId)}
      tabId={options.tabId}
      active={options.active}
      visible={options.visible}
      running={options.running}
      fitSignal={options.fitSignal}
      onConnectedChange={options.onConnectedChange}
    />
  );
}

export function JobLogXtermPane(options: {
  client: TerminalSessionClient;
  jobName: string;
  tabId: string;
  active: boolean;
  visible: boolean;
  running?: boolean;
  fitSignal: number;
  onConnectedChange?: (connected: boolean) => void;
}) {
  return (
    <LogFollowXtermPane
      client={options.client}
      stream={streamIdForJobTab(options.jobName)}
      tabId={options.tabId}
      active={options.active}
      visible={options.visible}
      running={options.running}
      fitSignal={options.fitSignal}
      onConnectedChange={options.onConnectedChange}
    />
  );
}

export function FollowXtermPane(options: {
  tabId: string;
  active: boolean;
  visible: boolean;
  fitSignal: number;
  text: string;
  pending: boolean;
  emptyMessage: string;
}) {
  const { tabId, active, visible, fitSignal, text, pending, emptyMessage } =
    options;
  const { hostRef, termRef, fitRef } = useXtermHost({
    resetKey: tabId,
    disableStdin: true
  });
  const writtenRef = useRef("");
  useContainWheel(hostRef);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const pendingMessage = pending ? "Waiting for output…\r\n" : emptyMessage;
    const next = text.trim() ? text.replace(/\n/g, "\r\n") : pendingMessage;
    const delta = xtermWriteDelta(writtenRef.current, next);
    if (delta.reset) {
      term.reset();
      writtenRef.current = "";
    }
    if (delta.chunk) {
      term.write(delta.chunk);
      writtenRef.current = next;
    }
    if (active) term.scrollToBottom();
  }, [text, emptyMessage, pending, active, termRef]);

  useEffect(() => {
    if (!visible || !active) return;
    fitTerminal({
      fit: fitRef.current,
      term: termRef.current,
      client: null,
      stream: ""
    });
  }, [visible, active, fitSignal, fitRef, termRef]);

  return (
    <div className="terminal-xterm-host relative h-full min-h-0 bg-gray-950 p-1">
      <div className="pointer-events-none absolute right-2 top-1 z-10 rounded bg-gray-900/80 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-gray-400">
        read-only
      </div>
      <div
        ref={hostRef}
        className="h-full min-h-0 w-full"
        data-testid={`follow-xterm-${tabId}`}
      />
    </div>
  );
}
