import { useEffect, useRef, useState } from "react";
import { LineChart, PieChart, Plus, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, SkeletonChart, SkeletonKpi, SkeletonTable } from "@/components/ui";
import { CategoryDonut, DeltaHint, KpiCard, PositionTable } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { isCashAssetClass, portfolioReturnPct } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import { formatSignedPct } from "@/services/masks/percent";
import {
  useDeletePortfolioAsset,
  usePortfolioAssets,
  usePortfolioDividends,
  usePortfolioPosition,
  useSyncQuotes,
} from "@/state";
import {
  AssetFormDialog,
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
  const [assetEditing, setAssetEditing] = useState<PortfolioAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<PortfolioAsset | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [allocationMode, setAllocationMode] = useState<"asset" | "class">("class");
  const [priceFor, setPriceFor] = useState<{
    id: string;
    ticker: string;
    currency: AssetCurrency;
    priceBRL: number;
    source: PriceSource;
  } | null>(null);

  const rows = position.rows;
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

  const returnPct = portfolioReturnPct(rows);
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

  return (
    <div className="flex flex-col gap-6">
      {position.error ? (
        <Alert variant="error">
          <div className="flex w-full items-center justify-between gap-3">
            <span>{getErrorMessage(position.error)}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => position.refetch()}>
              Tentar novamente
            </Button>
          </div>
        </Alert>
      ) : null}

      {position.isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
          <SkeletonChart />
          <SkeletonTable rows={4} />
        </div>
      ) : !hasInvestments ? (
        <EmptyState
          icon={<TrendingUp className="size-6" aria-hidden="true" />}
          title="Sem investimentos cadastrados"
          description="Adicione seus ativos com quantidade e preço médio, ou importe sua custódia diretamente por texto ou planilha da B3/corretora."
          tone="portfolio"
          headingLevel="h2"
          action={
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Button type="button" size="sm" onClick={() => setAssetOpen(true)} className="gap-1.5">
                <Plus aria-hidden="true" className="size-4" />
                Adicionar ativo
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
                <Sparkles aria-hidden="true" className="size-4 text-portfolio" />
                Importar custódia / texto
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* KPIs 2×2 no mobile, 4 colunas no desktop */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Patrimônio total"
              cents={numberToCents(position.totalBRL)}
              tone="portfolio"
              hint={<DeltaHint currentCents={numberToCents(position.totalBRL)} previousCents={previousCents} />}
            />
            <KpiCard
              label="Rentabilidade"
              value={formatSignedPct(returnPct)}
              tone={returnPct !== null && returnPct >= 0 ? "positive" : returnPct !== null ? "negative" : "default"}
              hint="Não realizada, ponderada pelo valor"
            />
            <KpiCard label="Proventos no mês" cents={dividendsCents} tone="positive" hint={`Recebidos em ${month}`} />
            <KpiCard label="Ativos em carteira" value={String(rows.length)} hint="Custódia consolidada" />
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

          {/* Seção principal: Posições da Carteira */}
          <section aria-label="Posições" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate">
                  Posições<span className="hidden min-[380px]:inline"> em Carteira</span>
                </h2>
                <Badge variant="muted" className="hidden sm:inline-flex text-[11px] shrink-0">
                  {rows.length} {rows.length === 1 ? "ativo" : "ativos"}
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
              rows={rows}
              sortable
              onEditAsset={openEdit}
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
      {assetEditing ? (
        <AssetFormDialog
          key={assetEditing.id}
          open={assetEditing !== null}
          onOpenChange={(next) => !next && setAssetEditing(null)}
          asset={assetEditing}
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
