import { cn } from "@/lib/utils";
import { MoneyText } from "@/components/ui/money-text";

export interface BudgetProgressBarProps {
  spentCents: number;
  limitCents: number;
  /** Rótulo opcional acima da barra (ex.: nome da categoria). */
  label?: string;
  className?: string;
}

/**
 * Resumo textual e barra gráfica de uso de orçamento da categoria (restante/excesso e percentual).
 */
export function BudgetProgressBar({ spentCents, limitCents, label, className }: BudgetProgressBarProps) {
  const percent = limitCents > 0 ? Math.min(100, (spentCents / limitCents) * 100) : 0;
  const over = spentCents > limitCents;
  const remainingCents = Math.max(0, limitCents - spentCents);
  const overCents = Math.max(0, spentCents - limitCents);

  return (
    <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      {label ? <p className="truncate text-xs font-medium text-muted-foreground">{label}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 min-w-0">
        <span className="flex flex-wrap items-center gap-1 text-xs min-w-0">
          {limitCents === 0 ? (
            <span className="text-muted-foreground text-[11px]">Sem limite definido</span>
          ) : over ? (
            <>
              <span className="text-critical font-semibold">+</span>
              <MoneyText cents={overCents} tone="default" className="text-xs font-semibold text-critical whitespace-nowrap" />
              <span className="text-critical/90 font-normal">acima do limite</span>
            </>
          ) : (
            <>
              <MoneyText cents={remainingCents} tone="default" className="text-xs font-semibold text-foreground whitespace-nowrap" />
              <span className="text-muted-foreground font-normal">restante de</span>
              <MoneyText cents={limitCents} tone="default" className="text-xs text-muted-foreground whitespace-nowrap" />
            </>
          )}
        </span>
        <span className={over ? "num shrink-0 text-xs font-semibold text-critical" : "num shrink-0 text-xs font-medium text-muted-foreground"}>
          {limitCents > 0 ? (over ? ">100%" : `${Math.round(percent)}%`) : ""}
        </span>
      </div>

      {limitCents > 0 && (
        <div className="relative mt-0.5 h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-muted/70">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              over ? "bg-critical" : percent >= 85 ? "bg-warning" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
