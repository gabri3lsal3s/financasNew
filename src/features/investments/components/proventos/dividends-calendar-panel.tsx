import { CalendarClock, CalendarDays } from "lucide-react";
import { KpiCard } from "@/components/modules";
import { Badge, Button, EmptyState, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { MonthDividendSummary, SuggestedDividendItem } from "@/domain/portfolio";
import type { YearlyDividendMonthPoint } from "@/domain/portfolio/dividends-analytics";
import { formatDateBR, monthLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks/percent";
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
  pendingItems?: readonly SuggestedDividendItem[];
  provisionedItems?: readonly SuggestedDividendItem[];
  onOpenReview?: () => void;
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
  pendingItems = [],
  provisionedItems = [],
  onOpenReview,
}: DividendsCalendarPanelProps) {
  const agendaItems = [...pendingItems, ...provisionedItems];

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

      {agendaItems.length > 0 || onOpenReview ? (
        <section
          aria-label="Agenda de proventos provisionados e a confirmar"
          className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
        >
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarClock className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  Agenda de Proventos Provisionados e a Confirmar
                </h2>
                <p className="text-xs text-muted-foreground">
                  Eventos futuros e pendentes ficam segregados fora do Patrimônio e do Caixa até a liquidação.
                </p>
              </div>
            </div>
            {onOpenReview ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenReview}
                className="shrink-0 self-start sm:self-center"
              >
                Conferir / Provisionar
              </Button>
            ) : null}
          </div>

          {agendaItems.length === 0 ? (
            <EmptyState
              title="Nenhum provento provisionado no momento"
              description="Proventos com Data COM cumprida capturados automaticamente ou cadastrados manualmente aparecerão nesta agenda."
              headingLevel="h3"
            />
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80">
              {agendaItems.map((item) => {
                const key = item.eventId ?? `${item.corporateDividendId}:${item.assetId}`;
                const taxPct = item.taxRatePct ?? 0;
                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 text-xs"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-foreground">{item.ticker}</span>
                        <Badge
                          size="xs"
                          variant={item.status === "available" ? "warning" : "portfolio"}
                        >
                          {item.status === "available" ? "A confirmar" : "Provisionado"}
                        </Badge>
                        <Badge size="xs" variant={item.type === "JCP" ? "warning" : "muted"}>
                          {item.type}
                        </Badge>
                        {item.currency === "USD" ? (
                          <Badge size="xs" variant="portfolio">
                            {`EUA · ${formatPercent(taxPct)}% IR`}
                          </Badge>
                        ) : taxPct > 0 ? (
                          <Badge size="xs" variant="warning">
                            {`${formatPercent(taxPct)}% IR`}
                          </Badge>
                        ) : null}
                        {item.isTypeUncertain ? (
                          <Badge size="xs" variant="warning">
                            Alíquota a conferir
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {`Data COM ${formatDateBR(item.comDate)} · ${
                          item.paymentDate
                            ? `Pagamento ${formatDateBR(item.paymentDate)}`
                            : "Data a definir"
                        }`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <MoneyText
                        cents={numberToCents(item.totalAmount)}
                        currency={item.currency}
                        tone="portfolio"
                        className="font-semibold"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
