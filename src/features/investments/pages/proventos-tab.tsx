import { useState } from "react";
import { useSearchParams } from "react-router";
import { CalendarDays, Sparkles, Trash2, TrendingUp } from "lucide-react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, SkeletonTable, Tabs } from "@/components/ui";


import { MonthPicker, SnowballActionCard } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import {
  calculateSnowballProgress,
  calculateYieldOnCostTotal,
  detectReinvestmentOpportunities,
  resolveMonthlyDividendPerShare,
  type ReinvestmentOpportunity,
} from "@/domain/portfolio/snowball";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import { currentMonth, formatDateBR, monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import {
  useDeletePortfolioDividend,
  usePortfolioAssets,
  usePortfolioDividends,
  usePortfolioPosition,
} from "@/state";
import type { PortfolioAsset, PortfolioDividend } from "@/types";
import type { WizardMode } from "../wizard/wizard-state";

type ProventosSubTab = "extrato" | "calendario";

export interface ProventosTabProps {
  defaultMonth?: string;
  onOpenWizard?: (asset?: PortfolioAsset | null, mode?: WizardMode) => void;
}

/**
 * Proventos da carteira (§F36 e §F39) — extrato mensal dos rendimentos RECEBIDOS
 * a partir de `portfolio_dividends`, indicador do Efeito Bola de Neve e calendário anual.
 *
 * Sub-tabs:
 * - Extrato & Indicadores: barra de filtros, KPIs do mês/ano/histórico, extrato mensal e Bola de Neve.
 * - Calendário Anual: visualização dos 12 meses com barras proporcionais de rendimento.
 */
export function ProventosTab({ defaultMonth, onOpenWizard }: ProventosTabProps) {
  const [searchParams] = useSearchParams();
  const dividendsQuery = usePortfolioDividends();
  const assetsQuery = usePortfolioAssets();
  const position = usePortfolioPosition();
  const deleteDividend = useDeletePortfolioDividend();

  const rawSubTab = (searchParams.get("subtab") || searchParams.get("subTab") || searchParams.get("aba"))?.toLowerCase();
  const validSubTab = rawSubTab === "calendario" || rawSubTab === "extrato" ? rawSubTab : null;
  const [selectedSubTab, setSelectedSubTab] = useState<ProventosSubTab>("extrato");
  const subTab: ProventosSubTab = validSubTab ?? selectedSubTab;
  const [month, setMonth] = useState(() => defaultMonth ?? currentMonth());
  const [dividendToDelete, setDividendToDelete] = useState<PortfolioDividend | null>(null);

  const dividends = dividendsQuery.data ?? [];
  const assets = assetsQuery.data ?? [];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const rowByAssetId = new Map(position.rows.map((row) => [row.assetId, row]));
  const year = month.slice(0, 4);

  const getDividendAmountBRL = (d: PortfolioDividend) => {
    const asset = d.asset_id ? assetById.get(d.asset_id) : null;
    const row = d.asset_id ? rowByAssetId.get(d.asset_id) : null;
    const isUSD = asset?.currency === "USD" || row?.currency === "USD";
    const rate = isUSD ? (row?.usdRate || 5.25) : 1;
    return d.amount * rate;
  };

  // Filtra proventos do mês
  const extract = dividends.filter((d) => d.date.startsWith(month));
  const monthTotal = extract.reduce((acc, d) => acc + getDividendAmountBRL(d), 0);

  // Proventos por mês do ano corrente
  const allMonthsOfYear = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return `${year}-${mm}`;
  });

  const yearly = allMonthsOfYear.map((m) => {
    const total = dividends
      .filter((d) => d.date.startsWith(m))
      .reduce((acc, d) => acc + getDividendAmountBRL(d), 0);
    return { month: m, total };
  });

  const yearTotal = yearly.reduce((acc, e) => acc + e.total, 0);

  // Proventos históricos iniciais acumulados cadastrados nos ativos
  const historicalTotal = assets.reduce((acc, a) => {
    const row = rowByAssetId.get(a.id);
    const isUSD = a.currency === "USD" || row?.currency === "USD";
    const rate = isUSD ? (row?.usdRate || 5.25) : 1;
    return acc + (a.accumulated_dividends ?? 0) * rate;
  }, 0);

  // Total geral vitalício (proventos periódicos de toda a história + histórico anterior)
  const allPeriodicDividendsTotal = dividends.reduce((acc, d) => acc + getDividendAmountBRL(d), 0);
  const lifetimeTotal = allPeriodicDividendsTotal + historicalTotal;

  // Consolidação de proventos por ativo (histórico + periódicos)
  const assetsWithDividends = assets
    .map((a) => {
      const row = rowByAssetId.get(a.id);
      const isUSD = a.currency === "USD" || row?.currency === "USD";
      const rate = isUSD ? (row?.usdRate || 5.25) : 1;
      const initialHistorical = a.accumulated_dividends ?? 0;
      const assetDivs = dividends.filter((d) => d.asset_id === a.id);
      const periodicAmount = assetDivs.reduce((acc, d) => acc + d.amount, 0);
      const totalAmount = initialHistorical + periodicAmount;
      const totalAmountBRL = totalAmount * rate;
      const totalCost = row ? row.totalCost : a.quantity * a.average_price;
      const yoc = calculateYieldOnCostTotal(initialHistorical, periodicAmount, totalCost);

      return {
        asset: a,
        isUSD,
        rate,
        initialHistorical,
        periodicAmount,
        totalAmount,
        totalAmountBRL,
        yoc,
      };
    })
    .filter((item) => item.totalAmount > 0)
    .sort((a, b) => b.totalAmountBRL - a.totalAmountBRL);

  // Calcula o progresso da Bola de Neve para ativos com proventos
  const snowballItems = assets
    .filter((a) => !isCashAssetClass(a.asset_class) && a.quantity > 0)
    .map((a) => {
      const assetDivs = dividends.filter((d) => d.asset_id === a.id);

      // Último provento periódico (null se não houver lançamentos em portfolio_dividends)
      const latestDiv = assetDivs.length > 0
        ? assetDivs.sort((d1, d2) => d2.date.localeCompare(d1.date))[0]
        : null;

      // Resolve a estimativa de dividendo/cota conforme prioridade:
      // A — último lançamento periódico (mais preciso)
      // B — estimated_monthly_dividend_per_share do ativo (fallback manual)
      // none — ocultar da Bola de Neve
      const resolved = resolveMonthlyDividendPerShare(
        latestDiv?.amount ?? null,
        a.quantity,
        a.estimated_monthly_dividend_per_share ?? 0,
      );

      if (resolved.source === "none") return null;

      const row = rowByAssetId.get(a.id);
      const isUSD = a.currency === "USD" || row?.currency === "USD";
      const currentPrice = row && (row.priceQuote ?? row.priceBRL) > 0
        ? (isUSD ? (row.priceQuote || row.priceBRL) : row.priceBRL)
        : a.average_price;

      if (currentPrice <= 0) return null;

      const progress = calculateSnowballProgress({
        quantity: a.quantity,
        currentPrice,
        monthlyDividendPerShare: resolved.perShare,
      });

      return {
        asset: a,
        currentPrice,
        progress,
        /** Indica se a Bola de Neve está usando estimativa manual (sem lançamentos periódicos). */
        dividendSource: resolved.source,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.progress.progressPct - a.progress.progressPct);


  const hasAny = dividends.length > 0 || historicalTotal > 0 || snowballItems.length > 0;
  const loading = dividendsQuery.isLoading || assetsQuery.isLoading;
  const error = dividendsQuery.error ?? assetsQuery.error;

  const handleDelete = async () => {
    if (!dividendToDelete) return;
    try {
      await deleteDividend.mutateAsync(dividendToDelete);
      setDividendToDelete(null);
    } catch {
      // Toast disparado pelo hook
    }
  };

  const nonCashActiveAssets = assets.filter((a) => !isCashAssetClass(a.asset_class) && a.quantity > 0);
  const reinvestmentOpportunities = detectReinvestmentOpportunities(
    nonCashActiveAssets.map((asset) => {
      const row = rowByAssetId.get(asset.id);
      const isUSD = asset.currency === "USD" || row?.currency === "USD";
      const currentPrice = row && (row.priceQuote ?? row.priceBRL) > 0
        ? (isUSD ? (row.priceQuote || row.priceBRL) : row.priceBRL)
        : asset.average_price;
      const assetExtract = extract.filter((d) => d.asset_id === asset.id || d.ticker === asset.ticker);
      const monthDividends = assetExtract.reduce((acc, d) => acc + (isUSD ? d.amount : getDividendAmountBRL(d)), 0);

      return {
        assetId: asset.id,
        ticker: asset.ticker,
        currentPrice,
        quantity: asset.quantity,
        monthDividends,
      };
    }),
  );

  const handleReinvest = (opp: ReinvestmentOpportunity) => {
    if (onOpenWizard) {
      const asset = assetById.get(opp.assetId) ?? null;
      onOpenWizard(asset, "buy");
    }
  };

  const extratoContent = (
    <div className="flex flex-col gap-6">
      {/* Barra utilitária limpa: Seletor de mês */}
      <div className="flex items-center min-w-0">
        <MonthPicker value={month} onValueChange={setMonth} aria-label="Mês dos proventos" />
      </div>

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => dividendsQuery.refetch()} />
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
        />
      ) : (
        <>
          {/* Gatilho de Reinvestimento da Bola de Neve (§F50) */}
          {reinvestmentOpportunities.length > 0 && (
            <SnowballActionCard
              opportunities={reinvestmentOpportunities}
              onReinvest={handleReinvest}
            />
          )}

          {/* KPIs consolidados: mês, ano, histórico inicial e vitalício */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border">
              <p className="text-xs text-muted-foreground">Recebido em {monthLabel(month)}</p>
              <p className="num mt-1 text-2xl font-bold tracking-tight text-foreground">
                <MoneyText cents={numberToCents(monthTotal)} tone="positive" />
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {extract.length} {extract.length === 1 ? "provento" : "proventos"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border">
              <p className="text-xs text-muted-foreground">Total em {year}</p>
              <p className="num mt-1 text-2xl font-bold tracking-tight text-foreground">
                <MoneyText cents={numberToCents(yearTotal)} tone="positive" />
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Acumulado do ano (convertido em R$)</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border">
              <p className="text-xs text-muted-foreground">Histórico Anterior</p>
              <p className="num mt-1 text-2xl font-bold tracking-tight text-foreground">
                <MoneyText cents={numberToCents(historicalTotal)} tone="positive" />
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Proventos cadastrados nos ativos</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border">
              <p className="text-xs text-muted-foreground">Total Geral Vitalício</p>
              <p className="num mt-1 text-2xl font-bold tracking-tight text-foreground">
                <MoneyText cents={numberToCents(lifetimeTotal)} tone="positive" />
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Histórico inicial + lançamentos</p>
            </div>
          </div>

          {/* Proventos Acumulados por Ativo (Histórico Inicial + Periódicos) */}
          {assetsWithDividends.length > 0 && (
            <section aria-label="Proventos por Ativo" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Proventos por Ativo</h2>
                  <p className="text-xs text-muted-foreground">Consolidação de proventos iniciais anteriores ao cadastro e lançamentos no app.</p>
                </div>
                <Badge variant="muted" className="text-[11px]">
                  {assetsWithDividends.length} {assetsWithDividends.length === 1 ? "ativo" : "ativos"}
                </Badge>
              </div>

              {/* Visualização Mobile: Cards Adaptativos de Proventos por Ativo */}
              <div className="flex flex-col gap-2.5 sm:hidden">
                {assetsWithDividends.map(({ asset, isUSD, initialHistorical, periodicAmount, totalAmount, totalAmountBRL, yoc }) => (
                  <div
                    key={asset.id}
                    className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs"
                  >
                    {/* Cabeçalho do Card: Ticker + Classe + YoC */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-foreground text-sm font-mono">{asset.ticker}</span>
                        {asset.asset_class && (
                          <Badge variant="muted" className="text-[10px] px-1.5 py-0 font-medium">
                            {asset.asset_class}
                          </Badge>
                        )}
                      </div>
                      {yoc > 0 ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] text-muted-foreground font-medium">YoC:</span>
                          <span className="font-mono text-xs font-semibold text-foreground">{yoc}%</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Linha de Valores: Detalhamento à esquerda vs Total à direita */}
                    <div className="flex items-end justify-between gap-2 border-t border-border/60 pt-2 text-xs">
                      <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>Inicial:</span>
                          <span className="font-mono text-foreground">
                            {initialHistorical > 0 ? (
                              <MoneyText cents={numberToCents(initialHistorical)} currency={asset.currency} />
                            ) : (
                              "—"
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>No App:</span>
                          <span className="font-mono text-foreground">
                            {periodicAmount > 0 ? (
                              <MoneyText cents={numberToCents(periodicAmount)} currency={asset.currency} />
                            ) : (
                              "—"
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                          Total Recebido
                        </span>
                        <span className="font-semibold text-positive-strong text-sm">
                          <MoneyText cents={numberToCents(totalAmount)} currency={asset.currency} tone="positive" />
                        </span>
                        {isUSD && totalAmountBRL > 0 && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            (≈ <MoneyText cents={numberToCents(totalAmountBRL)} currency="BRL" />)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Visualização Desktop: Tabela Tabular Completa */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full text-left text-xs min-w-[620px]">
                  <thead className="bg-surface-hover/50 text-muted-foreground border-b border-border/70">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Ativo</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Histórico Inicial</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Lançado no App</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total Recebido</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Yield on Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {assetsWithDividends.map(({ asset, isUSD, initialHistorical, periodicAmount, totalAmount, totalAmountBRL, yoc }) => (
                      <tr key={asset.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-foreground">{asset.ticker}</span>
                            {asset.asset_class && (
                              <span className="text-[10px] text-muted-foreground">({asset.asset_class})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {initialHistorical > 0 ? (
                            <MoneyText cents={numberToCents(initialHistorical)} currency={asset.currency} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {periodicAmount > 0 ? (
                            <MoneyText cents={numberToCents(periodicAmount)} currency={asset.currency} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-positive-strong">
                          <MoneyText cents={numberToCents(totalAmount)} currency={asset.currency} tone="positive" />
                          {isUSD && totalAmountBRL > 0 && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              (≈ <MoneyText cents={numberToCents(totalAmountBRL)} currency="BRL" />)
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                          {yoc > 0 ? `${yoc}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Extrato do Mês */}
          <section aria-label={`Extrato de ${monthLabel(month)}`} className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Extrato do mês</h2>
              <Badge variant="muted" className="text-[11px]">
                {monthLabel(month)}
              </Badge>
            </div>

            {extract.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum provento recebido neste mês.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/70 rounded-xl border border-border/80 overflow-hidden">
                {extract.map((entry) => {
                  const asset = entry.asset_id ? assetById.get(entry.asset_id) : null;
                  const row = entry.asset_id ? rowByAssetId.get(entry.asset_id) : null;
                  const currency = asset?.currency ?? row?.currency ?? "BRL";
                  const ticker = asset?.ticker ?? entry.ticker ?? "Ativo";
                  const rate = currency === "USD" ? (row?.usdRate || 5.25) : 1;
                  const amountBRL = entry.amount * rate;

                  return (
                    <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-surface-hover/40 transition-colors">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">{ticker}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateBR(entry.date)} {entry.notes ? `· ${entry.notes}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="num shrink-0 text-sm font-semibold text-foreground">
                            <MoneyText cents={numberToCents(entry.amount)} currency={currency} tone="positive" />
                          </span>
                          {currency === "USD" && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              (≈ <MoneyText cents={numberToCents(amountBRL)} currency="BRL" />)
                            </span>
                          )}
                        </div>
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

          {/* Efeito Bola de Neve */}
          {snowballItems.length > 0 && (
            <section aria-label="Efeito Bola de Neve" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-portfolio shrink-0" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Efeito Bola de Neve (Renda Passiva)</h2>
                    <p className="text-xs text-muted-foreground">Progresso para que os proventos mensais comprem 1 nova cota inteira sozinhos.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {snowballItems.map(({ asset, currentPrice, progress, dividendSource }) => (
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
                      <div className="flex items-center gap-1 shrink-0">
                        {dividendSource === "manual_estimate" && (
                          <Badge variant="muted" className="text-[10px] px-1.5 py-0">
                            Estimado
                          </Badge>
                        )}
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
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                      <span className="text-muted-foreground">Renda mensal estimada</span>
                      <span className="font-semibold text-positive-strong">
                        <MoneyText cents={numberToCents(progress.currentMonthlyIncome)} currency={asset.currency} tone="positive" />
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Custo de 1 cota</span>
                      <span className="font-semibold text-foreground">
                        <MoneyText cents={numberToCents(currentPrice)} currency={asset.currency} tone="default" />
                      </span>
                    </div>

                    {/* Barra de progresso */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50" aria-hidden="true">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
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
        </>
      )}
    </div>
  );

  const calendarioContent = (
    <div className="flex flex-col gap-6">
      {/* Resumo Anual */}
      <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
        <div>
          <span className="text-xs text-muted-foreground">Total de Proventos em {year}</span>
          <p className="num mt-1 text-2xl font-bold tracking-tight text-foreground">
            <MoneyText cents={numberToCents(yearTotal)} tone="positive" animated />
          </p>
        </div>
        <Badge variant="muted" className="text-xs">
          Ano {year}
        </Badge>
      </div>

      {/* Grid de Meses */}
      <section aria-label={`Calendário de proventos de ${year}`} className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-portfolio shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Calendário de {year}</h2>
        </div>
        {(() => {
          const maxMonthTotal = Math.max(...yearly.map((e) => e.total), 1);
          return (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {yearly.map((entry) => {
                const active = entry.month === month;
                const hasValue = entry.total > 0;
                return (
                  <li key={entry.month}>
                    <button
                      type="button"
                      onClick={() => {
                        setMonth(entry.month);
                        setSelectedSubTab("extrato");
                      }}
                      aria-pressed={active}
                      className={`flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        active
                          ? "border-portfolio/40 bg-portfolio/10"
                          : "border-border/80 bg-transparent hover:border-border hover:bg-surface-hover/30"
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
          );
        })()}
      </section>
    </div>
  );

  return (
    <>
      <Tabs
        value={subTab}
        onValueChange={(value) => setSelectedSubTab(value as ProventosSubTab)}
        variant="pills"
        items={[
          {
            value: "extrato",
            label: "Extrato",
            content: extratoContent,
          },
          {
            value: "calendario",
            label: "Calendário",
            content: calendarioContent,
          },
        ]}
      />

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
    </>
  );
}

