import { TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";

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
 * Gráfico de Colunas SVG de Proventos (12 Meses) para Relatórios A4 / PDF.
 *
 * Demonstra visualmente a evolução e a consistência da renda passiva (Efeito Bola de Neve).
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
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/10 p-4 break-inside-avoid print:bg-white print:border-border",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary-strong" aria-hidden="true" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {title}
          </h4>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Média Mensal: <MoneyText cents={avgCents} className="font-bold text-foreground" />
          </span>
          {projectedAnnualCents !== undefined && (
            <span className="text-muted-foreground">
              Projeção 12m: <MoneyText cents={projectedAnnualCents} className="font-bold text-primary-strong" />
            </span>
          )}
        </div>
      </div>

      {/* Gráfico de Colunas SVG */}
      <div className="pt-2">
        <div className="grid grid-cols-12 gap-1.5 items-end h-20 w-full">
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
                  title={`${point.label}: ${point.amountCents / 100} BRL`}
                />
                <span className="text-[10px] text-muted-foreground font-mono num">
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
