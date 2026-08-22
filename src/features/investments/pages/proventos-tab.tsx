import { useState } from "react";
import { CalendarDays, Plus, Trash2, TrendingUp } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, SkeletonTable } from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { currentMonth, formatDateBR, monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useDeletePortfolioDividend, usePortfolioAssets, usePortfolioDividends } from "@/state";
import { DividendFormDialog } from "@/features/investments/components";
import type { PortfolioDividend } from "@/types";

/**
 * Proventos da carteira (§F36) — extrato mensal dos rendimentos RECEBIDOS
 * a partir de `portfolio_dividends` com calendário anual.
 */
export function ProventosTab() {
  const dividendsQuery = usePortfolioDividends();
  const assetsQuery = usePortfolioAssets();
  const deleteDividend = useDeletePortfolioDividend();

  const [month, setMonth] = useState(() => currentMonth());
  const [dividendOpen, setDividendOpen] = useState(false);
  const [dividendToDelete, setDividendToDelete] = useState<PortfolioDividend | null>(null);

  const dividends = dividendsQuery.data ?? [];
  const tickerByAssetId = new Map((assetsQuery.data ?? []).map((asset) => [asset.id, asset.ticker]));
  const year = month.slice(0, 4);

  // Filtra proventos do mês
  const extract = dividends.filter((d) => d.date.startsWith(month));
  const monthTotal = extract.reduce((acc, d) => acc + d.amount, 0);

  // Proventos por mês do ano corrente
  const allMonthsOfYear = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return `${year}-${mm}`;
  });

  const yearly = allMonthsOfYear.map((m) => {
    const total = dividends
      .filter((d) => d.date.startsWith(m))
      .reduce((acc, d) => acc + d.amount, 0);
    return { month: m, total };
  });

  const yearTotal = yearly.reduce((acc, e) => acc + e.total, 0);

  const hasAny = dividends.length > 0;
  const loading = dividendsQuery.isLoading || assetsQuery.isLoading;
  const error = dividendsQuery.error ?? assetsQuery.error;

  const handleDelete = async () => {
    if (!dividendToDelete) return;
    try {
      await deleteDividend.mutateAsync(dividendToDelete.id);
      setDividendToDelete(null);
    } catch {
      // Toast disparado pelo hook
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Proventos recebidos</h2>
          <p className="text-xs text-muted-foreground">Extrato e calendário de rendimentos de dividendos, JCP e FIIs.</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker value={month} onValueChange={setMonth} aria-label="Mês dos proventos" />
          <Button type="button" size="sm" onClick={() => setDividendOpen(true)} className="gap-1.5 shrink-0">
            <Plus className="size-4" aria-hidden="true" />
            Registrar provento
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="error">
          <div className="flex w-full items-center justify-between gap-3">
            <span>{getErrorMessage(error)}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => dividendsQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        </Alert>
      ) : null}

      {loading ? (
        <div aria-hidden="true">
          <SkeletonTable rows={4} />
        </div>
      ) : !hasAny ? (
        <EmptyState
          icon={<TrendingUp className="size-6" aria-hidden="true" />}
          title="Sem proventos ainda"
          description="Registre os rendimentos e dividendos recebidos das suas cotas para acompanhar o extrato e calendário anual."
          tone="portfolio"
          headingLevel="h2"
          action={
            <Button type="button" size="sm" onClick={() => setDividendOpen(true)} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              Registrar provento
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
              <p className="text-xs text-muted-foreground">Recebido em {monthLabel(month)}</p>
              <p className="num mt-1 text-2xl font-bold tracking-tight text-foreground">
                <MoneyText cents={numberToCents(monthTotal)} tone="positive" />
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {extract.length} {extract.length === 1 ? "provento" : "proventos"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
              <p className="text-xs text-muted-foreground">Total em {year}</p>
              <p className="num mt-1 text-2xl font-bold tracking-tight text-foreground">
                <MoneyText cents={numberToCents(yearTotal)} tone="positive" />
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Acumulado do ano (só recebidos)</p>
            </div>
          </div>

          <section aria-label={`Extrato de ${monthLabel(month)}`} className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Extrato do mês</h3>
              <Badge variant="muted" className="text-[11px]">
                {monthLabel(month)}
              </Badge>
            </div>

            {extract.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum provento recebido neste mês.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/70 rounded-xl border border-border/80">
                {extract.map((entry) => {
                  const ticker = tickerByAssetId.get(entry.asset_id) ?? "Ativo";
                  return (
                    <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">{ticker}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateBR(entry.date)} {entry.notes ? `· ${entry.notes}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="num shrink-0 text-sm font-semibold text-foreground">
                          <MoneyText cents={numberToCents(entry.amount)} tone="positive" />
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-negative-strong"
                          title="Excluir lançamento de provento"
                          onClick={() => setDividendToDelete(entry)}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-label={`Calendário de proventos de ${year}`} className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                <CalendarDays className="size-3.5" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">Calendário de {year}</h3>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {yearly.map((entry) => {
                const active = entry.month === month;
                const hasValue = entry.total > 0;
                return (
                  <li key={entry.month}>
                    <button
                      type="button"
                      onClick={() => setMonth(entry.month)}
                      aria-pressed={active}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-portfolio/40 bg-portfolio/10"
                          : "border-border/80 bg-transparent hover:border-border"
                      }`}
                    >
                      <span className="text-xs font-medium capitalize text-foreground">{monthLabel(entry.month)}</span>
                      {hasValue ? (
                        <span className="num text-xs font-semibold text-positive-strong">
                          <MoneyText cents={numberToCents(entry.total)} tone="positive" />
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <DividendFormDialog open={dividendOpen} onOpenChange={setDividendOpen} />

      <ConfirmDialog
        open={dividendToDelete !== null}
        onOpenChange={(next) => !next && setDividendToDelete(null)}
        title="Excluir provento?"
        description="O registro deste provento será removido da carteira."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteDividend.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
