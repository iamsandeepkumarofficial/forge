import { useEffect, useRef, type RefObject } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";

const MIN_COLS = 2;
const MIN_ROWS = 2;
const FONT_SIZE = 12;
const SCROLLBACK = 5000;

export function createTerminal(): { term: Terminal; fit: FitAddon } {
  const term = new Terminal({
    cursorBlink: true,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: FONT_SIZE,
    scrollback: SCROLLBACK,
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

export function sendResize(options: {
  client: TerminalSessionClient;
  stream: string;
  cols: number;
  rows: number;
}): void {
  options.client.resize({
    stream: options.stream,
    cols: Math.max(MIN_COLS, options.cols),
    rows: Math.max(MIN_ROWS, options.rows)
  });
}

export function fitTerminal(options: {
  fit: FitAddon | null;
  term: Terminal | null;
  client: TerminalSessionClient | null;
  stream: string;
}): void {
  const { fit, term, client, stream } = options;
  if (!fit || !term) return;
  try {
    fit.fit();
  } catch {
    void 0;
  }
  if (client) {
    sendResize({ client, stream, cols: term.cols, rows: term.rows });
  }
}

export function useContainWheel(
  hostRef: RefObject<HTMLDivElement | null>
): void {
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

export function useXtermHost(options: {
  resetKey: string;
  disableStdin?: boolean;
}): {
  hostRef: RefObject<HTMLDivElement | null>;
  termRef: RefObject<Terminal | null>;
  fitRef: RefObject<FitAddon | null>;
} {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const { resetKey, disableStdin } = options;
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const { term, fit } = createTerminal();
    if (disableStdin) term.options.disableStdin = true;
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;
    return () => {
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [resetKey, disableStdin]);
  return { hostRef, termRef, fitRef };
}
