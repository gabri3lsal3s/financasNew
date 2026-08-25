import { useState } from "react";
import { useSearchParams } from "react-router";
import { Calculator, Sparkles, Upload } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, MoneyInput, SkeletonChart, SkeletonKpi, Tabs } from "@/components/ui";
import { AporteResult, type AporteRouteRow } from "@/components/modules";
import {
  inferSectorFromTicker,
  simulateCombinedAporte,
  type AporteAssetInput,
  type ClassTargetInput,
  type SectorTargetInput,
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
import { ContributionsPanel, PortfolioImportDialog } from "../components";
import { TargetsTab } from "./targets-tab";

type AporteSubTab = "calculadora" | "metas" | "historico";

/**
 * Calculadora de aporte (§F36) — simulação hierárquica unificada (Classe -> Setor -> Ativo).
 * Ao aplicar o lote, executa a transação atômica via RPC (`execute_portfolio_batch_aporte`)
 * atualizando posições, registrando compras em `portfolio_transactions` e histórico em `portfolio_contributions`.
 *
 * Sub-tabs:
 * - Calculadora: rebalanceador interativo hierárquico
 * - Metas: gestão visual de alocação por ativo, setor e classe
 * - Histórico: lista de aportes registrados por mês (§F37)
 */
export function AporteTab({ onGoToPosition }: { onGoToPosition?: () => void }) {
  const [searchParams] = useSearchParams();
  const position = usePortfolioPosition();
  const targetsQuery = useAllocationTargets();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const executeBatch = useExecutePortfolioBatchAporte();

  const [subTab, setSubTab] = useState<AporteSubTab>("calculadora");

  const [userAporteCents, setUserAporteCents] = useState<number | null>(null);
  const paramValorCents = (() => {
    const raw = searchParams.get("valor");
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
  })();

  const aporteCents = userAporteCents ?? paramValorCents;
  const setAporteCents = (val: number) => setUserAporteCents(val);

  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const error = position.error ?? targetsQuery.error ?? classTargetsQuery.error ?? sectorTargetsQuery.error;
  const loading = position.isLoading || targetsQuery.isLoading || classTargetsQuery.isLoading || sectorTargetsQuery.isLoading;

  const nonCashRows = position.rows.filter((r) => !r.isCash);
  const classes = [...new Set(position.rows.map((r) => r.assetClass).filter((c): c is string => c !== null))];

  const targetByAsset = new Map((targetsQuery.data ?? []).map((t) => [t.asset_id, t.target_percentage]));
  const classTargets: ClassTargetInput[] = (classTargetsQuery.data ?? []).map((t) => ({
    className: t.name,
    targetPercentage: t.target_percentage,
  }));

  const sectorTargets: SectorTargetInput[] = (sectorTargetsQuery.data ?? []).flatMap((st) => {
    const matchedClasses = classes.filter((cls) => {
      const inAssets = position.rows.some((r) => r.assetClass === cls && (r.sector === st.name || inferSectorFromTicker(r.ticker, cls) === st.name));
      return inAssets;
    });
    if (matchedClasses.length === 0) {
      return [{ className: "Ações", sectorName: st.name, targetPercentage: st.target_percentage }];
    }
    return matchedClasses.map((className) => ({
      className,
      sectorName: st.name,
      targetPercentage: st.target_percentage,
    }));
  });

  const hasIndividualTargets = (targetsQuery.data ?? []).length > 0;
  const assets: AporteAssetInput[] = nonCashRows.map((row) => ({
    id: row.assetId,
    ticker: row.ticker,
    assetClass: row.assetClass,
    sector: row.sector ?? inferSectorFromTicker(row.ticker, row.assetClass),
    currency: row.currency,
    currentValueBRL: row.valueBRL,
    priceBRL: row.priceBRL,
    targetPercentage: targetByAsset.has(row.assetId)
      ? targetByAsset.get(row.assetId)!
      : (hasIndividualTargets ? 0 : null),
  }));

  const result =
    aporteCents > 0 && assets.length > 0
      ? simulateCombinedAporte({ aporte: aporteCents / 100, assets, classTargets, sectorTargets })
      : null;

  const routes: AporteRouteRow[] =
    result?.routes.map((r) => ({
      assetId: r.assetId,
      ticker: r.ticker,
      assetClass: r.assetClass,
      sector: r.sector,
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
      const items = eligibleRoutes.map((r) => {
        const row = position.rows.find((p) => p.assetId === r.assetId);
        const isUSD = row?.currency === "USD";
        const rate = isUSD ? (row?.usdRate || 5.25) : 1;
        return {
          asset_id: r.assetId,
          quantity: r.quantity,
          price: isUSD ? Math.round((r.priceBRL / rate) * 100) / 100 : r.priceBRL,
          total: isUSD ? Math.round((r.allocatedBRL / rate) * 100) / 100 : r.allocatedBRL,
        };
      });
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

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={subTab}
        onValueChange={(v) => {
          setSubTab(v as AporteSubTab);
          triggerSensory("selection");
        }}
        variant="pills"
        items={[
          { value: "calculadora", label: "Calculadora" },
          { value: "metas", label: "Metas de Alocação" },
          { value: "historico", label: "Histórico de Aportes" },
        ]}
      />

      {subTab === "metas" && <TargetsTab onGoToPosition={onGoToPosition} />}

      {subTab === "historico" && <ContributionsPanel />}

      {subTab === "calculadora" && (
        <>
          {batchError ? <Alert variant="error">{batchError}</Alert> : null}

          {loading ? (
            <div className="flex flex-col gap-4">
              <SkeletonKpi />
              <SkeletonChart />
            </div>
          ) : error ? (
            <Alert variant="error">{getErrorMessage(error)}</Alert>
          ) : nonCashRows.length === 0 ? (
            <EmptyState
              icon={<Calculator className="size-6" />}
              title="Nenhum ativo investido para simular aporte"
              description="Cadastre ativos e metas na aba 'Metas' para que a calculadora distribua seu aporte de forma ideal."
              action={
                <Button variant="default" onClick={() => setSubTab("metas")}>
                  Configurar Metas
                </Button>
              }
            />
          ) : (
            <>
              <section aria-label="Parâmetros da simulação" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground w-full min-w-0">
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
                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
                  <Sparkles className="size-4 text-portfolio shrink-0" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold text-foreground">Motor Hierárquico:</strong> Estabiliza primeiro a macroclasse com maior déficit e depois distribui pelas metas dos ativos.
                  </span>
                </div>
              </section>

              {result ? (
                <AporteResult
                  mode="both"
                  aporte={result.aporte}
                  totalAllocated={result.totalAllocated}
                  leftover={result.leftover}
                  routes={routes}
                  classSummaries={result.classSummaries}
                  sectorSummaries={result.sectorSummaries}
                  skippedAssets={result.skippedAssets}
                  onExecuteAporte={eligibleRoutes.length > 0 ? () => setConfirmBatchOpen(true) : undefined}
                  executing={isApplying}
                />
              ) : null}
            </>
          )}
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

      {/* Importação contextual — atualizar posição antes de aportar */}
      {subTab === "calculadora" && (
        <section
          aria-label="Importar posição via planilha"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border/80 bg-surface/70 px-4 py-3.5 shadow-xs transition-all hover:border-border"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground">Posição desatualizada?</span>
            <span className="text-xs text-muted-foreground">
              Importe um arquivo .xlsx ou .csv para atualizar suas posições antes de simular o aporte.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="h-8 text-xs gap-1.5 shrink-0 sm:flex-initial"
          >
            <Upload className="size-3.5 text-portfolio" aria-hidden="true" />
            <span>Importar Planilha</span>
          </Button>
        </section>
      )}

      <PortfolioImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
