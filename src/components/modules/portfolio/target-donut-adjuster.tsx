import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPercent } from "@/services/masks/percent";

export interface TargetDonutAdjusterProps {
  label: string;
  targetPercent: number;
  currentPercent?: number;
  color?: string;
  unitLabel: string;
  disabled: boolean;
  onAdjust: (delta: number) => void;
}

export function TargetDonutAdjuster({
  label,
  targetPercent,
  currentPercent,
  color,
  unitLabel,
  disabled,
  onAdjust,
}: TargetDonutAdjusterProps) {
  return (
    <div className="flex flex-col gap-2 w-full md:w-auto shrink-0 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-border/80 md:pl-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-foreground truncate">
          Ajuste rápido: <span style={color ? { color } : undefined}>{label}</span>
        </span>
        <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
          <span className="num font-bold text-foreground">
            Meta: {formatPercent(targetPercent)}
            {unitLabel}
          </span>
          {currentPercent !== undefined ? (
            <span className="text-[11px] text-muted-foreground">
              (atual: {formatPercent(currentPercent)}
              {unitLabel})
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          sensoryIntent="selection"
          disabled={disabled || targetPercent <= 0}
          onClick={() => onAdjust(-5)}
          className="h-8 px-2 text-xs gap-0.5"
          aria-label={`Diminuir 5% de ${label}`}
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          -5{unitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          sensoryIntent="selection"
          disabled={disabled || targetPercent <= 0}
          onClick={() => onAdjust(-1)}
          className="h-8 px-2 text-xs gap-0.5"
          aria-label={`Diminuir 1% de ${label}`}
        >
          <Minus className="size-3" aria-hidden="true" />
          -1{unitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          sensoryIntent="selection"
          disabled={disabled || targetPercent >= 100}
          onClick={() => onAdjust(1)}
          className="h-8 px-2 text-xs gap-0.5"
          aria-label={`Aumentar 1% de ${label}`}
        >
          <Plus className="size-3" aria-hidden="true" />
          +1{unitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          sensoryIntent="selection"
          disabled={disabled || targetPercent >= 100}
          onClick={() => onAdjust(5)}
          className="h-8 px-2 text-xs gap-0.5"
          aria-label={`Aumentar 5% de ${label}`}
        >
          +5{unitLabel}
          <ChevronRight className="size-3" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
