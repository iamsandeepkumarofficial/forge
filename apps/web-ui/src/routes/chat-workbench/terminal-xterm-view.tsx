import { useEffect, useRef, useState, type RefObject } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import "./terminal-xterm.css";
import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";
import {
  streamIdForAppTab,
  streamIdForJobTab,
  streamIdForShellTab
} from "../../lib/terminal-session-client.js";
import { xtermWriteDelta } from "./terminal-xterm.js";

const MIN_COLS = 2;
const MIN_ROWS = 2;

function createTerminal(): { term: Terminal; fit: FitAddon } {
  const term = new Terminal({
    cursorBlink: true,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    scrollback: 5000,
    theme: {
      background: "#030712",
      foreground: "#f3f4f6"
    }
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon());
  return { term, fit };
}

function sendResize(
  client: TerminalSessionClient,
  stream: string,
  cols: number,
  rows: number
): void {
  client.resize(stream, Math.max(MIN_COLS, cols), Math.max(MIN_ROWS, rows));
}

function useContainWheel(hostRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const stopWheel = (event: WheelEvent) => {
      event.stopPropagation();
    };
    host.addEventListener("wheel", stopWheel, { passive: true });
    return () => host.removeEventListener("wheel", stopWheel);
  }, [hostRef]);
}

function fitTerminal(
  fit: FitAddon | null,
  term: Terminal | null,
  client: TerminalSessionClient | null,
  stream: string
): void {
  if (!fit || !term) return;
  try {
    fit.fit();
  } catch {
    void 0;
  }
  if (client) {
    sendResize(client, stream, term.cols, term.rows);
  }
}

export function ShellXtermPane(options: {
  client: TerminalSessionClient;
  tabId: string;
  active: boolean;
  visible: boolean;
  fitSignal: number;
  onConnectedChange?: (connected: boolean) => void;
}) {
  const { client, tabId, active, visible, fitSignal, onConnectedChange } =
    options;
  const stream = streamIdForShellTab(tabId);
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useContainWheel(hostRef);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const { term, fit } = createTerminal();
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;
    return () => {
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      setConnected(false);
    };
  }, [tabId]);

  useEffect(() => {
    if (!visible || !active) {
      setConnected(false);
      return undefined;
    }
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return undefined;
    setConnected(false);
    setError(null);
    const unsubscribe = client.subscribe(stream, {
      onReady: () => {
        setConnected(true);
        setError(null);
        fitTerminal(fit, term, client, stream);
      },
      onData: (chunk) => {
        setConnected(true);
        setError(null);
        term.write(chunk);
      },
      onError: (message) => {
        setConnected(false);
        setError(message || "Terminal connection failed");
      },
      onExited: () => {
        setConnected(false);
        setError("Terminal session ended");
      }
    });
    const onData = term.onData((data) => {
      client.sendStdin(stream, data);
    });
    return () => {
      onData.dispose();
      unsubscribe();
      setConnected(false);
    };
  }, [client, stream, active, visible]);

  useEffect(() => {
    if (!visible || !active) return;
    fitTerminal(fitRef.current, termRef.current, client, stream);
  }, [visible, active, fitSignal, client, stream]);

  useEffect(() => {
    onConnectedChange?.(connected);
  }, [connected, onConnectedChange]);

  return (
    <div className="terminal-xterm-host relative h-full min-h-0 bg-gray-950 p-1">
      <div
        ref={hostRef}
        className="h-full min-h-0 w-full"
        data-testid={`shell-xterm-${tabId}`}
      />
      {!connected ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gray-950/80 px-4 text-center font-mono text-[0.7rem] text-gray-400">
          <span>{error ? "Reconnecting…" : "Connecting…"}</span>
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

function LogFollowXtermPane(options: {
  client: TerminalSessionClient;
  stream: string;
  tabId: string;
  active: boolean;
  /** When true (dock open), keep subscribe warm even if tab is not focused. */
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
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [hasOutput, setHasOutput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hadReadyRef = useRef(false);

  useContainWheel(hostRef);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const { term, fit } = createTerminal();
    term.options.disableStdin = true;
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;
    return () => {
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      setConnected(false);
      setHasOutput(false);
    };
  }, [stream, tabId]);

  useEffect(() => {
    // Warm subscribe whenever the dock is open — do not require the tab to be
    // focused, so boot/crash lines are not missed while on Shell.
    if (!visible) {
      hadReadyRef.current = false;
      setConnected(false);
      return undefined;
    }
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return undefined;
    setError(null);
    const unsubscribe = client.subscribe(stream, {
      onReady: () => {
        if (hadReadyRef.current) {
          term.clear();
          setHasOutput(false);
        }
        hadReadyRef.current = true;
        setConnected(true);
        setError(null);
        if (active) fitTerminal(fit, term, null, stream);
      },
      onData: (chunk) => {
        setConnected(true);
        setHasOutput(true);
        setError(null);
        term.write(chunk);
      },
      onError: (message) => {
        setConnected(false);
        setError(message || "Log stream failed");
      },
      onExited: () => {
        setConnected(false);
      }
    });
    return () => {
      unsubscribe();
      setConnected(false);
    };
  }, [client, stream, visible, active]);

  useEffect(() => {
    if (!visible || !active) return;
    fitTerminal(fitRef.current, termRef.current, null, stream);
  }, [visible, active, fitSignal, stream]);

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

export function FollowXtermPane(options: {
  tabId: string;
  active: boolean;
  visible: boolean;
  fitSignal: number;
  text: string;
  pending: boolean;
  emptyMessage: string;
}) {
  const {
    tabId,
    active,
    visible,
    fitSignal,
    text,
    pending,
    emptyMessage
  } = options;
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const writtenRef = useRef("");

  useContainWheel(hostRef);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const { term, fit } = createTerminal();
    term.options.disableStdin = true;
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;
    return () => {
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      writtenRef.current = "";
    };
  }, [tabId]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const pendingMessage = pending
      ? "Waiting for output…\r\n"
      : emptyMessage;
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
    if (active) {
      term.scrollToBottom();
    }
  }, [text, emptyMessage, pending, active]);

  useEffect(() => {
    if (!visible || !active) return;
    fitTerminal(fitRef.current, termRef.current, null, "");
  }, [visible, active, fitSignal]);

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
