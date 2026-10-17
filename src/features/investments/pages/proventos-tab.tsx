import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Calendar,
  CalendarDays,
  Coins,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, SkeletonTable } from "@/components/ui";
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
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import {
  useDeletePortfolioDividend,
  usePortfolioAssets,
  usePortfolioDividends,
  usePortfolioPosition,
} from "@/state";
import type { PortfolioAsset, PortfolioDividend } from "@/types";
import { DividendFormDialog } from "../components";
import type { WizardMode } from "../wizard/wizard-state";

export type ProventosSubTab = "mensal" | "calendario" | "ativos" | "snowball";

export interface ProventosTabProps {
  defaultMonth?: string;
  onOpenWizard?: (asset?: PortfolioAsset | null, mode?: WizardMode) => void;
}

interface SubTabItem {
  value: ProventosSubTab;
  label: string;
  icon: React.ReactNode;
}

const SUBTAB_ITEMS: SubTabItem[] = [
  { value: "mensal", label: "Extrato Mensal", icon: <Calendar className="size-3.5" aria-hidden="true" /> },
  { value: "calendario", label: "Calendário", icon: <CalendarDays className="size-3.5" aria-hidden="true" /> },
  { value: "ativos", label: "Por Ativo", icon: <Layers className="size-3.5" aria-hidden="true" /> },
  { value: "snowball", label: "Bola de Neve", icon: <Sparkles className="size-3.5" aria-hidden="true" /> },
];

/**
 * Proventos da carteira (§F36 e §F39) — extrato mensal dos rendimentos RECEBIDOS
 * a partir de `portfolio_dividends`, indicador do Efeito Bola de Neve, consolidação por ativo e calendário anual.
 *
 * Sub-abas temáticas:
 * - Mensal: seletor de mês, KPIs exclusivos do mês, oportunidade de reinvestimento e extrato detalhado.
 * - Calendário: KPIs anuais, melhor mês e grade interativa dos 12 meses com barras proporcionais.
 * - Por Ativo: histórico vitalício consolidado, ranking dos maiores pagadores e Yield on Cost (YoC).
 * - Bola de Neve: renda passiva estimada total, ativos autossuficientes e progresso de cotas.
 */
