import { useState } from "react";
import { Plus, TrendingUp, Wallet } from "lucide-react";
import { Alert, Badge, Button, EmptyState, SkeletonChart, SkeletonKpi, SkeletonTable } from "@/components/ui";
import { AllocationDonut, CategoryDonut, DeltaHint, KpiCard, PositionTable } from "@/components/modules";
import { dividendsInMonth, portfolioReturnPct } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money/parse";
import { currentMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useAllPortfolioTransactions, usePortfolioAssets, usePortfolioPosition } from "@/state";
import { AssetFormDialog } from "@/features/portfolio/components/asset-form-dialog";
import { TransactionFormDialog } from "@/features/portfolio/components/transaction-form-dialog";
import type { PortfolioAsset } from "@/types";

const formatPct = (value: number | null): string => {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

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
  const [assetOpen, setAssetOpen] = useState(false);
  const [txFor, setTxFor] = useState<PortfolioAsset | null>(null);

  const rows = position.rows;
  const hasInvestments = rows.length > 0;

  const openTransaction = (assetId: string) => {
    const asset = (assetsQuery.data ?? []).find((a) => a.id === assetId);
    if (asset) setTxFor(asset);
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Posição derivada do ledger: nunca armazenada, sempre recalculada das transações e cotações.
        </p>
        <Button type="button" size="sm" onClick={() => setAssetOpen(true)}>
          <Plus aria-hidden="true" />
          Adicionar ativo
        </Button>
      </div>

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
          <SkeletonTable rows={4} />
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Patrimônio total"
              valueCents={numberToCents(position.totalBRL)}
              tone="portfolio"
              hint={<DeltaHint currentCents={numberToCents(position.totalBRL)} previousCents={previousCents} />}
            />
            <KpiCard
              label="Rentabilidade"
              value={formatPct(returnPct)}
              tone={returnPct !== null && returnPct >= 0 ? "positive" : returnPct !== null ? "negative" : "default"}
              hint="Não realizada, ponderada pelo valor"
            />
            <KpiCard label="Proventos no mês" cents={dividendsCents} tone="positive" hint={`Recebidos em ${month}`} />
            <KpiCard label="Ativos" value={String(rows.length)} hint="Inclui caixa/reserva (1:1)" />
          </div>

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

          <section aria-label="Posições" className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Posições</h2>
              <Badge variant="muted" className="text-[11px]">
                {rows.length} {rows.length === 1 ? "ativo" : "ativos"}
              </Badge>
            </div>
            <PositionTable rows={rows} sortable onRegisterTransaction={openTransaction} />
          </section>
        </>
      )}

      <AssetFormDialog open={assetOpen} onOpenChange={setAssetOpen} />
      {txFor ? (
        <TransactionFormDialog
          key={txFor.id}
          open={txFor !== null}
          onOpenChange={(next) => !next && setTxFor(null)}
          asset={txFor}
        />
      ) : null}
    </div>
  );
}
