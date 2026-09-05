import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createRef } from "react";
import { useLogFollowStream, useShellStream } from "./use-xterm-stream";

vi.mock("./terminal-xterm-helpers.js", () => ({
  fitTerminal: vi.fn()
}));

function mockClient() {
  let handlers: {
    onReady?: () => void;
    onData?: (chunk: string) => void;
    onError?: (message: string) => void;
    onExited?: () => void;
  } = {};
  const unsubscribe = vi.fn();
  const sendStdin = vi.fn();
  return {
    sendStdin,
    unsubscribe,
    subscribe: vi.fn((_stream: string, next: typeof handlers) => {
      handlers = next;
      return unsubscribe;
    }),
    emit: {
      ready: () => handlers.onReady?.(),
      data: (chunk: string) => handlers.onData?.(chunk),
      error: (message: string) => handlers.onError?.(message),
      exited: () => handlers.onExited?.()
    }
  };
}

function mockTerm() {
  return {
    write: vi.fn(),
    clear: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() }))
  };
}

describe("useShellStream", () => {
  it("stays disconnected when not visible", async () => {
    const client = mockClient();
    const termRef = createRef<ReturnType<typeof mockTerm> | null>();
    const fitRef = createRef<{ fit: () => void } | null>();
    (termRef as { current: unknown }).current = mockTerm();
    (fitRef as { current: unknown }).current = { fit: vi.fn() };
    const { result } = renderHook(() =>
      useShellStream({
        client: client as never,
        stream: "shell:1",
        active: true,
        visible: false,
        termRef: termRef as never,
        fitRef: fitRef as never
      })
    );
    await waitFor(() => expect(result.current.connected).toBe(false));
    expect(client.subscribe).not.toHaveBeenCalled();
  });

  it("connects on ready and writes data chunks", async () => {
    const client = mockClient();
    const term = mockTerm();
    const termRef = createRef<typeof term | null>();
    const fitRef = createRef<{ fit: () => void } | null>();
    (termRef as { current: unknown }).current = term;
    (fitRef as { current: unknown }).current = { fit: vi.fn() };
    const { result } = renderHook(() =>
      useShellStream({
        client: client as never,
        stream: "shell:1",
        active: true,
        visible: true,
        termRef: termRef as never,
        fitRef: fitRef as never
      })
    );
    await waitFor(() => expect(client.subscribe).toHaveBeenCalled());
    act(() => {
      client.emit.ready();
    });
    expect(result.current.connected).toBe(true);
    act(() => {
      client.emit.data("hello");
    });
    expect(term.write).toHaveBeenCalledWith("hello");
  });
});

describe("useLogFollowStream", () => {
  it("marks hasOutput when data arrives", async () => {
    const client = mockClient();
    const term = mockTerm();
    const termRef = createRef<typeof term | null>();
    const fitRef = createRef<{ fit: () => void } | null>();
    (termRef as { current: unknown }).current = term;
    (fitRef as { current: unknown }).current = { fit: vi.fn() };
    const { result } = renderHook(() =>
      useLogFollowStream({
        client: client as never,
        stream: "job:build",
        active: true,
        visible: true,
        termRef: termRef as never,
        fitRef: fitRef as never
      })
    );
    await waitFor(() => expect(client.subscribe).toHaveBeenCalled());
    act(() => {
      client.emit.data("log line\n");
    });
    expect(result.current.hasOutput).toBe(true);
    expect(result.current.connected).toBe(true);
    expect(term.write).toHaveBeenCalledWith("log line\n");
  });
});
