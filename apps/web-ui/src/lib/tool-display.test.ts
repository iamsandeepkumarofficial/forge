import { describe, it, expect } from "vitest";
import {
  applyLiveToolEvent,
  mergeSessionMessagesForUi,
  synthesizeToolDiff,
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
