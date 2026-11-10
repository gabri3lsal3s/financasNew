import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export type FilterChipTone = "default" | "positive" | "warning" | "critical";

export interface FilterChipItem {
  key: string;
  label: string;
  count?: number;
  tone?: FilterChipTone;
}

export interface FilterChipsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: readonly FilterChipItem[];
  activeKey: string;
  onChange: (key: string) => void;
  size?: "xs" | "sm";
  ariaLabel?: string;
}

const toneActiveStyles: Record<FilterChipTone, string> = {
  default: "bg-primary text-primary-foreground border-primary shadow-xs",
  positive: "bg-positive text-positive-foreground border-positive shadow-xs",
  warning: "bg-warning-strong text-white border-warning-strong shadow-xs",
  critical: "bg-critical text-critical-foreground border-critical shadow-xs",
};

const toneInactiveStyles: Record<FilterChipTone, string> = {
  default: "hover:text-foreground hover:border-border",
  positive: "hover:text-positive-strong hover:border-positive/40",
  warning: "hover:text-warning-strong hover:border-warning/40",
  critical: "hover:text-critical-strong hover:border-critical/40",
};

/**
 * Componente canônico de pílulas/chips de filtro (DRY).
 * Garante acessibilidade nativa (role radiogroup / radio), contadores padronizados
 * e feedback sensorial integrado sem disparos redundantes.
 */
export function FilterChips({
  items,
  activeKey,
  onChange,
  size = "sm",
  ariaLabel = "Filtros rápidos",
  className,
  ...props
}: FilterChipsProps) {
  const isXs = size === "xs";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      {...props}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;
        const tone = item.tone ?? "default";

        return (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => {
              triggerSensory("selection");
              onChange(item.key);
            }}
            className={cn(
              "inline-flex items-center justify-center shrink-0 rounded-lg border font-medium transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none",
              isXs ? "h-6 px-2 text-[11px]" : "h-7 sm:h-7.5 px-2.5 sm:px-3 text-xs",
              isActive
                ? cn(toneActiveStyles[tone], "font-semibold")
                : cn(
                    "border-border/70 bg-surface text-muted-foreground",
                    toneInactiveStyles[tone],
                  ),
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={cn(
                  "ml-1 font-semibold tabular-nums text-[10px]",
                  isActive ? "opacity-90" : "text-muted-foreground/80",
                )}
              >
                ({item.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
