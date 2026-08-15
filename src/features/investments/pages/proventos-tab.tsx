import { useState } from "react";
import { CalendarDays, Coins, TrendingUp } from "lucide-react";
import { Alert, Badge, Button, EmptyState, SkeletonTable } from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { dividendExtractForMonth, dividendsByYear, dividendsInMonth, isDividendType } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { currentMonth, monthLabel } from "@/lib/date";
import { PORTFOLIO_TX_LABELS } from "@/lib/labels";
import { getErrorMessage } from "@/services/errors";
import { useAllPortfolioTransactions, usePortfolioAssets } from "@/state";
import type { PortfolioTransaction, PortfolioTransactionType } from "@/types";

const formatDate = (iso: string): string => {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};

/**
 * Proventos da carteira (§F18) — extrato mensal dos rendimentos RECEBIDOS
 * (dividend/jcp/fii_yield) com calendário anual. Escopo mínimo: apenas
 * recebidos (provisionados ficam para ajuste futuro). Ficam SÓ na carteira
 * (D11 — sem lançamento automático [PROVENTO] no fluxo financeiro core).
 */
export function ProventosTab() {
  const transactionsQuery = useAllPortfolioTransactions();
  const assetsQuery = usePortfolioAssets();
  const [month, setMonth] = useState(() => currentMonth());

  const transactions: PortfolioTransaction[] = transactionsQuery.data ?? [];
  const tickerByAssetId = new Map((assetsQuery.data ?? []).map((asset) => [asset.id, asset.ticker]));
  const year = month.slice(0, 4);

  const monthTotal = dividendsInMonth(transactions, month);
  const yearTotal = dividendsByYear(transactions, year).reduce((acc, entry) => acc + entry.total, 0);
  const extract = dividendExtractForMonth(transactions, tickerByAssetId, month);
  const yearly = dividendsByYear(transactions, year);

  const hasAny = transactions.some((tx) => isDividendType(tx.type));
  const loading = transactionsQuery.isLoading || assetsQuery.isLoading;
  const error = transactionsQuery.error ?? assetsQuery.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
            <Coins className="size-3.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Proventos recebidos</h2>
            <p className="text-xs text-muted-foreground">Rendimentos de dividendos, JCP e FIIs — só na carteira (fora do fluxo financeiro core).</p>
          </div>
        </div>
        <MonthPicker value={month} onValueChange={setMonth} aria-label="Mês dos proventos" />
      </div>

      {error ? (
        <Alert variant="error">
          <div className="flex w-full items-center justify-between gap-3">
            <span>{getErrorMessage(error)}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => transactionsQuery.refetch()}>
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
          description="Registre transações de dividendo, JCP ou rendimento de FII na aba Resumo para acompanhar os rendimentos aqui."
          tone="portfolio"
          headingLevel="h2"
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
                {extract.map((entry, index) => (
                  <li key={`${entry.date}-${entry.ticker}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-foreground">{entry.ticker}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(entry.date)} · {PORTFOLIO_TX_LABELS[entry.type as PortfolioTransactionType] ?? entry.type}
                      </span>
                    </div>
                    <span className="num shrink-0 text-sm font-semibold text-foreground">
                      <MoneyText cents={numberToCents(entry.total)} tone="positive" />
                    </span>
                  </li>
                ))}
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
    </div>
  );
}
