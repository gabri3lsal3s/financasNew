import { useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { Alert, Button, EmptyState, SkeletonKpi, SkeletonTable } from "@/components/ui";
import { DeltaHint, KpiCard, PositionTable } from "@/components/modules";
import { numberToCents } from "@/domain/money/parse";
import { usePortfolioAssets, usePortfolioPosition } from "@/state";
import { AssetFormDialog } from "@/features/portfolio/components/asset-form-dialog";
import { TransactionFormDialog } from "@/features/portfolio/components/transaction-form-dialog";
import type { PortfolioAsset } from "@/types";


/** Posição (§3.11.2) — patrimônio, caixa derivado e posições valoradas. */
export function PositionTab() {
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const [assetOpen, setAssetOpen] = useState(false);
  const [txFor, setTxFor] = useState<PortfolioAsset | null>(null);

  const openTransaction = (assetId: string) => {
    const asset = (assetsQuery.data ?? []).find((a) => a.id === assetId);
    if (asset) setTxFor(asset);
  };

  // Comparativo Δ vs. mês anterior (F14) — série mensal derivada no state.
  const series = position.monthlySeries;
  const previousPoint = series.length > 0 ? series[series.length - 2] : undefined;
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
            <span>{position.error instanceof Error ? position.error.message : "Erro ao carregar a carteira."}</span>
            <Button type="button" size="sm" variant="outline" onClick={position.refetch}>
              Tentar novamente
            </Button>
          </div>
        </Alert>
      ) : null}

      {position.isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
          <SkeletonTable rows={5} />
        </div>
      ) : position.rows.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" aria-hidden="true" />}
          title="Carteira vazia"
          description="Adicione um ativo e registre as transações para montar a posição e usar a calculadora de aporte."
          tone="portfolio"
          headingLevel="h2"
          action={
            <Button type="button" onClick={() => setAssetOpen(true)}>
              <Plus aria-hidden="true" />
              Adicionar ativo
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard
              label="Patrimônio total"
              // F15 — transição de dados: NumberTicker (respeita o toggle
              // "Contagem Numérica Animada" e prefers-reduced-motion internamente).
              // Patrimônio é sempre ≥ 0 (o format BRL zera negativos).
              valueCents={numberToCents(position.totalBRL)}
              tone="portfolio"
              hint={<DeltaHint currentCents={numberToCents(position.totalBRL)} previousCents={previousCents} />}
            />
            <KpiCard
              label="Caixa derivado"
              cents={numberToCents(position.cashBRL)}
              tone={position.cashBRL < 0 ? "negative" : position.cashBRL > 0 ? "positive" : "default"}
              hint="Fluxo líquido do ledger (compras debitam; vendas e proventos creditam)"
            />
            <KpiCard label="Ativos" value={String(position.rows.length)} hint="Inclui caixa/reserva (1:1)" />
          </div>

          <PositionTable rows={position.rows} onRegisterTransaction={openTransaction} />
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
