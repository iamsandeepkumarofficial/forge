import { describe, it, expect } from "vitest";
import { InfoPanel } from "./info-panel";

describe("InfoPanel node", () => {
  it("registers infoPanel block with info variant default", () => {
    expect(InfoPanel.name).toBe("infoPanel");
    const attrs = InfoPanel.config.addAttributes?.call({
      parent: undefined
    } as never) as {
      variant: { default: string };
    };
    expect(attrs.variant.default).toBe("info");
    const parse = InfoPanel.config.parseHTML?.call({
      parent: undefined
    } as never);
    expect(parse?.[0]).toMatchObject({ tag: 'div[data-type="info-panel"]' });
  });
});
