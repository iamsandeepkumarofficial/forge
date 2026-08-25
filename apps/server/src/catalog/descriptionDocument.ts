export const DESCRIPTION_BLOCK_TYPES = [
  "text",
  "image",
  "code",
  "table",
  "checklist",
  "infoPanel",
  "quote",
  "decision",
  "divider",
  "collapsible"
] as const;
export type DescriptionBlockType = (typeof DESCRIPTION_BLOCK_TYPES)[number];
export interface DescriptionBlock {
  type: DescriptionBlockType;
  [key: string]: unknown;
}
export interface DescriptionDocument {
  version: 1;
  blocks: DescriptionBlock[];
}
export class DescriptionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DescriptionValidationError";
  }
}
const ALLOWED = new Set<string>(DESCRIPTION_BLOCK_TYPES);
function validateBlock(block: unknown, path: string): void {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new DescriptionValidationError(
      `Invalid description block at ${path}`
    );
  }
  const type = (
    block as {
      type?: unknown;
    }
  ).type;
  if (typeof type !== "string" || !ALLOWED.has(type)) {
    throw new DescriptionValidationError(
      `Unsupported description block: ${String(type)}`
    );
  }
  if (type === "collapsible") {
    const content = (
      block as {
        content?: unknown;
      }
    ).content;
    if (Array.isArray(content)) {
      content.forEach((child, i) =>
        validateBlock(child, `${path}.content[${i}]`)
      );
    }
  }
  if (type === "infoPanel" || type === "quote" || type === "decision") {
    const content = (
      block as {
        content?: unknown;
      }
    ).content;
    if (Array.isArray(content)) {
      content.forEach((child, i) => {
        if (child && typeof child === "object" && "type" in (child as object)) {
          validateBlock(child, `${path}.content[${i}]`);
        }
      });
    }
  }
}
export function validateDescriptionDocument(
  raw: unknown
): DescriptionDocument | null {
  if (raw === null || raw === undefined) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new DescriptionValidationError("Description must be an object");
  }
  const doc = raw as {
    version?: unknown;
    blocks?: unknown;
  };
  if (doc.version !== 1) {
    throw new DescriptionValidationError("Unsupported description version");
  }
  if (!Array.isArray(doc.blocks)) {
    throw new DescriptionValidationError("Description.blocks must be an array");
  }
  doc.blocks.forEach((block, i) => validateBlock(block, `blocks[${i}]`));
  return { version: 1, blocks: doc.blocks as DescriptionBlock[] };
}
