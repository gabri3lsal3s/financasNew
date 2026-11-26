import { Equal, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { formatPercent } from "@/services/masks";

export interface TargetDistributionActionsProps {
  sum: number;
  disabled: boolean;
  resetLabel: string;
  onDistributeRemaining?: () => void;
  onDistributeEqually: () => void;
  onResetZero: () => void;
}

export function TargetDistributionActions({
  sum,
  disabled,
  resetLabel,
  onDistributeRemaining,
  onDistributeEqually,
  onResetZero,
}: TargetDistributionActionsProps) {
  const remaining = Math.max(0, Math.round((100 - sum) * 10) / 10);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onDistributeRemaining && remaining > 0.05 && remaining < 100 ? (
        <Button
          type="button"
          variant="default"
          size="sm"
          sensoryIntent="selection"
          onClick={onDistributeRemaining}
          disabled={disabled}
          className="gap-1.5 text-xs font-semibold shadow-xs"
        >
          <Sparkles className="size-3.5 shrink-0 text-primary-strong" aria-hidden="true" />
          Distribuir restante ({formatPercent(remaining)}%)
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        sensoryIntent="selection"
        onClick={onDistributeEqually}
        disabled={disabled}
        className="gap-1.5 text-xs"
      >
        <Equal className="size-3.5 shrink-0" aria-hidden="true" />
        Distribuir igualmente (1/N)
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        sensoryIntent="selection"
        onClick={onResetZero}
        disabled={disabled}
        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
        {resetLabel}
      </Button>
    </div>
  );
}
