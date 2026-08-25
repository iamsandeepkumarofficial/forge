import { describe, it, expect } from "vitest";
import { Decision } from "./decision";

describe("Decision node", () => {
  it("registers decision block with open status default", () => {
    expect(Decision.name).toBe("decision");
    const attrs = Decision.config.addAttributes?.call({
      parent: undefined
    } as never) as {
      status: { default: string };
    };
    expect(attrs.status.default).toBe("open");
    const parse = Decision.config.parseHTML?.call({
      parent: undefined
    } as never);
    expect(parse?.[0]).toMatchObject({ tag: 'div[data-type="decision"]' });
  });
});
