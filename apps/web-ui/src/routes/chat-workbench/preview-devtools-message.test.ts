import { describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { handleDevtoolsMessage } from "./preview-devtools-message";
import type { ConsoleEntry, NetworkEntry } from "./preview-devtools-model";

const postToPreviewInspect = vi.fn();

vi.mock("./preview-devtools-model.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./preview-devtools-model.js")>();
  return {
    ...actual,
    postToPreviewInspect: (...args: unknown[]) => postToPreviewInspect(...args)
  };
});

describe("handleDevtoolsMessage", () => {
  it("appends console and network entries with sequenced ids", () => {
    let seq = 0;
    const setLogs = vi.fn((fn: (prev: ConsoleEntry[]) => ConsoleEntry[]) =>
      fn([])
    );
    const setRequests = vi.fn((fn: (prev: NetworkEntry[]) => NetworkEntry[]) =>
      fn([])
    );
    handleDevtoolsMessage({
      data: {
        type: "forge-devtools-console",
        level: "warn",
        args: ["x"],
        ts: 1
      },
      selecting: false,
      nextSeq: () => ++seq,
      setLogs: setLogs as unknown as Dispatch<SetStateAction<ConsoleEntry[]>>,
      setRequests: vi.fn() as unknown as Dispatch<
        SetStateAction<NetworkEntry[]>
      >,
      setTree: vi.fn() as never,
      setTreeError: vi.fn() as never,
      setPick: vi.fn() as never,
      setSelecting: vi.fn() as never
    });
    expect(setLogs).toHaveBeenCalled();
    const logs = setLogs.mock.calls[0]![0]!([]) as {
      id: string;
      level: string;
    }[];
    expect(logs[0]).toMatchObject({ id: "c1", level: "warn" });

    handleDevtoolsMessage({
      data: {
        type: "forge-devtools-network",
        method: "GET",
        url: "/a",
        status: 200,
        duration: 3,
        ts: 2
      },
      selecting: false,
      nextSeq: () => ++seq,
      setLogs: vi.fn() as unknown as Dispatch<SetStateAction<ConsoleEntry[]>>,
      setRequests: setRequests as unknown as Dispatch<
        SetStateAction<NetworkEntry[]>
      >,
      setTree: vi.fn() as never,
      setTreeError: vi.fn() as never,
      setPick: vi.fn() as never,
      setSelecting: vi.fn() as never
    });
    const reqs = setRequests.mock.calls[0]![0]!([]) as {
      id: string;
      url: string;
    }[];
    expect(reqs[0]).toMatchObject({ id: "n2", url: "/a" });
  });

  it("stores inspect picks only while selecting", () => {
    postToPreviewInspect.mockClear();
    const setPick = vi.fn();
    const setSelecting = vi.fn();
    handleDevtoolsMessage({
      data: {
        type: "forge-inspect-pick",
        tag: "button",
        selector: "#go",
        text: "Go"
      },
      selecting: false,
      nextSeq: () => 1,
      setLogs: vi.fn() as never,
      setRequests: vi.fn() as never,
      setTree: vi.fn() as never,
      setTreeError: vi.fn() as never,
      setPick,
      setSelecting
    });
    expect(setPick).not.toHaveBeenCalled();

    handleDevtoolsMessage({
      data: {
        type: "forge-inspect-pick",
        tag: "button",
        selector: "#go",
        text: "Go"
      },
      selecting: true,
      nextSeq: () => 1,
      setLogs: vi.fn() as never,
      setRequests: vi.fn() as never,
      setTree: vi.fn() as never,
      setTreeError: vi.fn() as never,
      setPick,
      setSelecting
    });
    expect(setPick).toHaveBeenCalledWith({
      tag: "button",
      selector: "#go",
      text: "Go"
    });
    expect(setSelecting).toHaveBeenCalledWith(false);
    expect(postToPreviewInspect).toHaveBeenCalledWith({
      type: "forge-inspect-set",
      on: false
    });
  });
});
