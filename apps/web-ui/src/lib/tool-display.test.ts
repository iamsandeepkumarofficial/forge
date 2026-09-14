import { describe, it, expect } from "vitest";
import {
  applyLiveToolEvent,
  mergeSessionMessagesForUi,
  synthesizeToolDiff,
  toolActivityGlimpse,
  toolActivityLabel,
  truncateDiffText
} from "./tool-display";
import type { UiChatMessage } from "./chat-agent";
describe("synthesizeToolDiff", () => {
  it("builds an edit preview from oldString/newString", () => {
    const preview = synthesizeToolDiff("edit_file", {
      path: "apps/web/src/App.tsx",
      oldString: "const a = 1;",
      newString: "const a = 2;"
    });
    expect(preview?.kind).toBe("edit");
    expect(preview?.path).toBe("apps/web/src/App.tsx");
    expect(preview?.diffText).toContain("-const a = 1;");
    expect(preview?.diffText).toContain("+const a = 2;");
  });
  it("builds a write preview as all additions", () => {
    const preview = synthesizeToolDiff("write_file", {
      path: "README.md",
      content: "hello\nworld"
    });
    expect(preview?.kind).toBe("write");
    expect(preview?.diffText).toContain("--- /dev/null");
    expect(preview?.diffText).toContain("+hello");
    expect(preview?.diffText).toContain("+world");
  });
  it("builds a write preview from files[]", () => {
    const preview = synthesizeToolDiff("write_file", {
      files: [{ path: "README.md", content: "hello" }]
    });
    expect(preview?.path).toBe("README.md");
    expect(preview?.diffText).toContain("+hello");
  });
  it("returns null for non-file tools", () => {
    expect(synthesizeToolDiff("run_command", { command: "ls" })).toBeNull();
  });
});
describe("truncateDiffText", () => {
  it("marks long diffs as truncated", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `+line ${i}`);
    const result = truncateDiffText(lines.join("\n"), 10);
    expect(result.truncated).toBe(true);
    expect(result.text.split("\n").length).toBe(11);
  });
});
describe("mergeSessionMessagesForUi", () => {
  it("joins tool results into assistant tool-invocation parts", () => {
    const rows: UiChatMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "edit the file" }]
      },
      {
        id: "2",
        role: "assistant",
        parts: [
          {
            type: "tool-invocation",
            toolCallId: "call-1",
            toolName: "edit_file",
            args: { path: "a.ts", oldString: "x", newString: "y" },
            state: "call"
          }
        ]
      },
      {
        id: "3",
        role: "tool",
        parts: [
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "edit_file",
            output: "Successfully edited a.ts.",
            success: true
          }
        ]
      },
      {
        id: "4",
        role: "assistant",
        parts: [{ type: "text", text: "Done." }]
      }
    ];
    const merged = mergeSessionMessagesForUi(rows);
    expect(merged).toHaveLength(3);
    expect(merged.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "assistant"
    ]);
    const toolPart = merged[1]!.parts[0] as Record<string, unknown>;
    expect(toolPart.state).toBe("result");
    expect(toolPart.output).toBe("Successfully edited a.ts.");
    expect(toolPart.args).toEqual({
      path: "a.ts",
      oldString: "x",
      newString: "y"
    });
  });
});
describe("applyLiveToolEvent", () => {
  it("updates the matching call card instead of appending a stub", () => {
    const withCall = applyLiveToolEvent({
      prev: [],
      eventType: "tool_call",
      payload: {
        toolCallId: "c1",
        toolName: "write_file",
        args: { path: "a.ts", content: "hi" }
      }
    });
    expect(withCall).toHaveLength(1);
    expect(withCall[0]!.state).toBe("call");
    const withResult = applyLiveToolEvent({
      prev: withCall,
      eventType: "tool_result",
      payload: {
        toolCallId: "c1",
        toolName: "write_file",
        output: "Wrote a.ts",
        success: true
      }
    });
    expect(withResult).toHaveLength(1);
    expect(withResult[0]!.state).toBe("result");
    expect(withResult[0]!.args).toEqual({ path: "a.ts", content: "hi" });
    expect(withResult[0]!.output).toBe("Wrote a.ts");
  });

  it("ignores a duplicate tool_call with the same id", () => {
    const first = applyLiveToolEvent({
      prev: [],
      eventType: "tool_call",
      payload: {
        toolCallId: "c1",
        toolName: "preview_start",
        args: { name: "web" }
      }
    });
    const dup = applyLiveToolEvent({
      prev: first,
      eventType: "tool_call",
      payload: {
        toolCallId: "c1",
        toolName: "preview_start",
        args: { name: "web" }
      }
    });
    expect(dup).toHaveLength(1);
  });

  it("preserves switch_mode metadata on tool_result", () => {
    const withCall = applyLiveToolEvent({
      prev: [],
      eventType: "tool_call",
      payload: {
        toolCallId: "c-switch",
        toolName: "switch_mode",
        args: { target: "ask" }
      }
    });
    const withResult = applyLiveToolEvent({
      prev: withCall,
      eventType: "tool_result",
      payload: {
        toolCallId: "c-switch",
        toolName: "switch_mode",
        output: "Proposed switch to ask.",
        success: true,
        metadata: {
          applied: false,
          target: "ask",
          needsConfirmation: true
        }
      }
    });
    expect(withResult[0]!.metadata).toEqual({
      applied: false,
      target: "ask",
      needsConfirmation: true
    });
  });
});

describe("toolActivityLabel", () => {
  it("uses verb labels for known tools", () => {
    expect(toolActivityLabel("edit_file", { pending: true })).toBe("Editing");
    expect(toolActivityLabel("edit_file")).toBe("Edited");
    expect(toolActivityLabel("delete_files", { pending: true })).toBe(
      "Deleting"
    );
    expect(toolActivityLabel("move_files")).toBe("Moved");
    expect(toolActivityLabel("read_file")).toBe("Read");
    expect(toolActivityLabel("run_terminal", { pending: true })).toBe(
      "Running terminal"
    );
    expect(toolActivityLabel("preview_start")).toBe("Started preview");
  });

  it("uses verb labels for upsert tools", () => {
    expect(
      toolActivityLabel("upsert_workspace_parameter", { pending: true })
    ).toBe("Upserting parameter");
    expect(toolActivityLabel("upsert_launch_app")).toBe("Upserted launch app");
  });

  it("falls back to a gerund for unknown tools", () => {
    expect(toolActivityLabel("sync_widget_cache", { pending: true })).toBe(
      "Syncing widget cache"
    );
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

  it("shows upserted parameter keys and launch app names", () => {
    expect(
      toolActivityGlimpse("upsert_workspace_parameter", {
        args: { key: "JWT_SECRET" }
      })
    ).toBe("JWT_SECRET");
    expect(
      toolActivityGlimpse("upsert_workspace_parameter", {
        args: {
          items: [{ key: "NODE_ENV" }, { key: "PORT" }, { key: "HOST" }]
        }
      })
    ).toBe("NODE_ENV +2");
    expect(
      toolActivityGlimpse("upsert_launch_app", { args: { name: "web" } })
    ).toBe("web");
  });
});
