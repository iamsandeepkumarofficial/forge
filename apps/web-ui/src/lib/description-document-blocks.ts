import type { JSONContent } from "@tiptap/react";
import type { DescriptionDocument } from "@/lib/projects-api";

type Block = DescriptionDocument["blocks"][number];

function paragraph(text: string): JSONContent {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text }] : undefined
  };
}

export function checklistToTipTap(block: Block): JSONContent {
  const items = Array.isArray(block.items) ? block.items : [];
  return {
    type: "taskList",
    content: items.map((item) => {
      const row = item as {
        text?: string;
        checked?: boolean;
      };
      return {
        type: "taskItem",
        attrs: { checked: Boolean(row.checked) },
        content: [paragraph(String(row.text ?? ""))]
      };
    })
  };
}

export function tableToTipTap(block: Block): JSONContent {
  const rows = Array.isArray(block.rows) ? (block.rows as string[][]) : [];
  return {
    type: "table",
    content: rows.map((row) => ({
      type: "tableRow",
      content: row.map((cell) => ({
        type: "tableCell",
        content: [paragraph(String(cell ?? ""))]
      }))
    }))
  };
}
