import { generateYieldSensitivityTable, formatCeilingCurrency } from "@/domain/portfolio/ceiling-valuation";
import { cn } from "@/lib/utils";

export interface CeilingSensitivityTableProps {
  dpa: number;
  selectedYieldPct?: number;
  onSelectYield?: (yieldPct: number) => void;
  currency?: "BRL" | "USD";
  className?: string;
}

/**
 * Tabela compacta de sensibilidade de Preço Teto por faixa de Dividend Yield.
 */
export function CeilingSensitivityTable({
  dpa,
  selectedYieldPct = 6,
  onSelectYield,
  currency = "BRL",
  className,
}: CeilingSensitivityTableProps) {
  const rows = generateYieldSensitivityTable(dpa);
  if (rows.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border border-border/80 bg-surface/50 p-2.5", className)}>
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Sensibilidade de Preço Teto por Yield Alvo
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
        {rows.map((r) => {
          const isSelected = Math.abs(r.yieldPct - selectedYieldPct) < 0.01;
          return (
            <button
              key={r.yieldPct}
              type="button"
              onClick={() => onSelectYield?.(r.yieldPct)}
              className={cn(
                "flex flex-col items-center justify-center rounded-md border p-1.5 text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/10 text-primary-strong ring-1 ring-primary/30"
                  : "border-border/60 bg-surface hover:border-border hover:bg-surface-hover",
              )}
            >
              <span className="text-[10px] font-bold text-muted-foreground">{r.yieldPct}% a.a.</span>
              <span className="font-mono text-xs font-bold text-foreground">
                {formatCeilingCurrency(r.ceilingPrice, currency)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
