import { describe, it, expect } from "vitest";
import { Collapsible } from "./collapsible";

describe("Collapsible node", () => {
  it("registers collapsible block with summary attribute", () => {
    expect(Collapsible.name).toBe("collapsible");
    expect(Collapsible.config.group).toBe("block");
    const attrs = Collapsible.config.addAttributes?.call({
      parent: undefined
    } as never) as {
      summary: { default: string };
      collapsed: { default: boolean };
    };
    expect(attrs.summary.default).toBe("Details");
    expect(attrs.collapsed.default).toBe(true);
  });
});
