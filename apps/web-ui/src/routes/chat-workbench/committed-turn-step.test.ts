import { describe, expect, it } from "vitest";
import {
  excludeKnownToolParts,
  historyToolCallIds,
  snapshotLiveStep
} from "./committed-turn-step";

describe("committed-turn-step", () => {
  it("snapshots only non-empty live activity", () => {
    expect(snapshotLiveStep({ text: "", reasoning: "", tools: [] })).toBeNull();
    expect(
      snapshotLiveStep({
        text: "",
        reasoning: "think",
        tools: []
      })
    ).toEqual({ text: "", reasoning: "think", tools: [] });
  });

  it("filters live tools already present in history", () => {
    const ids = historyToolCallIds([
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-invocation",
            toolCallId: "c1",
            toolName: "preview_start"
          }
        ]
      }
    ]);
    expect(ids.has("c1")).toBe(true);
    expect(
      excludeKnownToolParts(
        [
          {
            type: "tool-invocation",
            toolCallId: "c1",
            toolName: "preview_start"
          },
          {
            type: "tool-invocation",
            toolCallId: "c2",
            toolName: "read_file"
          }
        ],
        ids
      )
    ).toEqual([
      {
        type: "tool-invocation",
        toolCallId: "c2",
        toolName: "read_file"
      }
    ]);
  });
});
