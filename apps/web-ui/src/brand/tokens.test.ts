import { describe, it, expect } from "vitest";
import { FORGE_BRAND } from "./tokens";
import { BRAND_THEMES, isBrandThemeId } from "./use-brand-theme";

describe("FORGE_BRAND tokens", () => {
  it("defines core brand metadata", () => {
    expect(FORGE_BRAND.name).toBe("Forge");
    expect(FORGE_BRAND.tagline).toMatch(/./);
    expect(FORGE_BRAND.defaultThemeId).toBe("molten-steel");
  });

  it("ships four selectable themes with the default included", () => {
    expect(BRAND_THEMES).toHaveLength(4);
    expect(isBrandThemeId(FORGE_BRAND.defaultThemeId)).toBe(true);
    for (const theme of BRAND_THEMES) {
      expect(theme.swatch[0]).toMatch(/^#/);
      expect(theme.swatch[1]).toMatch(/^#/);
    }
  });

  it("rejects unknown theme ids", () => {
    expect(isBrandThemeId("nope")).toBe(false);
  });
});
