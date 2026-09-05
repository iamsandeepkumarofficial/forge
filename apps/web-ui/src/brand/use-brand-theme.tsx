import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";

export type BrandThemeId =
  "molten-steel" | "ember-iron" | "cold-forged" | "molten-glow";

export type BrandThemeMeta = {
  id: BrandThemeId;
  label: string;
  description: string;

  swatch: [string, string];
};

export const BRAND_THEMES: readonly BrandThemeMeta[] = [
  {
    id: "molten-steel",
    label: "Molten Steel",
    description: "Brass heat on cooled iron",
    swatch: ["#8a6428", "#caa055"]
  },
  {
    id: "ember-iron",
    label: "Ember on Iron",
    description: "Red-hot crimson strike",
    swatch: ["#7c1f1f", "#d6503f"]
  },
  {
    id: "cold-forged",
    label: "Cold Forged",
    description: "Steel-blue, near monochrome",
    swatch: ["#2f3b5c", "#5f79b6"]
  },
  {
    id: "molten-glow",
    label: "Molten Glow",
    description: "Red-to-amber molten gradient",
    swatch: ["#b23c1c", "#e39b34"]
  }
] as const;

export const BRAND_THEME_STORAGE_KEY = "forge.brand-theme";
export const DEFAULT_BRAND_THEME: BrandThemeId = "molten-steel";

export function isBrandThemeId(value: unknown): value is BrandThemeId {
  return (
    typeof value === "string" &&
    BRAND_THEMES.some((theme) => theme.id === value)
  );
}

export function applyBrandTheme(id: BrandThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-forge-theme", id);
}

function readStoredTheme(): BrandThemeId {
  try {
    const stored = localStorage.getItem(BRAND_THEME_STORAGE_KEY);
    if (isBrandThemeId(stored)) return stored;
  } catch {
    void 0;
  }
  return DEFAULT_BRAND_THEME;
}

type BrandThemeContextValue = {
  theme: BrandThemeId;
  setTheme: (id: BrandThemeId) => void;
  themes: readonly BrandThemeMeta[];
};

const BrandThemeContext = createContext<BrandThemeContextValue | null>(null);

export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<BrandThemeId>(() => {
    const initial = readStoredTheme();
    applyBrandTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyBrandTheme(theme);
  }, [theme]);

  const setTheme = useCallback((id: BrandThemeId) => {
    setThemeState(id);
    try {
      localStorage.setItem(BRAND_THEME_STORAGE_KEY, id);
    } catch {
      void 0;
    }
  }, []);

  return (
    <BrandThemeContext.Provider
      value={{ theme, setTheme, themes: BRAND_THEMES }}
    >
      {children}
    </BrandThemeContext.Provider>
  );
}

function useStandaloneBrandTheme(active: boolean): BrandThemeContextValue {
  const [theme, setThemeState] = useState<BrandThemeId>(() =>
    active ? readStoredTheme() : DEFAULT_BRAND_THEME
  );
  useEffect(() => {
    if (active) applyBrandTheme(theme);
  }, [active, theme]);
  const setTheme = useCallback(
    (id: BrandThemeId) => {
      if (!active) return;
      setThemeState(id);
      try {
        localStorage.setItem(BRAND_THEME_STORAGE_KEY, id);
      } catch {
        void 0;
      }
      applyBrandTheme(id);
    },
    [active]
  );
  return { theme, setTheme, themes: BRAND_THEMES };
}

export function useBrandTheme(): BrandThemeContextValue {
  const ctx = useContext(BrandThemeContext);
  const fallback = useStandaloneBrandTheme(ctx === null);
  return ctx ?? fallback;
}
