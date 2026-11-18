import { Equal, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

export interface TargetDistributionActionsProps {
  disabled: boolean;
  resetLabel: string;
  onDistributeEqually: () => void;
  onResetZero: () => void;
}

export function TargetDistributionActions({
  disabled,
  resetLabel,
  onDistributeEqually,
  onResetZero,
}: TargetDistributionActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
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