export function ProventosTab({ defaultMonth, onOpenWizard }: ProventosTabProps) {
  let searchParams: URLSearchParams | null = null;
  let setSearchParams: ReturnType<typeof useSearchParams>[1] | null = null;

  try {
    const routerParams = useSearchParams();
    searchParams = routerParams[0];
    setSearchParams = routerParams[1];
  } catch {
    // Permite renderização resiliente fora de Router (testes unitários isolados)
  }

  const dividendsQuery = usePortfolioDividends();
  const assetsQuery = usePortfolioAssets();
  const position = usePortfolioPosition();
  const deleteDividend = useDeletePortfolioDividend();

  const rawSubTab = (searchParams?.get("subtab") || searchParams?.get("subTab") || searchParams?.get("aba"))?.toLowerCase();
  const normalizedSubTab = rawSubTab === "extrato" ? "mensal" : rawSubTab;
  const validSubTab =
    normalizedSubTab === "mensal" ||
    normalizedSubTab === "calendario" ||
    normalizedSubTab === "ativos" ||
    normalizedSubTab === "snowball"
      ? (normalizedSubTab as ProventosSubTab)
      : null;

  const [selectedSubTab, setSelectedSubTab] = useState<ProventosSubTab>(() => validSubTab ?? "mensal");
  const subTab: ProventosSubTab = validSubTab ?? selectedSubTab;
  const [month, setMonth] = useState(() => defaultMonth ?? currentMonth());
  const [dividendToDelete, setDividendToDelete] = useState<PortfolioDividend | null>(null);
  const [dividendFormOpen, setDividendFormOpen] = useState(false);

  const handleSubTabChange = (nextTab: ProventosSubTab) => {
    triggerSensory("selection");
    setSelectedSubTab(nextTab);
    if (searchParams && setSearchParams) {
      const next = new URLSearchParams(searchParams);
      if (nextTab === "mensal") {
        next.delete("subtab");
        next.delete("subTab");
        next.delete("aba");
      } else {
        next.set("subtab", nextTab);
        next.delete("subTab");
        next.delete("aba");
      }
      setSearchParams(next, { replace: true });
    }
  };

  const rawDividends = dividendsQuery.data;
  const rawAssets = assetsQuery.data;
  const dividends = useMemo(() => rawDividends ?? [], [rawDividends]);
  const assets = useMemo(() => rawAssets ?? [], [rawAssets]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const rowByAssetId = useMemo(() => new Map(position.rows.map((row) => [row.assetId, row])), [position.rows]);
  const year = month.slice(0, 4);

  const getDividendAmountBRL = useCallback((d: PortfolioDividend) => {
    const asset = d.asset_id ? assetById.get(d.asset_id) : null;
    const row = d.asset_id ? rowByAssetId.get(d.asset_id) : null;
    const isUSD = asset?.currency === "USD" || row?.currency === "USD";
    const rate = isUSD ? (row?.usdRate || 5.25) : 1;
    return d.amount * rate;
  }, [assetById, rowByAssetId]);

  // 1. Visão Mensal
  const extract = useMemo(
    () => dividends.filter((d) => d.date.startsWith(month)),
    [dividends, month],
  );

  const monthTotal = useMemo(
    () => extract.reduce((acc, d) => acc + getDividendAmountBRL(d), 0),
    [extract, getDividendAmountBRL],
  );

  const uniqueMonthTickers = useMemo(() => {
    const set = new Set<string>();
    for (const d of extract) {
      const asset = d.asset_id ? assetById.get(d.asset_id) : null;
      set.add(asset?.ticker ?? d.ticker ?? "Ativo");
    }
    return set;
  }, [extract, assetById]);

  const topPayerOfMonth = useMemo(() => {
    if (extract.length === 0) return null;
    const payerMap = new Map<string, number>();
    for (const d of extract) {
      const asset = d.asset_id ? assetById.get(d.asset_id) : null;
      const ticker = asset?.ticker ?? d.ticker ?? "Ativo";
      payerMap.set(ticker, (payerMap.get(ticker) ?? 0) + getDividendAmountBRL(d));
    }
    let topTicker = "";
    let topAmount = 0;
    for (const [ticker, amount] of payerMap.entries()) {
      if (amount > topAmount) {
        topAmount = amount;
        topTicker = ticker;
      }
    }
    return topAmount > 0 ? { ticker: topTicker, amount: topAmount } : null;
  }, [extract, assetById, getDividendAmountBRL]);

  // 2. Visão Anual
  const allMonthsOfYear = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const mm = String(i + 1).padStart(2, "0");
        return `${year}-${mm}`;
      }),
    [year],
  );

  const yearly = useMemo(
    () =>
      allMonthsOfYear.map((m) => {
        const total = dividends
          .filter((d) => d.date.startsWith(m))
          .reduce((acc, d) => acc + getDividendAmountBRL(d), 0);
        return { month: m, total };
      }),
    [allMonthsOfYear, dividends, getDividendAmountBRL],
  );

  const yearTotal = useMemo(
    () => yearly.reduce((acc, e) => acc + e.total, 0),
    [yearly],
  );

  const yearMonthlyAverage = useMemo(
    () => Math.round((yearTotal / 12) * 100) / 100,
    [yearTotal],
  );

  const bestMonthOfYear = useMemo(() => {
    const monthsWithValues = yearly.filter((m) => m.total > 0);
    const first = monthsWithValues[0];
    if (!first) return null;
    return monthsWithValues.reduce((best, cur) => (cur.total > best.total ? cur : best), first);
  }, [yearly]);

  // 3. Visão Por Ativo & YoC
  const historicalTotal = useMemo(
    () =>
      assets.reduce((acc, a) => {
        const row = rowByAssetId.get(a.id);
        const isUSD = a.currency === "USD" || row?.currency === "USD";
        const rate = isUSD ? (row?.usdRate || 5.25) : 1;
        return acc + (a.accumulated_dividends ?? 0) * rate;
      }, 0),
    [assets, rowByAssetId],
  );

  const allPeriodicDividendsTotal = useMemo(
    () => dividends.reduce((acc, d) => acc + getDividendAmountBRL(d), 0),
    [dividends, getDividendAmountBRL],
  );

  const lifetimeTotal = historicalTotal + allPeriodicDividendsTotal;

  const assetsWithDividends = useMemo(
    () =>
      assets
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
        .sort((a, b) => b.totalAmountBRL - a.totalAmountBRL),
    [assets, dividends, rowByAssetId],
  );

  const portfolioAverageYoC = useMemo(() => {
    const validYocs = assetsWithDividends.filter((a) => a.yoc > 0);
    if (validYocs.length === 0) return 0;
    const sum = validYocs.reduce((acc, a) => acc + a.yoc, 0);
    return Math.round((sum / validYocs.length) * 10) / 10;
  }, [assetsWithDividends]);

  // 4. Visão Bola de Neve
  const snowballItems = useMemo(
    () =>
      assets
        .filter((a) => !isCashAssetClass(a.asset_class) && a.quantity > 0)
        .map((a) => {
          const assetDivs = dividends.filter((d) => d.asset_id === a.id);
          const latestDiv = assetDivs.length > 0
            ? assetDivs.sort((d1, d2) => d2.date.localeCompare(d1.date))[0]
            : null;

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
            dividendSource: resolved.source,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.progress.progressPct - a.progress.progressPct),
    [assets, dividends, rowByAssetId],
  );

  const activeSnowballCount = useMemo(
    () => snowballItems.filter((i) => i.progress.isSnowballActive).length,
    [snowballItems],
  );

  const totalMonthlyEstimatedIncome = useMemo(
    () => snowballItems.reduce((acc, i) => acc + i.progress.currentMonthlyIncome, 0),
    [snowballItems],
  );

  const nonCashActiveAssets = useMemo(
    () => assets.filter((a) => !isCashAssetClass(a.asset_class) && a.quantity > 0),
    [assets],
  );

  const reinvestmentOpportunities = useMemo(
    () =>
      detectReinvestmentOpportunities(
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
      ),
    [nonCashActiveAssets, extract, rowByAssetId, getDividendAmountBRL],
  );

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

  const handleReinvest = (opp: ReinvestmentOpportunity) => {
    if (onOpenWizard) {
      const asset = assetById.get(opp.assetId) ?? null;
      onOpenWizard(asset, "buy");
    }
  };

  // Conteúdo da Aba 1: Extrato Mensal
  const mensalContent = (
    <div className="flex flex-col gap-5">
      {/* Seletor de Mês/Ano posicionado abaixo dos subseletores e acima da lista de dados */}
      <div className="flex items-center min-w-0">
        <MonthPicker value={month} onValueChange={setMonth} aria-label="Mês dos proventos" />
      </div>

      {!hasAny ? (
        <EmptyState
          icon={<TrendingUp className="size-6" aria-hidden="true" />}
          title="Sem proventos ainda"
          description="Registre os rendimentos e dividendos recebidos das suas cotas para acompanhar o extrato e calendário anual."
          tone="default"
          headingLevel="h2"
          action={
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setDividendFormOpen(true)}
              className="gap-1.5 h-8 text-xs font-semibold"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Registrar primeiro provento</span>
            </Button>
          }
        />
      ) : (
        <>
          {/* 3 KPIs Focados Estritamente no Mês */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Recebido em {monthLabel(month)}</span>
            <Badge variant={extract.length > 0 ? "positive" : "muted"} size="xs">
              {extract.length} {extract.length === 1 ? "provento" : "proventos"}
            </Badge>
          </div>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground">
            <MoneyText cents={numberToCents(monthTotal)} tone="positive" />
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Créditos de rendimentos no mês</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border">
          <span className="text-xs font-medium text-muted-foreground">Ativos Pagadores</span>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground">
            {uniqueMonthTickers.size}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {uniqueMonthTickers.size === 1 ? "Ativo pagou neste mês" : "Ativos pagaram neste mês"}
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border">
          <span className="text-xs font-medium text-muted-foreground">Maior Pagador</span>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground truncate">
            {topPayerOfMonth ? topPayerOfMonth.ticker : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {topPayerOfMonth ? (
              <>
                <MoneyText cents={numberToCents(topPayerOfMonth.amount)} tone="positive" /> recebidos
              </>
            ) : (
              "Sem proventos neste mês"
            )}
          </p>
        </div>
      </div>

      {/* Gatilho de Reinvestimento da Bola de Neve no Mês */}
      {reinvestmentOpportunities.length > 0 && (
        <SnowballActionCard
          opportunities={reinvestmentOpportunities}
          onReinvest={handleReinvest}
        />
      )}

      {/* Extrato Detalhado do Mês */}
      <section
        aria-label={`Extrato de ${monthLabel(month)}`}
        className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Extrato do mês</h2>
          </div>
          <Badge variant="muted" size="sm">
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
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 hover:bg-surface-hover/40 transition-colors"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold font-mono text-foreground">{ticker}</span>
                      {asset?.asset_class && (
                        <Badge variant="muted" size="xs" className="font-medium">
                          {asset.asset_class}
                        </Badge>
                      )}
                    </div>
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
        </>
      )}
    </div>
  );

  // Conteúdo da Aba 2: Calendário Anual
  const calendarioContent = (
    <div className="flex flex-col gap-5">
      {/* 3 KPIs Anuais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Total em {year}</span>
            <Badge variant="muted" size="xs">Ano {year}</Badge>
          </div>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground">
            <MoneyText cents={numberToCents(yearTotal)} tone="positive" animated />
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Acumulado do ano convertido em R$</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Média Mensal</span>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground">
            <MoneyText cents={numberToCents(yearMonthlyAverage)} tone="positive" />
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Média estimada dos 12 meses</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Melhor Mês</span>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground truncate">
            {bestMonthOfYear ? monthLabel(bestMonthOfYear.month) : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {bestMonthOfYear ? (
              <>
                Pico de <MoneyText cents={numberToCents(bestMonthOfYear.total)} tone="positive" />
              </>
            ) : (
              "Sem lançamentos no ano"
            )}
          </p>
        </div>
      </div>

      {/* Grid Interativo dos 12 Meses */}
      <section
        aria-label={`Calendário de proventos de ${year}`}
        className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden"
      >
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Calendário de {year}</h2>
            <p className="text-xs text-muted-foreground">Clique em qualquer mês para abrir o extrato detalhado correspondente.</p>
          </div>
        </div>

        {(() => {
          const maxMonthTotal = Math.max(...yearly.map((e) => e.total), 1);
          return (
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {yearly.map((entry) => {
                const active = entry.month === month;
                const hasValue = entry.total > 0;
                return (
                  <li key={entry.month}>
                    <button
                      type="button"
                      onClick={() => {
                        setMonth(entry.month);
                        handleSubTabChange("mensal");
                      }}
                      aria-pressed={active}
                      className={`flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                        active
                          ? "border-portfolio/60 bg-portfolio/10 shadow-xs"
                          : "border-border/80 bg-surface hover:border-border hover:bg-surface-hover/30"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-xs font-semibold capitalize text-foreground">{monthLabel(entry.month)}</span>
                        {hasValue ? (
                          <span className="num text-xs font-bold text-positive-strong">
                            <MoneyText cents={numberToCents(entry.total)} tone="positive" />
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </div>
                      {hasValue ? (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40" aria-hidden="true">
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

  // Conteúdo da Aba 3: Por Ativo & YoC
  const ativosContent = (
    <div className="flex flex-col gap-5">
      {/* 3 KPIs Históricos da Vida Inteira */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Total Geral Vitalício</span>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground">
            <MoneyText cents={numberToCents(lifetimeTotal)} tone="positive" />
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Histórico inicial + lançamentos no app</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Histórico Anterior</span>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground">
            <MoneyText cents={numberToCents(historicalTotal)} tone="positive" />
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Proventos cadastrados nos ativos</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">YoC Médio da Carteira</span>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {portfolioAverageYoC > 0 ? `${portfolioAverageYoC}%` : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Yield on Cost sobre preço de compra</p>
        </div>
      </div>

      {/* Proventos Acumulados por Ativo */}
      <section
        aria-label="Proventos por Ativo"
        className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Proventos por Ativo</h2>
            <p className="text-xs text-muted-foreground">Consolidação de proventos iniciais anteriores ao cadastro e lançamentos no app.</p>
          </div>
          <Badge variant="muted" size="sm">
            {assetsWithDividends.length} {assetsWithDividends.length === 1 ? "ativo" : "ativos"}
          </Badge>
        </div>

        {assetsWithDividends.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum ativo com proventos acumulados.</p>
        ) : (
          <>
            {/* Visualização Mobile: Cards Adaptativos de Proventos por Ativo */}
            <div className="flex flex-col gap-2.5 sm:hidden">
              {assetsWithDividends.map(({ asset, isUSD, initialHistorical, periodicAmount, totalAmount, totalAmountBRL, yoc }) => (
                <div
                  key={asset.id}
                  className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-foreground text-sm font-mono">{asset.ticker}</span>
                      {asset.asset_class && (
                        <Badge variant="muted" size="xs" className="font-medium">
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
                          <span className="font-bold text-foreground font-mono">{asset.ticker}</span>
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
          </>
        )}
      </section>
    </div>
  );

  // Conteúdo da Aba 4: Bola de Neve
  const snowballContent = (
    <div className="flex flex-col gap-5">
      {/* 2 KPIs de Renda Passiva */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Renda Mensal Estimada Total</span>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground">
            <MoneyText cents={numberToCents(totalMonthlyEstimatedIncome)} tone="positive" />
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Renda passiva média gerada mensalmente</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Ativos Autossuficientes</span>
          <p className="num mt-2 text-2xl font-bold tracking-tight text-foreground">
            {activeSnowballCount} de {snowballItems.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Já compram 1 ou mais cotas sozinhos por mês</p>
        </div>
      </div>

      {/* Cards da Bola de Neve */}
      <section
        aria-label="Efeito Bola de Neve"
        className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-portfolio shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Efeito Bola de Neve (Renda Passiva)</h2>
              <p className="text-xs text-muted-foreground">Progresso para que os proventos mensais comprem 1 nova cota inteira sozinhos.</p>
            </div>
          </div>
        </div>

        {snowballItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum ativo com proventos ou estimativa mensal cadastrada.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {snowballItems.map(({ asset, currentPrice, progress, dividendSource }) => (
              <div
                key={asset.id}
                className={`flex flex-col gap-2.5 rounded-xl border p-3.5 transition-colors ${
                  progress.isSnowballActive
                    ? "border-positive-strong/40 bg-positive-surface/20"
                    : "border-border/80 bg-surface"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <strong className="text-sm font-bold text-foreground font-mono truncate">{asset.ticker}</strong>
                    <span className="text-[11px] text-muted-foreground">({asset.quantity} cotas)</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {dividendSource === "manual_estimate" && (
                      <Badge variant="muted" size="xs">
                        Estimado
                      </Badge>
                    )}
                    {progress.isSnowballActive ? (
                      <Badge variant="positive" size="xs">
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
        )}
      </section>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => dividendsQuery.refetch()} />
      ) : null}

      {/* Barra de Subseletores com Pills no padrão Insights (§F36 e §F39) */}
      <div
        role="tablist"
        aria-label="Sub-abas de proventos"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 -mx-1 px-1"
      >
        {SUBTAB_ITEMS.map((item) => {
          const isSelected = subTab === item.value;
          return (
            <Button
              key={item.value}
              role="tab"
              aria-selected={isSelected}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => handleSubTabChange(item.value)}
              className={cn(
                "shrink-0 gap-1.5 text-xs h-8 px-3 rounded-xl transition-all",
                isSelected
                  ? "shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Button>
          );
        })}
      </div>

      {loading ? (
        <div aria-hidden="true">
          <SkeletonTable rows={4} />
        </div>
      ) : (
        <div className="flex flex-col gap-5 min-w-0">
          {subTab === "mensal" && mensalContent}
          {subTab === "calendario" && calendarioContent}
          {subTab === "ativos" && ativosContent}
          {subTab === "snowball" && snowballContent}
        </div>
      )}

      {/* Diálogo de Novo Provento */}
      <DividendFormDialog
        open={dividendFormOpen}
        onOpenChange={setDividendFormOpen}
      />

      {/* Diálogo de Confirmação de Exclusão */}
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


