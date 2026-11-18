import { TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface MonthlyDividendPoint {
  month: string; // "YYYY-MM"
  label: string; // "Jan", "Fev"
  amountCents: number;
}

export interface ReportDividendSparklineProps {
  title?: string;
  points: readonly MonthlyDividendPoint[];
  averageMonthlyCents?: number;
  projectedAnnualCents?: number;
  className?: string;
}

/**
 * Gráfico de Colunas de Proventos (12 Meses) para Relatórios A4 / PDF.
 */
export function ReportDividendSparkline({
  title = "Evolução dos Proventos & Renda Passiva (Últimos 12 Meses)",
  points,
  averageMonthlyCents,
  projectedAnnualCents,
  className,
}: ReportDividendSparklineProps) {
  const maxAmount = Math.max(...points.map((p) => p.amountCents), 1);
  const totalCents = points.reduce((acc, p) => acc + p.amountCents, 0);
  const avgCents = averageMonthlyCents ?? (points.length > 0 ? Math.round(totalCents / points.length) : 0);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/10 p-3.5 shadow-xs break-inside-avoid print:bg-surface print:border-border",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/80 pb-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            {title}
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="text-muted-foreground whitespace-nowrap">
            Média Mensal: <MoneyText cents={avgCents} className="font-bold text-foreground" />
          </span>
          {projectedAnnualCents !== undefined && (
            <span className="text-muted-foreground whitespace-nowrap">
              Projeção 12m: <MoneyText cents={projectedAnnualCents} className="font-bold text-primary-strong" />
            </span>
          )}
        </div>
      </div>

      <div className="pt-1">
        <div className="grid grid-cols-12 gap-1 items-end h-16 w-full">
          {points.map((point) => {
            const heightPct = Math.max(Math.round((point.amountCents / maxAmount) * 100), 4);
            const isZero = point.amountCents <= 0;

            return (
              <div key={point.month} className="flex flex-col items-center gap-1 h-full justify-end">
                <div
                  style={{ height: `${heightPct}%` }}
                  className={cn(
                    "w-full rounded-xs transition-all duration-300",
                    isZero ? "bg-muted/40" : "bg-primary-strong/80 print:bg-primary-strong",
                  )}
                  title={`${point.label}: ${formatCentsAsBRL(point.amountCents)}`}
                />
                <span className="text-[10px] text-muted-foreground font-mono num tabular-nums">
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
