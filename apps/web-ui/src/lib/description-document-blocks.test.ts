import { describe, it, expect } from "vitest";
import {
  checklistToTipTap,
  tableToTipTap
} from "./description-document-blocks";

describe("description-document-blocks", () => {
  it("checklistToTipTap maps items to taskList", () => {
    const node = checklistToTipTap({
      type: "checklist",
      items: [{ text: "One", checked: true }]
    });
    expect(node.type).toBe("taskList");
    expect(node.content?.[0]?.type).toBe("taskItem");
    expect(node.content?.[0]?.attrs?.checked).toBe(true);
  });

  it("tableToTipTap maps rows to table cells", () => {
    const node = tableToTipTap({
      type: "table",
      rows: [["a", "b"]]
    });
    expect(node.type).toBe("table");
    expect(node.content?.[0]?.type).toBe("tableRow");
    expect(node.content?.[0]?.content?.[0]?.type).toBe("tableCell");
  });
});
