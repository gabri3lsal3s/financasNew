import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Calculator, ShieldCheck, Sparkles } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, ErrorState, MoneyInput, SkeletonChart, SkeletonKpi } from "@/components/ui";

import { AporteResult, type AporteRouteRow, type CustomAporteExecutionItem } from "@/components/modules";
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

/**
 * Calculadora de aporte (§F36) — simulação hierárquica unificada (Classe -> Setor -> Ativo).
 * Ao aplicar o lote, executa a transação atômica via RPC (`execute_portfolio_batch_aporte`)
 * atualizando posições, registrando compras em `portfolio_transactions` e histórico em `portfolio_contributions`.
 */
export function AporteTab({ onGoToPosition }: { onGoToPosition?: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const position = usePortfolioPosition();
  const targetsQuery = useAllocationTargets();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const executeBatch = useExecutePortfolioBatchAporte();

  // Valor do aporte: por padrão ZERO (R$ 0,00)
  const [userAporteCents, setUserAporteCents] = useState<number>(0);

  const animatedRafRef = useRef<number | null>(null);
  const lastParamValorRef = useRef<string | null>(null);

  const animateToCents = useCallback((targetCents: number, fromCents?: number) => {
    const baseFrom = fromCents !== undefined ? fromCents : userAporteCents;

    if (typeof window === "undefined") {
      setUserAporteCents(targetCents);
      return;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const hasRaf = typeof window.requestAnimationFrame === "function";

    if (prefersReducedMotion || !hasRaf || targetCents === baseFrom) {
      setUserAporteCents(targetCents);
      return;
    }

    if (animatedRafRef.current) {
      cancelAnimationFrame(animatedRafRef.current);
    }

    const durationMs = 400;
    let startTimestamp: number | null = null;

    const tick = (now: number) => {
      if (startTimestamp === null) startTimestamp = now;
      const progress = Math.min(1, (now - startTimestamp) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(baseFrom + (targetCents - baseFrom) * eased);
      setUserAporteCents(current);

      if (progress < 1) {
        animatedRafRef.current = requestAnimationFrame(tick);
      } else {
        setUserAporteCents(targetCents);
        animatedRafRef.current = null;
      }
    };

    animatedRafRef.current = requestAnimationFrame(tick);
  }, [userAporteCents]);

  useEffect(() => {
    return () => {
      if (animatedRafRef.current) {
        cancelAnimationFrame(animatedRafRef.current);
      }
    };
  }, []);

  // Ref para guardar o valor pendente de injeção via URL
  const pendingInjectRef = useRef<number | null>(null);

  // Passo 1 — Consome o parâmetro da URL e armazena em ref (sem setState no body do effect)
  useEffect(() => {
    const raw = searchParams.get("valor");
    if (raw && raw !== lastParamValorRef.current) {
      lastParamValorRef.current = raw;
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        // Remove silenciosamente o parâmetro 'valor' da URL
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("valor");
            return next;
          },
          { replace: true },
        );
        pendingInjectRef.current = Math.round(parsed);
      }
    }
  }, [searchParams, setSearchParams]);

  // Passo 2 — Dispara a animação após delay (600ms), aguardando a transição de rota fechar
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pendingInjectRef.current !== null) {
        animateToCents(pendingInjectRef.current, 0);
        pendingInjectRef.current = null;
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchParams, animateToCents]);

  const aporteCents = userAporteCents;
  const setAporteCents = (val: number) => setUserAporteCents(val);

  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [pendingCustomItems, setPendingCustomItems] = useState<CustomAporteExecutionItem[] | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

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

  const handleTriggerAporte = (items?: CustomAporteExecutionItem[]) => {
    setPendingCustomItems(items ?? null);
    setConfirmBatchOpen(true);
  };

  const handleExecuteBatch = async () => {
    const activeItems = pendingCustomItems ?? eligibleRoutes.map((r) => ({
      assetId: r.assetId,
      ticker: r.ticker,
      quantity: r.quantity,
      priceBRL: r.priceBRL,
      allocatedBRL: r.allocatedBRL,
    }));
    if (activeItems.length === 0 || isApplying) return;
    setBatchError(null);
    setIsApplying(true);
    try {
      const date = todayISO();
      const items = activeItems.map((r) => {
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
      const totalAmount = activeItems.reduce((acc, r) => acc + r.allocatedBRL, 0);

      await executeBatch.mutateAsync({
        items,
        date,
        totalAmount,
        notes: `Aporte inteligente (${activeItems.length} ativos)`,
      });

      setConfirmBatchOpen(false);
      setPendingCustomItems(null);
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
      {batchError ? <Alert variant="error">{batchError}</Alert> : null}

      {loading ? (
        <div className="flex flex-col gap-4">
          <SkeletonKpi />
          <SkeletonChart />
        </div>
      ) : error ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => {
            position.refetch();
            void targetsQuery.refetch();
            void classTargetsQuery.refetch();
            void sectorTargetsQuery.refetch();
          }}
        />
      ) : nonCashRows.length === 0 ? (
        <EmptyState
          icon={<Calculator className="size-6" />}
          title="Nenhum ativo investido para simular aporte"
          description="Cadastre ativos e metas na aba 'Metas' para que a calculadora distribua seu aporte de forma ideal."
          action={
            <Button variant="default" onClick={() => onGoToPosition?.()}>
              Ver Carteira
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label="Parâmetros da simulação" data-tour="investments-rebalance" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground w-full min-w-0">
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
                    animateToCents(Math.round(position.cashBRL * 100));
                    triggerSensory("selection");
                  }}
                  className="self-start text-[11px] text-portfolio hover:underline font-medium cursor-pointer pt-0.5"
                >
                  Usar saldo em caixa (R$ {position.cashBRL.toFixed(2)})
                </button>
              ) : null}
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
              <Sparkles className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-foreground">Motor Hierárquico:</strong> Estabiliza primeiro a macroclasse com maior déficit e depois distribui pelas metas dos ativos.
              </span>
            </div>
          </section>

          {result ? (
            <div className="animate-fade-in transition-all duration-300">
              <AporteResult
                mode="both"
                aporte={result.aporte}
                totalAllocated={result.totalAllocated}
                leftover={result.leftover}
                routes={routes}
                classSummaries={result.classSummaries}
                sectorSummaries={result.sectorSummaries}
                skippedAssets={result.skippedAssets}
                onExecuteAporte={handleTriggerAporte}
                executing={isApplying}
              />
            </div>
          ) : null}

          {/* Alerta Permanente de Conformidade Regulatória CVM (Contrato 5 / Resoluções CVM 19 e 20) */}
          <aside
            aria-label="Isenção regulatória CVM"
            className="flex items-start gap-3 rounded-2xl border border-border/80 bg-surface p-4 shadow-2xs text-xs text-muted-foreground"
          >
            <ShieldCheck className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold text-foreground text-xs">
                Isenção Regulatória CVM (Resoluções CVM nº 19/2021 e nº 20/2021)
              </p>
              <p className="text-[11px] leading-relaxed">
                Esta ferramenta opera como mero instrumento tecnológico de consolidação matemática e orçamentária.
                Todas as sugestões de rebalanceamento e alocação são derivadas puramente de formulações algorítmicas
                parametrizadas pelas metas e percentuais definidos discricionariamente por você, não configurando
                análise de valores mobiliários, consultoria financeira ou recomendação de compra e venda de ativos.
              </p>
            </div>
          </aside>
        </>
      )}

      <ConfirmDialog
        open={confirmBatchOpen}
        onOpenChange={(open) => {
          setConfirmBatchOpen(open);
          if (!open) setPendingCustomItems(null);
        }}
        title="Aplicar aporte à carteira?"
        description={`Essa ação atualizará a quantidade e o preço médio ponderado de ${(pendingCustomItems ?? eligibleRoutes).length} ativos da sua carteira e registrará a contribuição deste mês.`}
        confirmLabel="Aplicar aporte"
        confirmPending={isApplying}
        onConfirm={() => void handleExecuteBatch()}
      />
    </div>
  );
}
