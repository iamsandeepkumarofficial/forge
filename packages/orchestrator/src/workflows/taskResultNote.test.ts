import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { transcriptNoteFromOutput } from "./taskResultNote.js";

describe("transcriptNoteFromOutput", () => {
  it("quotes the single string field", () => {
    const note = transcriptNoteFromOutput({
      taskId: "a",
      description: "Do it",
      output: { kind: "value", value: { summary: "done" } },
      materialized: { summary: "done" }
    });
    assert.match(note ?? "", /done/);
  });
});
