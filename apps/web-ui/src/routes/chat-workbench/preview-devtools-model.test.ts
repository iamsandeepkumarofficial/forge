import { describe, it, expect } from "vitest";
import {
  capEntries,
  formatDomLabel,
  formatNetworkStatus,
  parseConsoleMessage,
  parseDomResult,
  parseInspectPick,
  parseNetworkMessage
} from "./preview-devtools-model";

describe("preview-devtools-model", () => {
  it("formats a DOM node label", () => {
    expect(
      formatDomLabel({
        tag: "button",
        id: "go",
        className: "primary compact extra",
        children: []
      })
    ).toBe("button#go.primary.compact");
  });

  it("parses console and network messages", () => {
    expect(
      parseConsoleMessage({
        type: "forge-devtools-console",
        level: "warn",
        args: ["slow"],
        ts: 10
      })
    ).toEqual({ ts: 10, level: "warn", args: ["slow"], stack: undefined });
    expect(
      parseNetworkMessage({
        type: "forge-devtools-network",
        method: "POST",
        url: "/api",
        status: 201,
        duration: 12,
        ts: 11
      })
    ).toEqual({
      ts: 11,
      method: "POST",
      url: "/api",
      status: 201,
      duration: 12,
      error: undefined
    });
    expect(
      formatNetworkStatus({
        id: "n1",
        ts: 1,
        method: "GET",
        url: "/",
        status: 0,
        duration: 0,
        error: "fail"
      })
    ).toBe("ERR");
  });

  it("parses a DOM snapshot and element pick", () => {
    expect(
      parseDomResult({
        type: "forge-devtools-dom-result",
        tree: { tag: "html", id: "", className: "", children: [] }
      })
    ).toEqual({ tag: "html", id: "", className: "", children: [] });
    expect(
      parseInspectPick({
        type: "forge-inspect-pick",
        tag: "a",
        selector: "nav > a",
        text: "Home"
      })
    ).toEqual({ tag: "a", selector: "nav > a", text: "Home" });
    expect(parseConsoleMessage({ type: "other" })).toBeNull();
  });

  it("caps retained entries", () => {
    expect(capEntries(Array.from({ length: 201 }, (_, i) => i))).toHaveLength(
      200
    );
  });
});
