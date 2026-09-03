import { describe, it, expect } from "vitest";
import {
  dockModeFromEvent,
  PREVIEW_DOCK_EVENT,
  requestDevtoolsToggle,
  requestTerminalToggle
} from "./terminal-toggle";

describe("terminal-toggle", () => {
  it("dispatches dock mode events for toolbar CTAs", () => {
    const seen: string[] = [];
    const onDock = (e: Event) => {
      seen.push(dockModeFromEvent(e));
    };
    window.addEventListener(PREVIEW_DOCK_EVENT, onDock);
    requestTerminalToggle();
    requestDevtoolsToggle();
    window.removeEventListener(PREVIEW_DOCK_EVENT, onDock);
    expect(seen).toEqual(["terminal", "devtools"]);
  });

  it("defaults unknown dock events to terminal", () => {
    expect(dockModeFromEvent(new Event("x"))).toBe("terminal");
  });
});
