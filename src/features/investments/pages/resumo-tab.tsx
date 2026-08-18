import { useState } from "react";
import { Plus, TrendingUp, Wallet } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, SkeletonChart, SkeletonKpi, SkeletonTable } from "@/components/ui";
import { AllocationDonut, CategoryDonut, DeltaHint, KpiCard, PositionTable } from "@/components/modules";
import { dividendsInMonth, portfolioReturnPct } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { currentMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { formatSignedPct } from "@/services/masks/percent";
import { useAllPortfolioTransactions, useDeletePortfolioAsset, usePortfolioAssets, usePortfolioPosition } from "@/state";
import {
  AssetFormDialog,
  ManualPriceDialog,
  TransactionFormDialog,
  TransactionListDialog,
} from "@/features/portfolio/components";
import type { AssetCurrency, PortfolioAsset } from "@/types";
import type { PriceSource } from "@/domain/portfolio";

/**
 * Resumo da carteira (§F17 unificada) — consolidação executiva + operação:
 * KPIs (patrimônio com Δ, rentabilidade ponderada, proventos do mês),
 * donuts de distribuição (classe e ativo), tabela de posições com ordenação
 * e os acessos de operação (adicionar ativo / movimentar) no mesmo lugar.
 */
export function ResumoTab() {
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const transactionsQuery = useAllPortfolioTransactions();
  const deleteAsset = useDeletePortfolioAsset();
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetEditing, setAssetEditing] = useState<PortfolioAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<PortfolioAsset | null>(null);
  const [txFor, setTxFor] = useState<PortfolioAsset | null>(null);
  const [listFor, setListFor] = useState<PortfolioAsset | null>(null);
  const [priceFor, setPriceFor] = useState<{
    id: string;
    ticker: string;
    currency: AssetCurrency;
    priceBRL: number;
    source: PriceSource;
  } | null>(null);

  const rows = position.rows;
  const hasInvestments = rows.length > 0;

  const assetById = (assetId: string): PortfolioAsset | undefined => (assetsQuery.data ?? []).find((a) => a.id === assetId);

  const openTransaction = (assetId: string) => {
    const asset = assetById(assetId);
    if (asset) setTxFor(asset);
  };

  const openList = (assetId: string) => {
    const asset = assetById(assetId);
    if (asset) setListFor(asset);
  };

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
  const dividendsCents = numberToCents(dividendsInMonth(transactionsQuery.data ?? [], month));

  const classSlices = rows.map((row) => ({
    label: row.assetClass?.trim() || (row.isCash ? "Caixa" : "Sem classe"),
    valueCents: Math.round(row.valueBRL * 100),
  }));
  const tickerSlices = rows
    .map((row) => ({
      label: row.ticker,
      valueCents: Math.round(row.valueBRL * 100),
    }))
    .filter((slice) => slice.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents);

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
          <SkeletonTable rows={4} />
          <div className="grid gap-3 lg:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </div>
      ) : !hasInvestments ? (
        <EmptyState
          icon={<TrendingUp className="size-6" aria-hidden="true" />}
          title="Sem investimentos"
          description="Adicione um ativo e registre as transações para acompanhar o patrimônio, a rentabilidade e a alocação aqui."
          tone="portfolio"
          headingLevel="h2"
          action={
            <Button type="button" size="sm" onClick={() => setAssetOpen(true)}>
              <Plus aria-hidden="true" />
              Adicionar ativo
            </Button>
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
            <KpiCard label="Ativos" value={String(rows.length)} hint="Inclui caixa/reserva (1:1)" />
          </div>

          {/* Seção principal: Posições da Carteira */}
          <section aria-label="Posições" className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Posições</h2>
                <Badge variant="muted" className="text-[11px]">
                  {rows.length} {rows.length === 1 ? "ativo" : "ativos"}
                </Badge>
              </div>
              <Button type="button" size="sm" className="w-full sm:w-auto" onClick={() => setAssetOpen(true)}>
                <Plus aria-hidden="true" className="size-4" />
                Adicionar ativo
              </Button>
            </div>
            <PositionTable
              rows={rows}
              sortable
              onRegisterTransaction={openTransaction}
              onListTransactions={openList}
              onEditAsset={openEdit}
              onSetManualPrice={(assetId, ticker, currency, priceBRL, source) => {
                setPriceFor({ id: assetId, ticker, currency, priceBRL, source });
              }}
              onDeleteAsset={openDelete}
            />
          </section>

          {/* Seção secundária: Análise de Alocação */}
          <div className="grid gap-3 lg:grid-cols-2">
            <section aria-label="Alocação por classe" className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                  <Wallet className="size-3.5" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Alocação por classe</h2>
              </div>
              <AllocationDonut slices={classSlices} className="sm:max-w-md" />
            </section>

            <section aria-label="Alocação por ativo" className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                  <TrendingUp className="size-3.5" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Alocação por ativo</h2>
              </div>
              <CategoryDonut slices={tickerSlices} className="sm:max-w-md" />
            </section>
          </div>
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
      {txFor ? (
        <TransactionFormDialog
          key={txFor.id}
          open={txFor !== null}
          onOpenChange={(next) => !next && setTxFor(null)}
          asset={txFor}
        />
      ) : null}
      {listFor ? (
        <TransactionListDialog
          key={listFor.id}
          open={listFor !== null}
          onOpenChange={(next) => !next && setListFor(null)}
          asset={listFor}
        />
      ) : null}
      <ConfirmDialog
        open={assetToDelete !== null}
        onOpenChange={(next) => !next && setAssetToDelete(null)}
        title={assetToDelete ? `Excluir ${assetToDelete.ticker}?` : "Excluir ativo?"}
        description="O ativo, suas transações e metas de alocação serão removidos em cascata. A posição é recalculada automaticamente."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteAsset.isPending}
        onConfirm={() => {
          if (!assetToDelete) return;
          // Fecha a confirmação em sucesso E em falha (o toast do hook exibe o
          // erro) — antes, falha deixava o diálogo preso com rejection não tratada.
          const assetId = assetToDelete.id;
          void Promise.resolve(deleteAsset.mutateAsync(assetId)).finally(() => setAssetToDelete(null));
        }}
      />
    </div>
  );
}
