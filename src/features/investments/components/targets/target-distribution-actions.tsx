import { Equal, RotateCcw, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";

export interface TargetDistributionActionsProps {
  sum: number;
  disabled: boolean;
  normalizeLabel: string;
  resetLabel: string;
  onDistributeRemaining?: () => void;
  onNormalize: () => void;
  onDistributeEqually: () => void;
  onResetZero: () => void;
}

export function TargetDistributionActions({
  sum,
  disabled,
  normalizeLabel,
  resetLabel,
  onDistributeRemaining,
  onNormalize,
  onDistributeEqually,
  onResetZero,
}: TargetDistributionActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onDistributeRemaining && sum < 100 && sum > 0 ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          sensoryIntent="selection"
          onClick={onDistributeRemaining}
          disabled={disabled}
          className="gap-1.5 text-xs font-semibold"
        >
          <Sparkles className="size-3.5 shrink-0 text-primary-strong" aria-hidden="true" />
          Distribuir restante ({(100 - sum).toFixed(1)}%)
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        sensoryIntent="selection"
        onClick={onNormalize}
        disabled={disabled}
        className="gap-1.5 text-xs"
      >
        <Scale className="size-3.5 shrink-0" aria-hidden="true" />
        {normalizeLabel}
      </Button>
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
