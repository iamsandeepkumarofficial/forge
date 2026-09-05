import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import {
  createTerminal,
  fitTerminal,
  sendResize,
  useContainWheel
} from "./terminal-xterm-helpers";

vi.mock("@xterm/xterm", () => {
  class Terminal {
    cols = 80;
    rows = 24;
    options: Record<string, unknown> = {};
    loadAddon = vi.fn();
    open = vi.fn();
    dispose = vi.fn();
  }
  return { Terminal };
});

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit = vi.fn();
  }
}));

vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: class {}
}));

describe("terminal-xterm-helpers", () => {
  it("clamps resize dimensions and fits when possible", () => {
    const resize = vi.fn();
    const client = { resize } as never;
    sendResize({ client, stream: "shell", cols: 0, rows: 1 });
    expect(resize).toHaveBeenCalledWith({
      stream: "shell",
      cols: 2,
      rows: 2
    });

    const fit = { fit: vi.fn() };
    const term = { cols: 40, rows: 12 };
    fitTerminal({
      fit: fit as never,
      term: term as never,
      client,
      stream: "shell"
    });
    expect(fit.fit).toHaveBeenCalled();
    expect(resize).toHaveBeenCalledWith({
      stream: "shell",
      cols: 40,
      rows: 12
    });
  });

  it("creates a terminal with addons and stops wheel bubbling", () => {
    const created = createTerminal();
    expect(created.term.loadAddon).toHaveBeenCalled();
    expect(created.fit).toBeTruthy();

    const host = document.createElement("div");
    const hostRef = createRef<HTMLDivElement>();
    (hostRef as { current: HTMLDivElement }).current = host;
    const stop = vi.fn();
    renderHook(() => useContainWheel(hostRef));
    host.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    const listener = (e: Event) => stop(e);
    host.addEventListener("wheel", listener);
    host.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    expect(stop).toHaveBeenCalled();
    host.removeEventListener("wheel", listener);
  });
});
