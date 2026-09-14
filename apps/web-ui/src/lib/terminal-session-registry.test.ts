import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getTerminalSessionClient,
  releaseTerminalSessionClient,
  resetTerminalSessionRegistryForTests,
  retainTerminalSessionClient
} from "./terminal-session-registry";

const connect = vi.fn();
const disconnect = vi.fn();

vi.mock("./terminal-session-client.js", () => ({
  TerminalSessionClient: class {
    connect() {
      connect();
    }
    disconnect() {
      disconnect();
    }
  }
}));

describe("terminal-session-registry", () => {
  beforeEach(() => {
    resetTerminalSessionRegistryForTests();
    connect.mockClear();
    disconnect.mockClear();
  });

  it("retains one shared client per session id", () => {
    const a = retainTerminalSessionClient("s1");
    const b = retainTerminalSessionClient(" s1 ");
    expect(a).toBe(b);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(getTerminalSessionClient("s1")).toBe(a);
  });

  it("disconnects only after the last release", () => {
    retainTerminalSessionClient("s1");
    retainTerminalSessionClient("s1");
    releaseTerminalSessionClient("s1");
    expect(disconnect).not.toHaveBeenCalled();
    expect(getTerminalSessionClient("s1")).not.toBeNull();
    releaseTerminalSessionClient("s1");
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(getTerminalSessionClient("s1")).toBeNull();
  });
});
