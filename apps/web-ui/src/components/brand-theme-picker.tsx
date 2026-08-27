import { Check } from "lucide-react";
import { useBrandTheme } from "@/brand/use-brand-theme";
import { cn } from "@/lib/utils";

export function BrandThemePicker() {
  const { theme, setTheme, themes } = useBrandTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Brand theme"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {themes.map((option) => {
        const selected = option.id === theme;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(option.id)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              selected
                ? "border-primary ring-2 ring-ring"
                : "border-border hover:bg-muted/50"
            )}
          >
            <span
              aria-hidden
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${option.swatch[0]}, ${option.swatch[1]})`
              }}
            >
              {selected && <Check className="size-5 text-white drop-shadow" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
