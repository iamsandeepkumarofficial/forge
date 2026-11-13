import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateInputMappings } from "./check-compatibility.js";

describe("validateInputMappings", () => {
  it("rejects a mapping whose fromTask is not a dependency", () => {
    const errors = validateInputMappings({
      taskId: "b",
      dependencies: ["a"],
      mappings: [{ fromTask: "c", outputPath: "$.x", targetPath: "$.x" }]
    });
    assert.equal(errors[0]?.code, "mapping_not_dependency");
  });
});
