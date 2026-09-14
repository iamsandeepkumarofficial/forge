import { useEffect } from "react";
import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";
import { streamIdForShellTab } from "../../lib/terminal-session-client.js";
import {
  fitTerminal,
  useContainWheel,
  useXtermHost
} from "./terminal-xterm-helpers.js";
import { useShellStream } from "./use-xterm-stream.js";
import "@xterm/xterm/css/xterm.css";
import "./terminal-xterm.css";

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
  const { hostRef, termRef, fitRef } = useXtermHost({ resetKey: tabId });
  const { connected, error } = useShellStream({
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
      client,
      stream
    });
  }, [visible, active, fitSignal, client, stream, fitRef, termRef]);

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
