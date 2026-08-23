import { useState } from "react";
import { Calculator } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, MoneyInput, RadioGroup, SkeletonChart, SkeletonKpi, Tabs } from "@/components/ui";
import { AporteResult, type AporteRouteRow } from "@/components/modules";
import {
  simulateCombinedAporte,
  simulateRebalanceAporte,
  simulateSmartAporte,
  type AporteAssetInput,
  type AporteMode,
  type ClassTargetInput,
} from "@/domain/portfolio";
import { todayISO } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import {
  useAllocationTargets,
  useExecutePortfolioBatchAporte,
  useGroupTargets,
  usePortfolioPosition,
} from "@/state";
import { ContributionsPanel } from "../components";
import { TargetsTab } from "./targets-tab";

type AporteSubTab = "calculadora" | "metas" | "historico";

/**
 * Calculadora de aporte (§F36) — simulação hierárquica (Classe -> Ativo) em 3 modos:
 * combinado (padrão), por meta individual ou por meta de classe.
 * Ao aplicar o lote, executa a transação atômica via RPC (`execute_portfolio_batch_aporte`)
 * atualizando posições, registrando compras em `portfolio_transactions` e histórico em `portfolio_contributions`.
 *
 * Sub-tabs:
 * - Calculadora: rebalanceador interativo hierárquico
 * - Metas: gestão visual de alocação por ativo e por classe
 * - Histórico: lista de aportes registrados por mês (§F37)
 */
