import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileInputSchema, askUserInputSchema } from "./schemas.js";

describe("schemas", () => {
  it("parses read_file and ask_user inputs", () => {
    assert.deepEqual(readFileInputSchema.parse({ path: "a.ts" }), {
      path: "a.ts"
    });
    const ask = askUserInputSchema.parse({
      kind: "mcq",
      prompt: "Go?",
      options: [
        { id: "y", label: "Yes" },
        { id: "n", label: "No" }
      ]
    });
    assert.equal(ask.kind, "mcq");
  });
});
