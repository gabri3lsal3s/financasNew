import { useState } from "react";
import { CalendarDays, Plus, Sparkles, Trash2, TrendingUp } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, SkeletonTable } from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { calculateSnowballProgress, isCashAssetClass } from "@/domain/portfolio";
import { currentMonth, formatDateBR, monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import {
  useDeletePortfolioDividend,
  usePortfolioAssets,
  usePortfolioDividends,
  usePortfolioPosition,
} from "@/state";
import { DividendFormDialog } from "@/features/investments/components";
import type { PortfolioDividend } from "@/types";

/**
 * Proventos da carteira (§F36 e §F39) — extrato mensal dos rendimentos RECEBIDOS
 * a partir de `portfolio_dividends`, calendário anual e indicador do Efeito Bola de Neve.
 */
export function ProventosTab() {
  const dividendsQuery = usePortfolioDividends();
  const assetsQuery = usePortfolioAssets();
  const position = usePortfolioPosition();
  const deleteDividend = useDeletePortfolioDividend();

  const [month, setMonth] = useState(() => currentMonth());
  const [dividendOpen, setDividendOpen] = useState(false);
  const [dividendToDelete, setDividendToDelete] = useState<PortfolioDividend | null>(null);

  const dividends = dividendsQuery.data ?? [];
  const assets = assetsQuery.data ?? [];
  const tickerByAssetId = new Map(assets.map((asset) => [asset.id, asset.ticker]));
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

  // Calcula o progresso da Bola de Neve para ativos com proventos
  const snowballItems = assets
    .filter((a) => !isCashAssetClass(a.asset_class) && a.quantity > 0)
    .map((a) => {
      const assetDivs = dividends.filter((d) => d.asset_id === a.id);
      if (assetDivs.length === 0) return null;

      // Último provento recebido por cota
      const latestDiv = assetDivs.sort((d1, d2) => d2.date.localeCompare(d1.date))[0];
      const monthlyDividendPerShare = latestDiv && a.quantity > 0 ? latestDiv.amount / a.quantity : 0;
      const row = position.rows.find((r) => r.assetId === a.id);
      const currentPrice = row && row.priceBRL > 0 ? row.priceBRL : a.average_price;

      if (monthlyDividendPerShare <= 0 || currentPrice <= 0) return null;

      const progress = calculateSnowballProgress({
        quantity: a.quantity,
        currentPrice,
        monthlyDividendPerShare,
      });

      return {
        asset: a,
        currentPrice,
        progress,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.progress.progressPct - a.progress.progressPct);

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

  const maxMonthTotal = Math.max(...yearly.map((e) => e.total), 1);

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

          {/* Seção do Efeito Bola de Neve (Renda Passiva) */}
          {snowballItems.length > 0 && (
            <section aria-label="Efeito Bola de Neve" className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Efeito Bola de Neve (Renda Passiva)</h3>
                    <p className="text-xs text-muted-foreground">Progresso para que os proventos mensais comprem 1 nova cota inteira sozinhos.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {snowballItems.map(({ asset, currentPrice, progress }) => (
                  <div
                    key={asset.id}
                    className={`flex flex-col gap-2.5 rounded-xl border p-3.5 transition-colors ${
                      progress.isSnowballActive
                        ? "border-positive-strong/40 bg-positive-surface/20"
                        : "border-border/80 bg-surface-hover/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <strong className="text-sm font-bold text-foreground truncate">{asset.ticker}</strong>
                        <span className="text-[11px] text-muted-foreground">({asset.quantity} cotas)</span>
                      </div>
                      {progress.isSnowballActive ? (
                        <Badge variant="positive" className="text-[10px] px-1.5 py-0">
                          Bola de Neve Ativa
                        </Badge>
                      ) : (
                        <span className="text-[11px] font-semibold text-portfolio">
                          {progress.progressPct}%
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                      <span className="text-muted-foreground">Renda mensal estimada</span>
                      <span className="font-semibold text-positive-strong">
                        <MoneyText cents={numberToCents(progress.currentMonthlyIncome)} tone="positive" />
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Custo de 1 cota</span>
                      <span className="font-semibold text-foreground">
                        <MoneyText cents={numberToCents(currentPrice)} tone="default" />
                      </span>
                    </div>

                    {/* Barra de progresso */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50" aria-hidden="true">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          progress.isSnowballActive ? "bg-positive-strong" : "bg-portfolio"
                        }`}
                        style={{ width: `${Math.max(4, Math.min(100, progress.progressPct))}%` }}
                      />
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      {progress.isSnowballActive ? (
                        <span className="text-positive-strong font-medium">
                          Este ativo já compra 1+ nova cota por mês sozinho.
                        </span>
                      ) : (
                        <span>
                          Faltam <strong>{progress.remainingShares}</strong> cotas para se pagar sozinho.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

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
                  const ticker = (entry.asset_id ? tickerByAssetId.get(entry.asset_id) : null) ?? entry.ticker ?? "Ativo";
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
                      className={`flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        active
                          ? "border-portfolio/40 bg-portfolio/10"
                          : "border-border/80 bg-transparent hover:border-border"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-xs font-medium capitalize text-foreground">{monthLabel(entry.month)}</span>
                        {hasValue ? (
                          <span className="num text-xs font-semibold text-positive-strong">
                            <MoneyText cents={numberToCents(entry.total)} tone="positive" />
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </div>
                      {hasValue ? (
                        <div className="h-1 w-full overflow-hidden rounded-full bg-border/40" aria-hidden="true">
                          <div
                            className="h-full rounded-full bg-positive-strong transition-all duration-300"
                            style={{ width: `${Math.max(4, Math.min(100, (entry.total / maxMonthTotal) * 100))}%` }}
                          />
                        </div>
                      ) : null}
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