export function AporteTab({ onGoToPosition }: { onGoToPosition?: () => void }) {
  const position = usePortfolioPosition();
  const targetsQuery = useAllocationTargets();
  const classTargetsQuery = useGroupTargets("class");
  const executeBatch = useExecutePortfolioBatchAporte();

  const [subTab, setSubTab] = useState<AporteSubTab>("calculadora");
  const [aporteCents, setAporteCents] = useState(0);
  const [mode, setMode] = useState<AporteMode>("both");
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const error = position.error ?? targetsQuery.error ?? classTargetsQuery.error;
  const loading = position.isLoading || targetsQuery.isLoading || classTargetsQuery.isLoading;

  const nonCashRows = position.rows.filter((r) => !r.isCash);

  const targetByAsset = new Map((targetsQuery.data ?? []).map((t) => [t.asset_id, t.target_percentage]));
  const classTargets: ClassTargetInput[] = (classTargetsQuery.data ?? []).map((t) => ({
    className: t.name,
    targetPercentage: t.target_percentage,
  }));

  const assets: AporteAssetInput[] = nonCashRows.map((row) => ({
    id: row.assetId,
    ticker: row.ticker,
    assetClass: row.assetClass,
    currency: row.currency,
    currentValueBRL: row.valueBRL,
    priceBRL: row.priceBRL,
    targetPercentage: targetByAsset.get(row.assetId) ?? null,
  }));

  const result =
    aporteCents > 0 && assets.length > 0
      ? mode === "asset"
        ? simulateSmartAporte({ aporte: aporteCents / 100, assets })
        : mode === "class"
          ? simulateRebalanceAporte({ aporte: aporteCents / 100, assets, classTargets })
          : simulateCombinedAporte({ aporte: aporteCents / 100, assets, classTargets })
      : null;

  const routes: AporteRouteRow[] =
    result?.routes.map((r) => ({
      assetId: r.assetId,
      ticker: r.ticker,
      assetClass: r.assetClass,
      targetValueBRL: r.targetValueBRL,
      currentValueBRL: r.currentValueBRL,
      gapBRL: r.gapBRL,
      allocatedBRL: r.allocatedBRL,
      quantity: r.quantity,
      priceBRL: r.priceBRL,
    })) ?? [];

  const eligibleRoutes = routes.filter((r) => r.quantity > 0);

  const handleExecuteBatch = async () => {
    if (eligibleRoutes.length === 0 || isApplying) return;
    setBatchError(null);
    setIsApplying(true);
    try {
      const date = todayISO();
      const items = eligibleRoutes.map((r) => ({
        asset_id: r.assetId,
        quantity: r.quantity,
        price: r.priceBRL,
        total: r.allocatedBRL,
      }));
      const totalAmount = result?.totalAllocated ?? eligibleRoutes.reduce((acc, r) => acc + r.allocatedBRL, 0);

      await executeBatch.mutateAsync({
        items,
        date,
        totalAmount,
        notes: `Aporte inteligente (${eligibleRoutes.length} ativos)`,
      });

      setConfirmBatchOpen(false);
      setAporteCents(0);
      onGoToPosition?.();
    } catch (err) {
      setBatchError(getErrorMessage(err));
    } finally {
      setIsApplying(false);
    }
  };

  const calculadoraContent = (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="error">{getErrorMessage(error)}</Alert> : null}
      {batchError ? <Alert variant="error">{batchError}</Alert> : null}

      {loading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <SkeletonKpi />
          <SkeletonChart />
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Calculator className="size-6" aria-hidden="true" />}
          title="Carteira vazia"
          description="Adicione ativos na aba Resumo antes de simular o aporte."
          tone="portfolio"
          headingLevel="h2"
          action={
            onGoToPosition ? (
              <Button type="button" onClick={onGoToPosition}>
                Ir para Resumo
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <section aria-label="Parâmetros da simulação" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-w-0">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground min-w-0">
                Valor do aporte
                <MoneyInput
                  cents={aporteCents}
                  onCentsChange={setAporteCents}
                  size="md"
                  aria-label="Valor do aporte"
                  placeholder="R$ 0,00"
                />
                {position.cashBRL > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAporteCents(Math.round(position.cashBRL * 100));
                      triggerSensory("selection");
                    }}
                    className="self-start text-[11px] text-portfolio hover:underline font-medium cursor-pointer pt-0.5"
                  >
                    Usar saldo em caixa (R$ {position.cashBRL.toFixed(2)})
                  </button>
                ) : null}
              </label>
              <fieldset className="flex flex-col gap-1 text-xs font-medium text-muted-foreground min-w-0">
                <legend className="text-xs font-medium text-muted-foreground mb-1">Modo de simulação</legend>
                <RadioGroup
                  name="aporte-mode"
                  value={mode}
                  onValueChange={(val) => setMode(val as AporteMode)}
                  options={[
                    {
                      value: "both",
                      label: "Ativo e classe",
                    },
                    {
                      value: "asset",
                      label: "Meta por ativo",
                    },
                    {
                      value: "class",
                      label: "Meta por classe",
                    },
                  ]}
                />
              </fieldset>
            </div>
          </section>

          {result ? (
            <AporteResult
              mode={mode}
              aporte={result.aporte}
              totalAllocated={result.totalAllocated}
              leftover={result.leftover}
              routes={routes}
              classSummaries={result.classSummaries}
              skippedAssets={result.skippedAssets}
              onExecuteAporte={eligibleRoutes.length > 0 ? () => setConfirmBatchOpen(true) : undefined}
              executing={isApplying}
            />
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={confirmBatchOpen}
        onOpenChange={setConfirmBatchOpen}
        title="Aplicar aporte à carteira?"
        description={`Essa ação atualizará a quantidade e o preço médio ponderado de ${eligibleRoutes.length} ativos da sua carteira e registrará a contribuição deste mês.`}
        confirmLabel="Aplicar aporte"
        confirmPending={isApplying}
        onConfirm={() => void handleExecuteBatch()}
      />
    </div>
  );

  return (
    <Tabs
      value={subTab}
      onValueChange={(value) => setSubTab(value as AporteSubTab)}
      variant="pills"
      items={[
        {
          value: "calculadora",
          label: "Calculadora",
          content: calculadoraContent,
        },
        {
          value: "metas",
          label: "Metas",
          content: <TargetsTab onGoToPosition={onGoToPosition} />,
        },
        {
          value: "historico",
          label: "Histórico",
          content: <ContributionsPanel />,
        },
      ]}
    />
  );
}
