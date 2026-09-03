import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BrandThemeProvider,
  BRAND_THEME_STORAGE_KEY
} from "@/brand/use-brand-theme";
import { BrandThemePicker } from "./brand-theme-picker";

describe("BrandThemePicker", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-forge-theme");
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-forge-theme");
  });

  it("defaults to molten steel and applies it to <html>", () => {
    render(
      <BrandThemeProvider>
        <BrandThemePicker />
      </BrandThemeProvider>
    );
    expect(document.documentElement.getAttribute("data-forge-theme")).toBe(
      "molten-steel"
    );
    expect(
      screen.getByRole("radio", { name: /Molten Steel/ }).getAttribute(
        "aria-checked"
      )
    ).toBe("true");
  });

  it("switches theme, persists it, and updates <html>", () => {
    render(
      <BrandThemeProvider>
        <BrandThemePicker />
      </BrandThemeProvider>
    );
    fireEvent.click(screen.getByRole("radio", { name: /Ember on Iron/ }));
    expect(document.documentElement.getAttribute("data-forge-theme")).toBe(
      "ember-iron"
    );
    expect(localStorage.getItem(BRAND_THEME_STORAGE_KEY)).toBe("ember-iron");
  });
});
