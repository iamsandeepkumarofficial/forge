import { describe, it, expect } from "vitest";
import { runningTerminalItemsFrom } from "./running-terminals";

describe("runningTerminalItemsFrom", () => {
  it("lists running apps and jobs with labels", () => {
    expect(
      runningTerminalItemsFrom({
        appTabs: [
          {
            id: "main",
            kind: "shell",
            label: "Shell",
            running: false
          },
          {
            id: "app:web",
            kind: "app",
            label: "web",
            running: true
          },
          {
            id: "app:api",
            kind: "app",
            label: "api",
            running: false
          }
        ],
        jobs: [
          { name: "install", running: true },
          { name: "done", running: false }
        ]
      })
    ).toEqual([
      { id: "app:web", kind: "app", label: "web" },
      { id: "job:install", kind: "job", label: "install" }
    ]);
  });
});
