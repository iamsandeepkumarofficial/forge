/**
 * Forge brand — one story ("heat shapes metal"), switchable heat.
 * Base neutrals stay cooled-iron graphite; each theme swaps the accent + logo
 * glow. CSS values live in src/index.css, keyed by data-forge-theme.
 */
export const FORGE_BRAND = {
  name: "Forge",
  tagline: "Heat shapes raw code into refined tools.",
  voice: {
    tone: "Precise, industrial, warm with restraint — a maker's workshop.",
    avoid: "Generic SaaS gradients, cold corporate blue as the whole identity."
  },
  defaultThemeId: "molten-steel",
  font: {
    sans: "'Geist Variable', system-ui, sans-serif"
  },
  radius: {
    sm: "0.375rem",
    md: "0.625rem",
    lg: "0.75rem",
    xl: "1.125rem"
  }
} as const;
