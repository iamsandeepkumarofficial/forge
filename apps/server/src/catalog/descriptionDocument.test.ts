import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateDescriptionDocument,
  DescriptionValidationError
} from "./descriptionDocument.js";
describe("validateDescriptionDocument", () => {
  it("accepts null", () => {
    assert.equal(validateDescriptionDocument(null), null);
  });
  it("accepts a full block document", () => {
    const doc = validateDescriptionDocument({
      version: 1,
      blocks: [
        { type: "text", content: [] },
        { type: "image", attachmentKey: "tickets/x/att/y", alt: "a" },
        { type: "code", language: "ts", code: "const x = 1" },
        { type: "table", rows: [["a"]] },
        { type: "checklist", items: [{ text: "t", checked: true }] },
        { type: "infoPanel", variant: "info", content: [] },
        { type: "quote", content: [] },
        { type: "decision", status: "open", content: [] },
        { type: "divider" },
        {
          type: "collapsible",
          summary: "More",
          collapsed: true,
          content: [{ type: "text", content: [] }]
        }
      ]
    });
    assert.equal(doc?.version, 1);
    assert.equal(doc?.blocks.length, 10);
  });
  it("rejects unknown block types", () => {
    assert.throws(
      () =>
        validateDescriptionDocument({
          version: 1,
          blocks: [{ type: "mermaid" }]
        }),
      (err: unknown) =>
        err instanceof DescriptionValidationError &&
        err.message.includes("Unsupported description block: mermaid")
    );
  });
  it("rejects bad version", () => {
    assert.throws(
      () => validateDescriptionDocument({ version: 2, blocks: [] }),
      DescriptionValidationError
    );
  });
});
