import { Check } from "lucide-react";
import type { AccentTheme } from "@/hooks/use-visual-customization";
import { cn } from "@/lib/utils";

const ACCENT_OPTIONS: { id: AccentTheme; label: string; swatchCssVar?: string }[] = [
  { id: "teal", label: "Teal Vital (Oficial)", swatchCssVar: "hsl(var(--accent-swatch-teal))" },
  { id: "mono", label: "Monocromático (Recomendado para OLED)" },
  { id: "gold", label: "Ouro Âmbar", swatchCssVar: "hsl(var(--accent-swatch-gold))" },
  { id: "sapphire", label: "Safira Petróleo", swatchCssVar: "hsl(var(--accent-swatch-sapphire))" },
  { id: "violet", label: "Violeta Íris", swatchCssVar: "hsl(var(--accent-swatch-violet))" },
  { id: "rose", label: "Coral Rosé", swatchCssVar: "hsl(var(--accent-swatch-rose))" },
];

export interface AccentPaletteSelectorProps {
  accent: AccentTheme;
  onSelectAccent: (id: AccentTheme, label: string) => void;
}

export function AccentPaletteSelector({ accent, onSelectAccent }: AccentPaletteSelectorProps) {
  return (
    <div className="space-y-2.5 pt-2 border-t border-border/80">
      <div className="text-xs font-semibold text-foreground">Cor de Destaque (Accent)</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {ACCENT_OPTIONS.map((a) => {
          const isSelected = accent === a.id;
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectAccent(a.id, a.label)}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors duration-150 select-none cursor-pointer min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs"
                  : "border-border/80 bg-surface hover:bg-surface-hover",
              )}
            >
              <span
                className={cn(
                  "size-5 rounded-full shrink-0 shadow-xs flex items-center justify-center border border-border/80",
                  !a.swatchCssVar && "bg-foreground",
                )}
                style={a.swatchCssVar ? { backgroundColor: a.swatchCssVar } : undefined}
              >
                {isSelected && (
                  <Check
                    className={cn(
                      "size-3",
                      a.id === "mono" ? "text-background" : "text-primary-foreground",
                    )}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="font-medium text-xs text-foreground leading-tight line-clamp-2 break-words">
                {a.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
