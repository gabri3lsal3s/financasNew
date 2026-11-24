import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  title?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  ariaLabel: string;
  size?: "sm" | "md";
  fullWidth?: boolean | "mobile";
  className?: string;
  disabled?: boolean;
}

/**
 * Primitivo canônico de controle segmentado (DRY).
 * Padroniza alternadores de modo, filtros exclusivos e visualizações
 * respeitando os tokens visuais, acessibilidade e feedback tátil unificado.
 */
export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "sm",
  fullWidth = false,
  className,
  disabled = false,
}: SegmentedControlProps<T>) {
  const isSm = size === "sm";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-xl border border-border/80 bg-muted/50 p-0.5 shadow-xs shrink-0 select-none",
        isSm ? "gap-0.5 sm:gap-1" : "gap-1",
        fullWidth === true && "w-full",
        fullWidth === "mobile" && "w-full sm:w-auto",
        className,
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const isDisabled = disabled || option.disabled;

        return (
          <Button
            key={option.value}
            type="button"
            variant={isSelected ? "default" : "ghost"}
            size="sm"
            sensoryIntent="selection"
            disabled={isDisabled}
            onClick={() => {
              if (option.value !== value) {
                triggerSensory("selection");
                onChange(option.value);
              }
            }}
            aria-pressed={isSelected}
            title={option.title ?? option.label}
            className={cn(
              "justify-center transition-all duration-150",
              fullWidth === true
                ? "flex-1"
                : fullWidth === "mobile"
                  ? "flex-1 sm:flex-initial"
                  : "flex-initial",
              isSm
                ? "h-8 sm:h-7 px-2.5 gap-1.5 text-xs"
                : "h-9 sm:h-8 px-3 gap-2 text-xs sm:text-sm",
              isSelected
                ? "border-primary/30 shadow-xs font-semibold text-primary-strong"
                : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-surface-hover/60",
            )}
          >
            {option.icon ? (
              <span className="shrink-0 [&>svg]:size-3.5 [&_svg]:text-current" aria-hidden="true">
                {option.icon}
              </span>
            ) : null}
            <span className="truncate">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
