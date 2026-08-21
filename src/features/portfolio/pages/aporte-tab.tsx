import { useState } from "react";
import { Calculator } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, MoneyInput, RadioGroup, SkeletonChart, SkeletonKpi } from "@/components/ui";
import { AporteResult, type AporteRouteRow } from "@/components/modules";
import {
  classCapsFromSectorCaps,
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
  useCreatePortfolioTransactionsBatch,
  useGroupTargets,
  usePortfolioPosition,
  useSectorCaps,
} from "@/state";

/**
 * Calculadora de aporte (§3.11.3) — simulação local (pura) em 2 modos:
 * por meta individual de ativo ou por meta de classe, com travas setoriais
 * e log de roteamento. Nada é persistido: a sugestão é um relatório.
 */
export function AporteTab({ onGoToPosition }: { onGoToPosition?: () => void }) {
  const position = usePortfolioPosition();
  const targetsQuery = useAllocationTargets();
  const classTargetsQuery = useGroupTargets("class");
  const capsQuery = useSectorCaps();
  const createBatch = useCreatePortfolioTransactionsBatch();

  const [aporteCents, setAporteCents] = useState(0);
  const [mode, setMode] = useState<AporteMode>("asset");
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const error = position.error ?? targetsQuery.error ?? classTargetsQuery.error ?? capsQuery.error;
  const loading = position.isLoading || targetsQuery.isLoading || classTargetsQuery.isLoading || capsQuery.isLoading;

  const classes = [...new Set(position.rows.map((r) => r.assetClass).filter((c): c is string => c !== null))];

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

  const assets: AporteAssetInput[] = position.rows.map((row) => ({
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
        : simulateRebalanceAporte({ aporte: aporteCents / 100, assets, classTargets, classCaps })
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
    if (eligibleRoutes.length === 0) return;
    setBatchError(null);
    try {
      const date = todayISO();
      const payload = eligibleRoutes.map((r) => ({
        asset_id: r.assetId,
        type: "buy" as const,
        date,
        quantity: r.quantity,
        price: r.priceBRL,
        total: Math.round(r.quantity * r.priceBRL * 100) / 100,
      }));

      await createBatch.mutateAsync(payload);
      triggerSensory("success");
      pushToast({
        title: "Aportes registrados",
        description: `${eligibleRoutes.length} compras adicionadas ao extrato da carteira.`,
      });
      setConfirmBatchOpen(false);
      setAporteCents(0);
      onGoToPosition?.();
    } catch (err) {
      setBatchError(getErrorMessage(err));
    }
  };

  const hasAssetTargets = targetsQuery.data !== undefined && targetsQuery.data.length > 0;
  const hasClassTargets = classTargets.length > 0;

  return (
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
          description="Adicione ativos na aba Posição antes de simular o aporte."
          tone="portfolio"
          headingLevel="h2"
          action={
            onGoToPosition ? (
              <Button type="button" onClick={onGoToPosition}>
                Ir para Posição
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
              </label>
              <fieldset className="flex flex-col gap-1 text-xs font-medium text-muted-foreground min-w-0">
                Modo de rebalanceamento
                <RadioGroup
                  value={mode}
                  onValueChange={(value) => setMode(value as AporteMode)}
                  name="aporte-mode"
                  options={[
                    { value: "asset", label: "Por meta individual de ativo" },
                    { value: "class", label: "Por meta de classe" },
                  ]}
                />
              </fieldset>
            </div>

            {!hasAssetTargets && !hasClassTargets ? (
              <Alert variant="warning">
                Nenhuma meta definida: defina metas por ativo ou por classe na aba Metas para gerar sugestões.
              </Alert>
            ) : null}
          </section>

          {aporteCents <= 0 ? (
            <EmptyState
              icon={<Calculator className="size-6" aria-hidden="true" />}
              title="Informe o valor do aporte"
              description="A simulação distribui o aporte pelos gaps de alocação e devolve a sobra para caixa/reserva."
              headingLevel="h2"
            />
          ) : result ? (
            <AporteResult
              mode={mode}
              aporte={aporteCents / 100}
              totalAllocated={result.totalAllocated}
              leftover={result.leftover}
              routes={routes}
              onExecuteAporte={() => setConfirmBatchOpen(true)}
              executing={createBatch.isPending}
            />
          ) : null}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Sugestão calculada com base na posição e metas. Ao clicar em "Lançar compras no extrato", as operações de compra
        são registradas automaticamente no ledger.
      </p>

      <ConfirmDialog
        open={confirmBatchOpen}
        onOpenChange={setConfirmBatchOpen}
        title="Lançar compras no extrato?"
        description={
          eligibleRoutes.length > 0
            ? `Serão registradas ${eligibleRoutes.length} operações de compra (totalizando ${eligibleRoutes
                .reduce((acc, r) => acc + r.allocatedBRL, 0)
                .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) com a data de hoje.`
            : "Nenhuma operação de compra para lançar."
        }
        confirmLabel="Lançar compras"
        confirmPending={createBatch.isPending}
        onConfirm={() => void handleExecuteBatch()}
      />
    </div>
  );
}
