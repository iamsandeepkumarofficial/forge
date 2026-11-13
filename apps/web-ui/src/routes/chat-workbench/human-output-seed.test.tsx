import { describe, expect, it } from "vitest";
import { schemaJsonSeed } from "./human-output-seed";

describe("schemaJsonSeed", () => {
  it("seeds nested object fields from the output schema", () => {
    const seed = schemaJsonSeed({
      type: "object",
      properties: {
        company: {
          type: "object",
          properties: { name: { type: "string" } }
        }
      }
    });
    expect(seed).toContain("company");
    expect(seed).toContain("name");
  });
});
