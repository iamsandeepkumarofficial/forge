import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readFileInputSchema,
  askUserInputSchema,
  upsertWorkspaceParameterInputSchema
} from "./schemas.js";

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

  it("parses single-key and items[] upsert_workspace_parameter", () => {
    assert.deepEqual(
      upsertWorkspaceParameterInputSchema.parse({
        key: "JWT_SECRET",
        value: "x"
      }),
      { key: "JWT_SECRET", value: "x" }
    );
    const batch = upsertWorkspaceParameterInputSchema.parse({
      items: [
        { key: "A", value: "1" },
        { key: "B", value: "2", secret: true }
      ]
    });
    assert.equal(batch.items?.length, 2);
    assert.throws(() => upsertWorkspaceParameterInputSchema.parse({}));
    assert.throws(() =>
      upsertWorkspaceParameterInputSchema.parse({
        key: "A",
        value: "1",
        items: [{ key: "B", value: "2" }]
      })
    );
  });
});
