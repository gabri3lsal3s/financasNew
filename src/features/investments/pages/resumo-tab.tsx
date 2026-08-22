import { useEffect, useRef, useState } from "react";
import { Coins, LineChart, PieChart, Plus, RefreshCw, Shield, Sparkles, TrendingUp } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, SkeletonChart, SkeletonKpi } from "@/components/ui";
import { CategoryDonut, CashKpiCard, DeltaHint, KpiCard, PositionTable } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { calculatePortfolioConcentration, isCashAssetClass } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import {
  useDeletePortfolioAsset,
  usePortfolioAssets,
  usePortfolioDividends,
  usePortfolioPosition,
  useSyncQuotes,
} from "@/state";
import {
  AssetFormDialog,
  AssetSplitDialog,
  ContributionsListDialog,
  ManualPriceDialog,
  PortfolioImportDialog,
} from "../components";
import type { AssetCurrency, PortfolioAsset } from "@/types";
import type { PriceSource } from "@/domain/portfolio";

/**
 * Resumo da carteira (§F36 unificada) — Posição Consolidada + Operação Ágil:
 * KPIs (patrimônio com Δ, rentabilidade ponderada, proventos do mês),
 * gráfico unificado de distribuição da carteira em tela cheia com alternador por ativo/classe,
 * tabela de posições com paginação e menu contextual, e evolução histórica.
 */
