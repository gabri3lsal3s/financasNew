import { useMemo } from "react";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { PortfolioMonthlySeriesPoint } from "@/domain/portfolio";
import { formatMonthYear, monthLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "@/services/masks";

export interface SnapshotsPeriodSummary {
  totalMonths: number;
  latestValueBRL: number;
  latestCostBRL: number;
  periodDividendsBRL: number;
  openingDividendsBalanceBRL?: number;
  totalHistoricalDividendsBRL?: number;
  latestTwrPct: number | null;
}

export interface SnapshotsEvolutionChartProps {
  series: readonly PortfolioMonthlySeriesPoint[];
  summary: SnapshotsPeriodSummary;
}

export function SnapshotsEvolutionChart({
  series,
  summary,
}: SnapshotsEvolutionChartProps) {
  const chronological = useMemo(
    () => [...series].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
    [series],
  );

  const maxValue = useMemo(
    () => Math.max(1, ...chronological.map((pt) => Math.max(pt.valueBRL, pt.costBRL))),
    [chronological],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* KPI Strip Institucional de 4 Colunas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-2.5 rounded-xl border border-border/80 bg-surface p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Patrimônio Final
          </span>
          <MoneyText
            cents={numberToCents(summary.latestValueBRL)}
            tone="default"
            className="text-sm sm:text-base font-bold"
          />
          <span className="text-[10px] text-muted-foreground">
            {summary.totalMonths} {summary.totalMonths === 1 ? "mês" : "meses"}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Custo Aplicado
          </span>
          <MoneyText
            cents={numberToCents(summary.latestCostBRL)}
            tone="default"
            className="text-sm sm:text-base font-semibold text-muted-foreground"
          />
          <span className="text-[10px] text-muted-foreground">
            Capital investido líquido
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Proventos no Período
          </span>
          <MoneyText
            cents={numberToCents(summary.periodDividendsBRL)}
            tone="positive"
            className="text-sm sm:text-base font-bold"
          />
          <span className="text-[10px] text-muted-foreground truncate">
            {summary.openingDividendsBalanceBRL && summary.openingDividendsBalanceBRL > 0
              ? `+ R$ ${summary.openingDividendsBalanceBRL.toFixed(2).replace(".", ",")} saldo retroativo`
              : "Renda passiva creditada"}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            TWR Acumulado
          </span>
          <span
            className={cn(
              "num font-mono text-sm sm:text-base font-bold whitespace-nowrap",
              (summary.latestTwrPct ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong",
            )}
          >
            {summary.latestTwrPct !== null
              ? formatSignedPct(summary.latestTwrPct, 1)
              : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Retorno por cotas (Padrão CVM)
          </span>
        </div>
      </div>

      {chronological.length >= 2 ? (
        <div className="rounded-xl border border-border/80 bg-surface p-3 sm:p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="text-xs font-semibold text-foreground">
              Evolução Patrimônio vs. Custo ({monthLabel(chronological[0]!.month)} a{" "}
              {monthLabel(chronological[chronological.length - 1]!.month)})
            </span>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-portfolio" aria-hidden="true" />
                Patrimônio
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-muted-foreground/35" aria-hidden="true" />
                Custo
              </span>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${chronological.length * 48} 88`}
            className="w-full h-24 overflow-visible"
            role="img"
            aria-label="Gráfico comparativo de evolução patrimonial versus custo aplicado"
          >
            {chronological.map((pt, idx) => {
              const x = idx * 48 + 8;
              const valHeight = Math.max(4, Math.round((pt.valueBRL / maxValue) * 56));
              const costHeight = Math.max(2, Math.round((pt.costBRL / maxValue) * 56));
              return (
                <g key={pt.month}>
                  <rect
                    x={x}
                    y={64 - costHeight}
                    width={12}
                    height={costHeight}
                    rx={3}
                    fill="hsl(var(--muted-foreground) / 0.3)"
                  />
                  <rect
                    x={x + 15}
                    y={64 - valHeight}
                    width={14}
                    height={valHeight}
                    rx={3}
                    fill="hsl(var(--portfolio))"
                  />
                  <text
                    x={x + 14}
                    y={80}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px] font-mono"
                  >
                    {formatMonthYear(pt.month).slice(0, 3)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : null}
    </div>
  );
}
