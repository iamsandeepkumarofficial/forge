import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  BrandThemeProvider,
  BRAND_THEME_STORAGE_KEY,
  DEFAULT_BRAND_THEME,
  applyBrandTheme,
  isBrandThemeId,
  useBrandTheme
} from "./use-brand-theme";

function wrapper({ children }: { children: ReactNode }) {
  return <BrandThemeProvider>{children}</BrandThemeProvider>;
}

describe("use-brand-theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-forge-theme");
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-forge-theme");
  });

  it("validates theme ids and applies them to the document", () => {
    expect(isBrandThemeId(DEFAULT_BRAND_THEME)).toBe(true);
    expect(isBrandThemeId("nope")).toBe(false);
    applyBrandTheme("cold-forged");
    expect(document.documentElement.getAttribute("data-forge-theme")).toBe(
      "cold-forged"
    );
  });

  it("reads and persists theme through the provider", () => {
    localStorage.setItem(BRAND_THEME_STORAGE_KEY, "ember-iron");
    const { result } = renderHook(() => useBrandTheme(), { wrapper });
    expect(result.current.theme).toBe("ember-iron");
    act(() => {
      result.current.setTheme("molten-glow");
    });
    expect(result.current.theme).toBe("molten-glow");
    expect(localStorage.getItem(BRAND_THEME_STORAGE_KEY)).toBe("molten-glow");
    expect(document.documentElement.getAttribute("data-forge-theme")).toBe(
      "molten-glow"
    );
  });
});
