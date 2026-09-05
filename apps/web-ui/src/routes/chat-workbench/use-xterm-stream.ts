import { useEffect, useRef, useState, type RefObject } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";
import { fitTerminal } from "./terminal-xterm-helpers.js";

export function useShellStream(options: {
  client: TerminalSessionClient;
  stream: string;
  active: boolean;
  visible: boolean;
  termRef: RefObject<Terminal | null>;
  fitRef: RefObject<FitAddon | null>;
}) {
  const { client, stream, active, visible, termRef, fitRef } = options;
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!visible || !active) {
      void Promise.resolve().then(() => {
        if (!cancelled) setConnected(false);
      });
      return () => {
        cancelled = true;
      };
    }
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return undefined;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setConnected(false);
      setError(null);
    });
    const unsubscribe = client.subscribe(stream, {
      onReady: () => {
        setConnected(true);
        setError(null);
        fitTerminal({ fit, term, client, stream });
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
      cancelled = true;
      onData.dispose();
      unsubscribe();
      setConnected(false);
    };
  }, [client, stream, active, visible, termRef, fitRef]);

  return { connected, error };
}

export function useLogFollowStream(options: {
  client: TerminalSessionClient;
  stream: string;
  active: boolean;
  visible: boolean;
  termRef: RefObject<Terminal | null>;
  fitRef: RefObject<FitAddon | null>;
}) {
  const { client, stream, active, visible, termRef, fitRef } = options;
  const [connected, setConnected] = useState(false);
  const [hasOutput, setHasOutput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hadReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!visible) {
      hadReadyRef.current = false;
      void Promise.resolve().then(() => {
        if (!cancelled) setConnected(false);
      });
      return () => {
        cancelled = true;
      };
    }
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return undefined;
    void Promise.resolve().then(() => {
      if (!cancelled) setError(null);
    });
    const unsubscribe = client.subscribe(stream, {
      onReady: () => {
        if (hadReadyRef.current) {
          term.clear();
          setHasOutput(false);
        }
        hadReadyRef.current = true;
        setConnected(true);
        setError(null);
        if (active) fitTerminal({ fit, term, client: null, stream });
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
      onExited: () => setConnected(false)
    });
    return () => {
      cancelled = true;
      unsubscribe();
      setConnected(false);
    };
  }, [client, stream, visible, active, termRef, fitRef]);

  return { connected, hasOutput, error };
}
