import { useState } from "react";
import { Calculator } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, MoneyInput, RadioGroup, SkeletonChart, SkeletonKpi, Tabs } from "@/components/ui";
import { AporteResult, type AporteRouteRow } from "@/components/modules";
import {
  calculateWeightedAveragePrice,
  classCapsFromSectorCaps,
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
import { pushToast } from "@/services/toast";
import {
  useAllocationTargets,
  useCreatePortfolioContribution,
  useGroupTargets,
  usePortfolioAssets,
  usePortfolioPosition,
  useSectorCaps,
  useUpdatePortfolioAsset,
} from "@/state";
import { ContributionsPanel } from "../components";

type AporteSubTab = "calculadora" | "historico";

/**
 * Calculadora de aporte (§F36) — simulação local (pura) em 2 modos:
 * por meta individual de ativo ou por meta de classe, com travas setoriais.
 * Ao aplicar o lote, atualiza a quantidade e preço médio ponderado dos ativos
 * e registra o aporte em `portfolio_contributions`.
 *
 * Sub-tabs:
 * - Calculadora: rebalanceador interativo
 * - Histórico: lista de aportes registrados por mês (§F37)
 */
export function AporteTab({ onGoToPosition }: { onGoToPosition?: () => void }) {
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const targetsQuery = useAllocationTargets();
  const classTargetsQuery = useGroupTargets("class");
  const capsQuery = useSectorCaps();
  const updateAsset = useUpdatePortfolioAsset();
  const createContribution = useCreatePortfolioContribution();

  const [subTab, setSubTab] = useState<AporteSubTab>("calculadora");
  const [aporteCents, setAporteCents] = useState(0);
  const [mode, setMode] = useState<AporteMode>("both");
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const error = position.error ?? targetsQuery.error ?? classTargetsQuery.error ?? capsQuery.error;
  const loading = position.isLoading || targetsQuery.isLoading || classTargetsQuery.isLoading || capsQuery.isLoading;

  const nonCashRows = position.rows.filter((r) => !r.isCash);
  const classes = [...new Set(nonCashRows.map((r) => r.assetClass).filter((c): c is string => c !== null))];

  const targetByAsset = new Map((targetsQuery.data ?? []).map((t) => [t.asset_id, t.target_percentage]));
  const classTargets: ClassTargetInput[] = (classTargetsQuery.data ?? []).map((t) => ({
    className: t.name,
    targetPercentage: t.target_percentage,
  }));
  const classCaps = classCapsFromSectorCaps(
    classes,
    capsQuery.data?.maxSectorAcoes ?? null,
    capsQuery.data?.maxSectorFiis ?? null,
  );

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
        ? simulateSmartAporte({ aporte: aporteCents / 100, assets, classCaps })
        : mode === "class"
          ? simulateRebalanceAporte({ aporte: aporteCents / 100, assets, classTargets, classCaps })
          : simulateCombinedAporte({ aporte: aporteCents / 100, assets, classTargets, classCaps })
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
      const assetsList = assetsQuery.data ?? [];
      let totalAllocatedBRL = 0;

      for (const r of eligibleRoutes) {
        const currentAsset = assetsList.find((a) => a.id === r.assetId);
        const currentQty = Number(currentAsset?.quantity ?? 0);
        const currentAvgPrice = Number(currentAsset?.average_price ?? 0);

        const newLotQty = r.quantity;
        const newLotPrice = r.priceBRL;
        const lotCalc = calculateWeightedAveragePrice(currentQty, currentAvgPrice, newLotQty, newLotPrice);

        await updateAsset.mutateAsync({
          id: r.assetId,
          patch: {
            quantity: lotCalc.newQuantity,
            average_price: lotCalc.newAveragePrice,
          },
        });

        totalAllocatedBRL += r.allocatedBRL;
      }

      // Registra a contribuição do aporte mensal
      await createContribution.mutateAsync({
        asset_id: null,
        date,
        amount: Math.round(totalAllocatedBRL * 100) / 100,
        notes: `Aporte inteligente (${eligibleRoutes.length} ativos)`,
      });

      triggerSensory("success");
      pushToast({
        title: "Aportes aplicados à carteira",
        description: `Posições de ${eligibleRoutes.length} ativos atualizadas com sucesso.`,
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
          value: "historico",
          label: "Histórico",
          content: <ContributionsPanel />,
        },
      ]}
    />
  );
}