export function ResumoTab() {
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const dividendsQuery = usePortfolioDividends();
  const deleteAsset = useDeletePortfolioAsset();
  const syncQuotes = useSyncQuotes();
  const autoSyncedRef = useRef(false);

  const [assetOpen, setAssetOpen] = useState(false);
  const [cashCreateOpen, setCashCreateOpen] = useState(false);
  const [assetEditing, setAssetEditing] = useState<PortfolioAsset | null>(null);
  const [assetToSplit, setAssetToSplit] = useState<PortfolioAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<PortfolioAsset | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [contributionsOpen, setContributionsOpen] = useState(false);
  const [allocationMode, setAllocationMode] = useState<"asset" | "class">("class");
  const [priceFor, setPriceFor] = useState<{
    id: string;
    ticker: string;
    currency: AssetCurrency;
    priceBRL: number;
    source: PriceSource;
  } | null>(null);

  const rows = position.rows;
  const investmentRows = rows.filter((r) => !r.isCash);
  const cashAsset = (assetsQuery.data ?? []).find(
    (a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA",
  );
  const hasInvestments = rows.length > 0;

  // Auto-sincronização inicial para ativos que ainda não possuem cotação em cache
  useEffect(() => {
    if (autoSyncedRef.current || assetsQuery.isLoading || !assetsQuery.data) return;
    const assetsWithoutQuote = (assetsQuery.data ?? []).filter((a) => {
      if (isCashAssetClass(a.asset_class)) return false;
      const row = rows.find((r) => r.assetId === a.id);
      return !row || (row.source === "fallback" && row.priceBRL <= 0);
    });

    if (assetsWithoutQuote.length > 0) {
      autoSyncedRef.current = true;
      syncQuotes.mutate(assetsWithoutQuote);
    }
  }, [assetsQuery.data, assetsQuery.isLoading, rows, syncQuotes]);

  const assetById = (assetId: string): PortfolioAsset | undefined => (assetsQuery.data ?? []).find((a) => a.id === assetId);

  const openEdit = (assetId: string) => {
    const asset = assetById(assetId);
    if (asset) setAssetEditing(asset);
  };

  const openDelete = (assetId: string) => {
    const asset = assetById(assetId);
    if (asset) setAssetToDelete(asset);
  };

  const month = currentMonth();

  // Proventos do mês a partir de portfolio_dividends
  const dividendsThisMonth = (dividendsQuery.data ?? [])
    .filter((d) => d.date.startsWith(month))
    .reduce((acc, d) => acc + d.amount, 0);
  const dividendsCents = numberToCents(dividendsThisMonth);

  // Agrupamento por classe de ativos (F16)
  const classMap = new Map<string, number>();
  for (const row of rows) {
    const label = row.assetClass?.trim() || (row.isCash ? "Caixa" : "Sem classe");
    const cents = Math.round(row.valueBRL * 100);
    classMap.set(label, (classMap.get(label) ?? 0) + cents);
  }
  const classSlices = Array.from(classMap.entries())
    .map(([label, valueCents]) => ({
      key: label,
      label,
      valueCents,
      subtitle: `${rows.filter((r) => (r.assetClass?.trim() || (r.isCash ? "Caixa" : "Sem classe")) === label).length} ativo(s)`,
    }))
    .filter((s) => s.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents);

  // Fatias individuais de cada ativo com clique interativo para ver/editar
  const assetSlices = rows
    .filter((row) => row.valueBRL > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL)
    .map((row) => ({
      key: row.assetId,
      label: row.ticker,
      subtitle: row.assetClass ?? (row.isCash ? "Caixa" : "Sem classe"),
      valueCents: Math.round(row.valueBRL * 100),
      onClick: () => openEdit(row.assetId),
    }));

  const activeSlices = allocationMode === "asset" ? assetSlices : classSlices;

  const series = position.monthlySeries;
  const previousPoint = series.length > 1 ? series[series.length - 2] : undefined;
  const previousCents = previousPoint ? numberToCents(previousPoint.valueBRL) : 0;

  const cashPct = position.totalBRL > 0 ? (position.cashBRL / position.totalBRL) * 100 : 0;
  const concentration = calculatePortfolioConcentration(rows, 25);

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {position.error ? <Alert variant="error">{getErrorMessage(position.error)}</Alert> : null}

      {position.isLoading ? (
        <div className="flex flex-col gap-4" aria-hidden="true">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2">
              <SkeletonKpi />
            </div>
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
          <SkeletonChart />
        </div>
      ) : !hasInvestments ? (
        <EmptyState
          icon={<TrendingUp className="size-6" aria-hidden="true" />}
          title="Sem investimentos cadastrados"
          description="Cadastre seus ativos com quantidade e preço médio para acompanhar seu patrimônio consolidado e projeção de independência financeira."
          tone="portfolio"
          headingLevel="h2"
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" onClick={() => setAssetOpen(true)}>
                <Plus aria-hidden="true" className="size-4" />
                Adicionar primeiro ativo
              </Button>
              <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
                <Sparkles aria-hidden="true" className="size-4 text-portfolio" />
                Importar custódia / texto
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* KPIs: Caixa ocupa 2 colunas em primeiro lugar, seguido de Patrimônio e Proventos */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CashKpiCard
              className="col-span-2"
              cashBRL={position.cashBRL}
              cashPct={cashPct > 0 ? cashPct : undefined}
              hasCashAsset={Boolean(cashAsset)}
              onEdit={() => {
                if (cashAsset) {
                  openEdit(cashAsset.id);
                } else {
                  setCashCreateOpen(true);
                }
              }}
              onDelete={() => {
                if (cashAsset) {
                  openDelete(cashAsset.id);
                }
              }}
            />
            <KpiCard
              label="Patrimônio total"
              cents={numberToCents(position.totalBRL)}
              tone="portfolio"
              hint={<DeltaHint currentCents={numberToCents(position.totalBRL)} previousCents={previousCents} />}
            />
            <KpiCard label="Proventos no mês" cents={dividendsCents} tone="positive" hint={`Recebidos em ${month}`} />
          </div>

          {/* Gráfico Unificado de Distribuição da Carteira em Largura Total */}
          <section aria-label="Distribuição da Carteira" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                  <PieChart className="size-3.5" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-foreground truncate">Distribuição da Carteira</h2>
                <Badge variant="muted" className="hidden sm:inline-flex text-[11px] shrink-0">
                  {allocationMode === "asset"
                    ? `${assetSlices.length} ${assetSlices.length === 1 ? "ativo" : "ativos"}`
                    : `${classSlices.length} ${classSlices.length === 1 ? "classe" : "classes"}`}
                </Badge>
              </div>

              <div className="flex items-center gap-1 rounded-xl bg-surface-hover/80 p-1 border border-border/60 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setAllocationMode("class")}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                    allocationMode === "class"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Por Classe
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationMode("asset")}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                    allocationMode === "asset"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Por Ativo
                </button>
              </div>
            </div>

            <CategoryDonut
              slices={activeSlices}
              className="w-full min-w-0"
              listClassName="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 w-full max-h-[28rem] overflow-y-auto pr-1"
            />
          </section>

          {/* Termômetro de Concentração & Risco (§F39) */}
          {concentration.isConcentrated && (
            <div className="flex flex-col gap-2 rounded-2xl border border-warning-border/80 bg-warning-surface/30 p-4 text-xs text-foreground">
              <div className="flex items-center gap-2 font-semibold text-warning-strong">
                <Shield className="size-4 shrink-0" aria-hidden="true" />
                <span>Termômetro de Concentração de Carteira</span>
              </div>
              <p className="text-muted-foreground">
                {concentration.concentratedAssets.map((a) => `${a.ticker} (${a.pct}%)`).join(", ")}{" "}
                {concentration.concentratedAssets.length === 1 ? "ultrapassa" : "ultrapassam"} 25% do patrimônio em custódia de mercado. Considere direcionar novos aportes para equilibrar os demais ativos da carteira.
              </p>
            </div>
          )}

          {/* Seção principal: Posições da Carteira */}
          <section aria-label="Posições" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate">
                  Posições<span className="hidden min-[380px]:inline"> em Carteira</span>
                </h2>
                <Badge variant="muted" className="hidden sm:inline-flex text-[11px] shrink-0">
                  {investmentRows.length} {investmentRows.length === 1 ? "ativo" : "ativos"}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setImportOpen(true)}
                  className="size-8 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
                  title="Importar custódia via planilha ou texto livre"
                  aria-label="Importar custódia"
                >
                  <Sparkles aria-hidden="true" className="size-3.5 text-portfolio" />
                  <span className="hidden md:inline">Importar</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => syncQuotes.mutate(assetsQuery.data ?? [])}
                  disabled={syncQuotes.isPending}
                  className="size-8 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
                  title="Atualizar cotações de mercado via API"
                  aria-label="Atualizar cotações"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={`size-3.5 ${syncQuotes.isPending ? "animate-spin" : ""}`}
                  />
                  <span className="hidden md:inline">{syncQuotes.isPending ? "Atualizando…" : "Atualizar"}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setContributionsOpen(true)}
                  className="size-8 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
                  title="Gerenciar lançamentos de aportes financeiros do mês"
                  aria-label="Gerenciar aportes do mês"
                >
                  <Coins aria-hidden="true" className="size-3.5 text-portfolio" />
                  <span className="hidden md:inline">Aportes</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="size-8 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1 shrink-0"
                  onClick={() => setAssetOpen(true)}
                  title="Adicionar novo ativo"
                  aria-label="Adicionar novo ativo"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">Adicionar ativo</span>
                </Button>
              </div>
            </div>
            <PositionTable
              rows={investmentRows}
              sortable
              onEditAsset={openEdit}
              onSplitAsset={(assetId) => {
                const asset = assetById(assetId);
                if (asset) setAssetToSplit(asset);
              }}
              onSetManualPrice={(assetId, ticker, currency, priceBRL, source) => {
                setPriceFor({ id: assetId, ticker, currency, priceBRL, source });
              }}
              onDeleteAsset={openDelete}
            />
          </section>

          {/* Seção de Evolução Patrimonial (Snapshots Mensais) */}
          <section aria-label="Evolução Patrimonial" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                  <LineChart className="size-3.5" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Evolução Histórica (Snapshots Mensais)</h2>
              </div>
              <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
              {series.map((point) => {
                const isCurrent = point.month === month;
                const gain = point.valueBRL - point.costBRL;
                const gainPct = point.costBRL > 0 ? (gain / point.costBRL) * 100 : 0;
                return (
                  <div
                    key={point.month}
                    className={`rounded-xl border p-3 flex flex-col gap-1 transition-colors ${
                      isCurrent
                        ? "border-portfolio/40 bg-portfolio/5"
                        : "border-border/60 bg-surface-hover/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{point.month}</span>
                      {isCurrent ? <Badge variant="portfolio" className="text-[10px] px-1.5 py-0">atual</Badge> : null}
                    </div>
                    <MoneyText cents={numberToCents(point.valueBRL)} tone="default" className="text-sm font-semibold" />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>Custo</span>
                      <MoneyText cents={numberToCents(point.costBRL)} tone="default" className="text-muted-foreground" />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Resultado</span>
                      <span className={`num font-medium ${gain >= 0 ? "text-positive-strong" : "text-negative-strong"}`}>
                        {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <AssetFormDialog open={assetOpen} onOpenChange={setAssetOpen} />
      <AssetFormDialog
        open={cashCreateOpen}
        onOpenChange={setCashCreateOpen}
        initialAssetClass="Caixa"
      />
      {assetEditing ? (
        <AssetFormDialog
          key={assetEditing.id}
          open={assetEditing !== null}
          onOpenChange={(next) => !next && setAssetEditing(null)}
          asset={assetEditing}
        />
      ) : null}
      {assetToSplit ? (
        <AssetSplitDialog
          key={assetToSplit.id}
          open={assetToSplit !== null}
          onOpenChange={(next) => !next && setAssetToSplit(null)}
          asset={assetToSplit}
        />
      ) : null}
      {priceFor ? (
        <ManualPriceDialog
          key={priceFor.id}
          open={priceFor !== null}
          onOpenChange={(next) => !next && setPriceFor(null)}
          asset={priceFor}
        />
      ) : null}
      <PortfolioImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />
      <ContributionsListDialog
        open={contributionsOpen}
        onOpenChange={setContributionsOpen}
      />
      <ConfirmDialog
        open={assetToDelete !== null}
        onOpenChange={(next) => !next && setAssetToDelete(null)}
        title={assetToDelete ? `Excluir ${assetToDelete.ticker}?` : "Excluir ativo?"}
        description="O ativo e suas metas de alocação serão removidos da carteira. A posição é recalculada automaticamente."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteAsset.isPending}
        onConfirm={() => {
          if (!assetToDelete) return;
          const assetId = assetToDelete.id;
          void Promise.resolve(deleteAsset.mutateAsync(assetId)).finally(() => setAssetToDelete(null));
        }}
      />
    </div>
  );
}
