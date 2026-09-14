import { describe, expect, it } from "vitest";
import {
  toolActivityDetail,
  toolActivityGlimpse,
  toolActivityLabel
} from "./tool-activity";

describe("toolActivityLabel", () => {
  it("uses verb labels for known tools", () => {
    expect(toolActivityLabel("edit_file", { pending: true })).toBe("Editing");
    expect(toolActivityLabel("edit_file")).toBe("Edited");
  });
});

describe("toolActivityGlimpse", () => {
  it("shows preview app names from args or metadata", () => {
    expect(
      toolActivityGlimpse("preview_start", { args: { name: "web" } })
    ).toBe("web");
    expect(
      toolActivityGlimpse("preview_start", {
        args: {},
        metadata: { app: { name: "api" } }
      })
    ).toBe("api");
  });
});

describe("toolActivityDetail", () => {
  it("uses the terminal command for run_terminal", () => {
    expect(
      toolActivityDetail("run_terminal", { args: { command: "npm install" } })
    ).toBe("npm install");
  });
});
