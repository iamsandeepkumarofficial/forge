import type { JSONContent } from "@tiptap/react";
import type { DescriptionDocument } from "@/lib/projects-api";
import {
  checklistToTipTap,
  tableToTipTap
} from "./description-document-blocks.js";
type Block = DescriptionDocument["blocks"][number];
function inlineText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (!node.content) return "";
  return node.content.map(inlineText).join("");
}
function textRuns(node: JSONContent | undefined): unknown[] {
  if (!node?.content) return [{ type: "text", text: inlineText(node) }];
  return node.content.map((child) => {
    if (child.type === "text") {
      return { type: "text", text: child.text ?? "", marks: child.marks };
    }
    return { type: "text", text: inlineText(child) };
  });
}
function tipTapNodeToBlock(node: JSONContent): Block | null {
  switch (node.type) {
    case "paragraph":
    case "heading":
      return { type: "text", content: textRuns(node) };
    case "image":
      return {
        type: "image",
        attachmentKey: (node.attrs?.src as string) || "",
        alt: (node.attrs?.alt as string) || ""
      };
    case "codeBlock":
      return {
        type: "code",
        language: (node.attrs?.language as string) || "text",
        code: inlineText(node)
      };
    case "blockquote":
      return {
        type: "quote",
        content: (node.content ?? [])
          .map(tipTapNodeToBlock)
          .filter(Boolean) as Block[]
      };
    case "horizontalRule":
      return { type: "divider" };
    case "taskList": {
      const items = (node.content ?? []).map((item) => ({
        text: inlineText(item),
        checked: Boolean(item.attrs?.checked)
      }));
      return { type: "checklist", items };
    }
    case "table": {
      const rows = (node.content ?? []).map((row) =>
        (row.content ?? []).map((cell) => inlineText(cell))
      );
      return { type: "table", rows };
    }
    case "bulletList":
    case "orderedList":
      return {
        type: "text",
        content: [{ type: "text", text: inlineText(node) }]
      };
    case "infoPanel":
      return {
        type: "infoPanel",
        variant: (node.attrs?.variant as string) || "info",
        content: (node.content ?? [])
          .map(tipTapNodeToBlock)
          .filter(Boolean) as Block[]
      };
    case "decision":
      return {
        type: "decision",
        status: (node.attrs?.status as string) || "open",
        content: (node.content ?? [])
          .map(tipTapNodeToBlock)
          .filter(Boolean) as Block[]
      };
    case "collapsible":
      return {
        type: "collapsible",
        summary: (node.attrs?.summary as string) || "Details",
        collapsed: node.attrs?.collapsed !== false,
        content: (node.content ?? [])
          .map(tipTapNodeToBlock)
          .filter(Boolean) as Block[]
      };
    default:
      if (node.content?.length) {
        return { type: "text", content: textRuns(node) };
      }
      return null;
  }
}
export function tipTapToDescription(doc: JSONContent): DescriptionDocument {
  const blocks = (doc.content ?? [])
    .map(tipTapNodeToBlock)
    .filter((b): b is Block => Boolean(b));
  return { version: 1, blocks };
}
function paragraph(text: string): JSONContent {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text }] : undefined
  };
}
function contentFromRuns(content: unknown): JSONContent[] {
  if (!Array.isArray(content) || content.length === 0) {
    return [paragraph("")];
  }
  if (
    content.every((c) => c && typeof c === "object" && "type" in (c as object))
  ) {
    const nested = (content as Block[])
      .map(blockToTipTap)
      .filter((n): n is JSONContent => Boolean(n));
    if (nested.length) return nested;
  }
  const text = content
    .map((c) => {
      if (c && typeof c === "object" && "text" in (c as object)) {
        return String(
          (
            c as {
              text?: string;
            }
          ).text ?? ""
        );
      }
      return typeof c === "string" ? c : "";
    })
    .join("");
  return [paragraph(text)];
}
function blockToTipTap(block: Block): JSONContent | null {
  switch (block.type) {
    case "text":
      return contentFromRuns(block.content)[0] ?? paragraph("");
    case "image":
      return {
        type: "image",
        attrs: {
          src: String(block.attachmentKey ?? ""),
          alt: String(block.alt ?? "")
        }
      };
    case "code":
      return {
        type: "codeBlock",
        attrs: { language: String(block.language ?? "text") },
        content: block.code
          ? [{ type: "text", text: String(block.code) }]
          : undefined
      };
    case "quote":
      return {
        type: "blockquote",
        content: contentFromRuns(block.content)
      };
    case "divider":
      return { type: "horizontalRule" };
    case "checklist":
      return checklistToTipTap(block);
    case "table":
      return tableToTipTap(block);
    case "infoPanel":
      return {
        type: "infoPanel",
        attrs: { variant: String(block.variant ?? "info") },
        content: contentFromRuns(block.content)
      };
    case "decision":
      return {
        type: "decision",
        attrs: { status: String(block.status ?? "open") },
        content: contentFromRuns(block.content)
      };
    case "collapsible":
      return {
        type: "collapsible",
        attrs: {
          summary: String(block.summary ?? "Details"),
          collapsed: block.collapsed !== false
        },
        content: contentFromRuns(block.content)
      };
    default:
      return paragraph(JSON.stringify(block));
  }
}
export function descriptionToTipTap(
  doc: DescriptionDocument | null | undefined
): JSONContent {
  if (!doc?.blocks?.length) {
    return { type: "doc", content: [paragraph("")] };
  }
  return {
    type: "doc",
    content: doc.blocks
      .map(blockToTipTap)
      .filter((n): n is JSONContent => Boolean(n))
  };
}
export function emptyDescription(): DescriptionDocument {
  return { version: 1, blocks: [] };
}
