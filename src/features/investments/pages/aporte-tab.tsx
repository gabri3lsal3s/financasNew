import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Calculator, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  MoneyInput,
  MoneyText,
  SkeletonChart,
  SkeletonKpi,
  Switch,
} from "@/components/ui";

import { AporteResult, type AporteRouteRow, type CustomAporteExecutionItem } from "@/components/modules";
import {
  calculateEffectiveAssetTargets,
  inferSectorFromTicker,
  simulateCombinedAporte,
  type AporteAssetInput,
  type ClassTargetInput,
  type SectorTargetInput,
} from "@/domain/portfolio";
import { todayISO } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsBRL } from "@/services/masks";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import {
  useExecutePortfolioBatchAporte,
  useGroupTargets,
  usePortfolioAssets,
  usePortfolioPosition,
} from "@/state";
import { InvestmentWizard } from "../wizard";
import type { PortfolioAsset } from "@/types";

/**
 * Calculadora de aporte (§F36) — simulação hierárquica unificada (Classe -> Setor -> Ativo).
 * Ao aplicar o lote, executa a transação atômica via RPC (`execute_portfolio_batch_aporte`)
 * atualizando posições, registrando compras em `portfolio_transactions` e histórico em `portfolio_contributions`.
 */
export function AporteTab({
  onGoToPosition,
  onGoToTargets,
}: {
  onGoToPosition?: () => void;
  onGoToTargets?: () => void;
}) {
  const { guardAction, upgradeModal } = useMutationGuard({ moduleKey: "investments" });
  const [searchParams, setSearchParams] = useSearchParams();
  const position = usePortfolioPosition();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const assetsQuery = usePortfolioAssets();
  const executeBatch = useExecutePortfolioBatchAporte();

  // Estados do Investment Wizard integrado (§F36)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardAsset, setWizardAsset] = useState<PortfolioAsset | null>(null);
  const [wizardQuantity, setWizardQuantity] = useState<number | undefined>(undefined);
  const [wizardTotalCents, setWizardTotalCents] = useState<number | undefined>(undefined);

  const handleOpenWizardForAsset = useCallback((ticker: string, quantity: number, allocatedBRL?: number) => {
    const asset = (assetsQuery.data ?? []).find((a) => a.ticker.toUpperCase() === ticker.toUpperCase()) ?? null;
    if (asset) {
      setWizardAsset(asset);
      setWizardQuantity(quantity > 0 ? quantity : undefined);
      setWizardTotalCents(allocatedBRL && allocatedBRL > 0 ? Math.round(allocatedBRL * 100) : undefined);
      setWizardOpen(true);
    }
  }, [assetsQuery.data]);

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

  // Passo 1 — Consome o parâmetro da URL (valor ou surplusCents) e armazena em ref (sem setState no body do effect)
  useEffect(() => {
    const raw = searchParams.get("valor") || searchParams.get("surplusCents");
    if (raw && raw !== lastParamValorRef.current) {
      lastParamValorRef.current = raw;
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        // Remove silenciosamente o parâmetro da URL
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("valor");
            next.delete("surplusCents");
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

  // Aporte Composto (Bolso + Saldo de Caixa na corretora — Decisão 1 · Plano 42)
  const availableCashCents = Math.max(0, Math.round(position.cashBRL * 100));
  const [useBrokerageCash, setUseBrokerageCash] = useState(false);
  const [cashUsedCents, setCashUsedCents] = useState<number>(0);
  const effectiveCashSelectedCents =
    useBrokerageCash && availableCashCents > 0
      ? Math.min(Math.max(0, cashUsedCents), availableCashCents)
      : 0;
  const totalPurchasingCents = aporteCents + effectiveCashSelectedCents;

  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [pendingCustomItems, setPendingCustomItems] = useState<CustomAporteExecutionItem[] | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const error = position.error ?? classTargetsQuery.error ?? sectorTargetsQuery.error;
  const loading = position.isLoading || classTargetsQuery.isLoading || sectorTargetsQuery.isLoading;

  const nonCashRows = position.rows.filter((r) => !r.isCash);
  const classes = [...new Set(nonCashRows.map((r) => r.assetClass).filter((c): c is string => c !== null))];

  const rawAssets = assetsQuery.data ?? [];
  const rawAssetMap = new Map(rawAssets.map((a) => [a.id, a]));

  const classTargets: ClassTargetInput[] = (classTargetsQuery.data ?? []).map((t) => ({
    className: t.name,
    targetPercentage: t.target_percentage,
  }));

  const sectorTargets: SectorTargetInput[] = (sectorTargetsQuery.data ?? []).flatMap((st) => {
    const scopedClass = st.class_name?.trim();
    if (scopedClass) {
      return [{ className: scopedClass, sectorName: st.name, targetPercentage: st.target_percentage }];
    }
    const matchedClasses = classes.filter((cls) =>
      nonCashRows.some(
        (r) =>
          r.assetClass === cls &&
          (r.sector === st.name || inferSectorFromTicker(r.ticker, cls) === st.name),
      ),
    );
    if (matchedClasses.length === 0) {
      return [{ className: "Ações", sectorName: st.name, targetPercentage: st.target_percentage }];
    }
    return matchedClasses.map((className) => ({
      className,
      sectorName: st.name,
      targetPercentage: st.target_percentage,
    }));
  });

  const assets: AporteAssetInput[] = nonCashRows.map((row) => {
    const raw = rawAssetMap.get(row.assetId);
    return {
      id: row.assetId,
      ticker: row.ticker,
      assetClass: row.assetClass,
      sector: row.sector ?? raw?.sector ?? inferSectorFromTicker(row.ticker, row.assetClass),
      currency: row.currency,
      currentValueBRL: row.valueBRL,
      priceBRL: row.priceBRL,
      score: raw?.score ?? null,
      allocation_status: raw?.allocation_status ?? "active",
    };
  });

  const effectiveTargetsMap = new Map(
    calculateEffectiveAssetTargets({ assets, classTargets, sectorTargets }).map((item) => [
      item.assetId,
      item,
    ]),
  );

  const result =
    totalPurchasingCents > 0 && assets.length > 0
      ? simulateCombinedAporte({
          aporte: totalPurchasingCents / 100,
          assets,
          classTargets,
          sectorTargets,
        })
      : null;

  const routes: AporteRouteRow[] =
    result?.routes.map((r) => {
      const eff = effectiveTargetsMap.get(r.assetId);
      const raw = rawAssetMap.get(r.assetId);
      return {
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
        rawScore: eff?.rawScore ?? raw?.score ?? null,
        effectiveTargetPct: eff?.effectiveTargetPct,
        formulaLabel: eff?.formulaLabel,
      };
    }) ?? [];

  const eligibleRoutes = routes.filter((r) => r.quantity > 0);

  const handleTriggerAporte = (items?: CustomAporteExecutionItem[]) => {
    guardAction(() => {
      setPendingCustomItems(items ?? null);
      setConfirmBatchOpen(true);
    }, "Registrar Aporte");
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
      const cashUsedBRL =
        effectiveCashSelectedCents > 0
          ? Math.min(effectiveCashSelectedCents / 100, totalAmount, position.cashBRL)
          : 0;
      const roundedCashUsed =
        cashUsedBRL > 0 ? Math.round(cashUsedBRL * 100) / 100 : undefined;

      await executeBatch.mutateAsync({
        items,
        date,
        totalAmount,
        cashUsed: roundedCashUsed,
        notes: roundedCashUsed
          ? `Aporte composto (${activeItems.length} ativos · Caixa ${formatCentsAsBRL(Math.round(roundedCashUsed * 100))})`
          : `Aporte inteligente (${activeItems.length} ativos)`,
      });

      setConfirmBatchOpen(false);
      setPendingCustomItems(null);
      setAporteCents(0);
      setUseBrokerageCash(false);
      setCashUsedCents(0);
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
        <div data-tour="investments-rebalance" className="flex flex-col gap-4">
          <SkeletonKpi />
          <SkeletonChart />
        </div>
      ) : error ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => {
            position.refetch();
            void classTargetsQuery.refetch();
            void sectorTargetsQuery.refetch();
          }}
        />
      ) : nonCashRows.length === 0 ? (
        <EmptyState
          icon={<Calculator className="size-6" />}
          title="Nenhum ativo investido para simular aporte"
          description="Cadastre ativos e defina suas metas na aba de Metas para que o motor distribua seu aporte de forma ideal."
          action={
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => (onGoToTargets ? onGoToTargets() : onGoToPosition?.())}
                className="cursor-pointer rounded-xl"
              >
                Definir Metas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGoToPosition?.()}
                className="cursor-pointer rounded-xl"
              >
                Ver Carteira
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <section aria-label="Parâmetros da simulação" data-tour="investments-rebalance" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground w-full min-w-0">
              Valor do aporte (dinheiro novo)
              <MoneyInput
                cents={aporteCents}
                onCentsChange={setAporteCents}
                size="md"
                aria-label="Valor do aporte"
                placeholder="R$ 0,00"
              />
            </label>

            {availableCashCents > 0 ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface-hover/30 p-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Wallet className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <Switch
                        checked={useBrokerageCash}
                        onCheckedChange={(checked) => {
                          setUseBrokerageCash(checked);
                          if (checked && (cashUsedCents <= 0 || cashUsedCents > availableCashCents)) {
                            setCashUsedCents(availableCashCents);
                          }
                        }}
                        label="Somar saldo em Caixa da corretora"
                        description={`Disponível em Caixa: ${formatCentsAsBRL(availableCashCents)}`}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      animateToCents(0);
                      setUseBrokerageCash(true);
                      setCashUsedCents(availableCashCents);
                    }}
                    className="self-start sm:self-center shrink-0"
                  >
                    Usar apenas o Caixa
                  </Button>
                </div>

                {useBrokerageCash ? (
                  <div className="flex flex-col gap-2.5 border-t border-border/60 pt-2.5">
                    <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground w-full min-w-0">
                      Saldo em Caixa a utilizar (máx. {formatCentsAsBRL(availableCashCents)})
                      <MoneyInput
                        cents={effectiveCashSelectedCents}
                        onCentsChange={(next) =>
                          setCashUsedCents(Math.min(Math.max(0, next), availableCashCents))
                        }
                        size="md"
                        aria-label="Saldo em caixa utilizado"
                        placeholder="R$ 0,00"
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        Poder de compra composto: Bolso{" "}
                        <MoneyText cents={aporteCents} tone="default" className="font-semibold text-foreground" />{" "}
                        + Caixa{" "}
                        <MoneyText cents={effectiveCashSelectedCents} tone="default" className="font-semibold text-foreground" />
                      </span>
                      <MoneyText
                        cents={totalPurchasingCents}
                        tone="portfolio"
                        className="text-sm font-bold"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
              <Sparkles className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-foreground">Motor Hierárquico:</strong> Estabiliza primeiro a classe e o setor mais defasados e distribui pelos pesos das Notas (0 a 10) dos ativos elegíveis.
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
                onOpenWizard={handleOpenWizardForAsset}
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
                A decisão de alocação e a transmissão de ordens cabem exclusivamente ao titular perante sua respectiva corretora.
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
        description={
          effectiveCashSelectedCents > 0
            ? `Essa ação atualizará ${(pendingCustomItems ?? eligibleRoutes).length} ativos, debitando até ${formatCentsAsBRL(effectiveCashSelectedCents)} do saldo em Caixa e registrando apenas o dinheiro novo no histórico de aportes.`
            : `Essa ação atualizará a quantidade e o preço médio ponderado de ${(pendingCustomItems ?? eligibleRoutes).length} ativos da sua carteira e registrará a contribuição deste mês.`
        }
        confirmLabel="Aplicar aporte"
        confirmPending={isApplying}
        onConfirm={() => void handleExecuteBatch()}
      />

      <InvestmentWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialAsset={wizardAsset}
        initialQuantity={wizardQuantity}
        initialTotalCents={wizardTotalCents}
        onSuccess={() => {
          void position.refetch();
          void classTargetsQuery.refetch();
          void sectorTargetsQuery.refetch();
          void assetsQuery.refetch();
        }}
      />

      {upgradeModal}
    </div>
  );
}
