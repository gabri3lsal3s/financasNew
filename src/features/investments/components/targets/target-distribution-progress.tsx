import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface TargetDistributionProgressProps {
  label: string;
  sum: number;
}

export function TargetDistributionProgress({ label, sum }: TargetDistributionProgressProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-surface-raised/60 p-3">
      <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
        <span className="font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "font-mono font-bold tabular-nums",
              sum === 100
                ? "text-positive-strong"
                : sum > 100
                  ? "text-critical-strong"
                  : "text-foreground",
            )}
          >
            {sum.toFixed(1)}% / 100%
          </span>
          <Badge
            variant={sum === 100 ? "positive" : sum > 100 ? "critical" : "muted"}
            size="xs"
          >
            {sum === 100
              ? "Completo"
              : sum > 100
                ? `Excesso de ${(sum - 100).toFixed(1)}%`
                : `Faltam ${(100 - sum).toFixed(1)}%`}
          </Badge>
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-active/40">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            sum === 100 ? "bg-positive" : sum > 100 ? "bg-critical" : "bg-primary",
          )}
          style={{ width: `${Math.min(100, Math.max(0, sum))}%` }}
        />
      </div>
    </div>
  );
}
