import { CalendarDays } from "lucide-react";
import { KpiCard } from "@/components/modules";
import { Badge, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { MonthDividendSummary } from "@/domain/portfolio";
import type { YearlyDividendMonthPoint } from "@/domain/portfolio/dividends-analytics";
import { monthLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface DividendsCalendarPanelProps {
  year: string;
  selectedMonth: string;
  yearly: readonly YearlyDividendMonthPoint[];
  yearTotal: number;
  yearMonthlyAverage: number;
  bestMonth: MonthDividendSummary | null;
  maxMonthTotal: number;
  onSelectMonth: (month: string) => void;
}

export function DividendsCalendarPanel({
  year,
  selectedMonth,
  yearly,
  yearTotal,
  yearMonthlyAverage,
  bestMonth,
  maxMonthTotal,
  onSelectMonth,
}: DividendsCalendarPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label={`Total em ${year}`}
          cents={numberToCents(yearTotal)}
          tone="positive"
          hint={
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span>Acumulado do ano convertido em R$</span>
              <Badge variant="muted" size="xs">
                Ano {year}
              </Badge>
            </div>
          }
        />

        <KpiCard
          label="Média Mensal"
          cents={numberToCents(yearMonthlyAverage)}
          tone="positive"
          hint="Média estimada dos 12 meses"
        />

        <KpiCard
          label="Melhor Mês"
          value={bestMonth ? monthLabel(bestMonth.month) : "—"}
          hint={
            bestMonth ? (
              <span className="inline-flex items-center gap-1">
                <span>Pico de</span>
                <MoneyText
                  cents={numberToCents(bestMonth.total)}
                  tone="positive"
                  variant="caption"
                />
              </span>
            ) : (
              "Sem lançamentos no ano"
            )
          }
        />
      </div>

      <section
        aria-label={`Calendário de proventos de ${year}`}
        className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
      >
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Calendário de {year}</h2>
            <p className="text-xs text-muted-foreground">
              Clique em qualquer mês para abrir o extrato detalhado correspondente.
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {yearly.map((entry) => {
            const active = entry.month === selectedMonth;
            const hasValue = entry.total > 0;
            return (
              <li key={entry.month}>
                <button
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onSelectMonth(entry.month);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full min-h-11 flex-col gap-2 rounded-xl border p-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    active
                      ? "border-portfolio/60 bg-portfolio/10 shadow-xs"
                      : "border-border/80 bg-surface hover:border-border hover:bg-surface-hover/50",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {monthLabel(entry.month)}
                    </span>
                    <div className="flex flex-col items-end">
                      {hasValue ? (
                        <MoneyText
                          cents={numberToCents(entry.total)}
                          tone="positive"
                          className="text-xs font-bold"
                        />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                      {entry.projectedTotal > 0 ? (
                        <span className="text-[10px] text-portfolio font-medium flex items-center gap-1">
                          <span
                            className="inline-block size-1.5 rounded-full bg-portfolio shrink-0"
                            aria-hidden="true"
                          />
                          <span>Previsto:</span>
                          <MoneyText
                            cents={numberToCents(entry.projectedTotal)}
                            tone="portfolio"
                            variant="caption"
                            className="text-[10px]"
                          />
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {hasValue ? (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-positive-strong transition-all duration-300"
                        style={{
                          width: `${Math.max(4, Math.min(100, (entry.total / maxMonthTotal) * 100))}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
