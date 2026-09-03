# Forge brand

Forge is a coding agent harness — chat, tools, sandboxes, and previews. The identity has **one story: heat shapes raw code into refined tools.** The base is always *cooled iron* (graphite neutrals); the "heat" is a switchable accent, and the logo is a geometric **ember/flame** — the heat itself — that recolors with the active theme.

## Wordmark

- **Name:** Forge (sentence case in UI, title case in marketing)
- **Tagline:** *Heat shapes raw code into refined tools.*
- **Logo:** Ember/flame mark + wordmark (`ForgeMark` component). The flame's gradient reads from `--brand-logo-*`, so it matches whichever theme is active.

## Themes (switchable "heat")

Users pick a theme in **Settings → Appearance**; the choice persists in `localStorage` (`forge.brand-theme`) and is applied as `data-forge-theme` on `<html>`. All themes support light **and** dark.

| Theme | id | Story | Heat accent |
|-------|----|-------|-------------|
| **Molten Steel** *(default)* | `molten-steel` | Hot brass drawn from the forge | Bronze / brass |
| **Ember on Iron** | `ember-iron` | The red-hot strike | Crimson |
| **Cold Forged** | `cold-forged` | Precision, near-monochrome | Steel blue (the hottest part of a flame) |
| **Molten Glow** | `molten-glow` | Raw molten metal | Red→amber gradient |

The **base neutrals never change** — only the accent, ring, chart ramp, and logo glow do. This keeps every theme unmistakably "Forge."

## Color system

- **Neutrals (shared):** cooled-iron graphite. Light = near-white with a faint cool cast; dark = deep anthracite, never pure black.
- **Accent (per theme):** drives `primary`, `ring`, `accent`, sidebar accents, and the chat user-bubble.
- **Chart / activity scale:** `chart-1` … `chart-5` ramp within the active accent's hue (lightest → deepest) — never unrelated hues.
- **Destructive:** always red, independent of theme — never reuse the accent for delete/error states.

Semantic tokens (`primary`, `background`, `muted`, …) live in `src/index.css`; theme blocks override only the heat.

## Typography

- **UI font:** Geist Variable (already loaded)
- **Headings:** Geist, semibold/bold, tight tracking on hero lines
- **Monospace:** system default for code blocks

## Usage rules

1. **One accent per section** — don't flood the UI with heat; the graphite base does the heavy lifting.
2. **Cool graphite neutrals** — backgrounds stay slightly cool, never warm beige.
3. **Icons over text** for compact CTAs (dashboard, sidebars).
4. **Dark mode** — accent brightens; surfaces stay deep graphite.
5. **Destructive stays red** — never use the accent for delete/error states.
6. **Radius** — generous `0.75rem` base.

## Implementation

- CSS variables + theme blocks: `apps/web-ui/src/index.css`
- Theme metadata + provider/hook: `apps/web-ui/src/brand/use-brand-theme.tsx`
- TS brand tokens: `apps/web-ui/src/brand/tokens.ts`
- Theme picker: `apps/web-ui/src/components/brand-theme-picker.tsx`
- Logo: `apps/web-ui/src/components/forge-mark.tsx`
