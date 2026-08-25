import { describe, it, expect } from "vitest";
import {
  tipTapToDescription,
  descriptionToTipTap,
  emptyDescription
} from "./description-document";

describe("description-document", () => {
  it("emptyDescription returns versioned empty blocks", () => {
    expect(emptyDescription()).toEqual({ version: 1, blocks: [] });
  });

  it("tipTapToDescription maps paragraphs to text blocks", () => {
    const doc = tipTapToDescription({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }]
        }
      ]
    });
    expect(doc.version).toBe(1);
    expect(doc.blocks[0]?.type).toBe("text");
  });

  it("descriptionToTipTap round-trips text and empty docs", () => {
    expect(descriptionToTipTap(null).type).toBe("doc");
    const tipTap = descriptionToTipTap({
      version: 1,
      blocks: [{ type: "text", content: [{ text: "Hi" }] }]
    });
    expect(tipTap.content?.[0]?.type).toBe("paragraph");
  });

  it("maps code and divider blocks", () => {
    const tipTap = descriptionToTipTap({
      version: 1,
      blocks: [
        { type: "code", language: "ts", code: "const x = 1" },
        { type: "divider" }
      ]
    });
    expect(tipTap.content?.[0]?.type).toBe("codeBlock");
    expect(tipTap.content?.[1]?.type).toBe("horizontalRule");
  });
});
