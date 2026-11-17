import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  Calendar,
  Clock,
  Edit2,
  Globe,
  Pencil,
  Plus,
  Receipt,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  Modal,
  ModalFooter,
  Skeleton,
} from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { formatCentsAsBRL } from "@/services/masks/money";
import { formatPercent } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

import {
  ALLOCATION_STATUS_META,
  CRITERIA_BY_ARCHETYPE,
  calculateEffectiveAssetTargets,
  getScoreArchetypeKey,
  getScoreConvictionMeta,
} from "@/domain/portfolio";
import { inferSectorFromTicker } from "@/domain/portfolio/tickers-catalog";
import { calculateYieldOnCostTotal } from "@/domain/portfolio/snowball";
import { formatFixedIncomeRateLabel } from "@/domain/portfolio/fixed-income";
import { getAssetPricingMode, isCashAssetClass } from "@/domain/portfolio/valuation";
import { formatDateBR } from "@/lib/date";
import {
  useAssetPosition,
  useDeletePortfolioAsset,
  useDeletePortfolioTransaction,
  useFamilyMode,
  useGroupTargets,
  useMyFamily,
  usePortfolioAssets,
  usePortfolioPosition,
} from "@/state";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import type { PortfolioAsset, PortfolioTransaction, PortfolioTransactionType } from "@/types";
import { AssetEditDialog } from "./asset-edit-dialog";
import { AssetScoreEvaluationDialog } from "./asset-score-evaluation-dialog";
import { CalibrateFixedIncomeDialog } from "./calibrate-fixed-income-dialog";
import { QuickTransactionSheet } from "./quick-transaction-sheet";

export interface AssetDetailSheetProps {
  asset: PortfolioAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction?: (action: "buy" | "sell" | "dividend" | "split", asset: PortfolioAsset) => void;
  onOpenWizard?: (asset: PortfolioAsset, initialQuantity?: number, initialTotalCents?: number) => void;
}

export function AssetDetailSheet({
  asset,
  open,
  onOpenChange,
  onAction,
  onOpenWizard,
}: AssetDetailSheetProps) {
  const { guardAction, upgradeModal } = useMutationGuard();
  const assetId = asset?.id ?? null;
  const { data: txs, isLoading: txLoading } = useAssetPosition(assetId);
  const assetsQuery = usePortfolioAssets();
  const position = usePortfolioPosition();
  const deleteAsset = useDeletePortfolioAsset();
  const deleteTx = useDeletePortfolioTransaction();

  const { isFamilyModeEnabled } = useFamilyMode();
  const { data: myFamilyData } = useMyFamily();
  const currentMember = myFamilyData?.currentMember;

  const groupTargetsSector = useGroupTargets("sector");
  const groupTargetsClass = useGroupTargets("class");

  const [editOpen, setEditOpen] = useState(false);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<PortfolioTransaction | null>(null);
  const [txToEdit, setTxToEdit] = useState<PortfolioTransaction | null>(null);
  const [createTxOpen, setCreateTxOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [nowMs] = useState(() => Date.now());

  if (!asset) return null;

  // Busca a versão mais recente do ativo e a linha consolidada de posição
  const currentAsset = (assetsQuery.data ?? []).find((a) => a.id === asset.id) ?? asset;
  const isSharedWithFamily = Boolean(
    isFamilyModeEnabled &&
      (Boolean(currentAsset.is_family) ||
        Boolean(currentMember?.share_all_portfolio) ||
        (currentAsset.asset_class &&
          (currentMember?.shared_asset_classes ?? []).includes(currentAsset.asset_class))),
  );
  const positionRow = position.rows.find((r) => r.assetId === currentAsset.id);

  const pricingMode = getAssetPricingMode({
    ticker: currentAsset.ticker,
    asset_class: currentAsset.asset_class,
    notes: currentAsset.notes,
  });
  const isCash = pricingMode === "cash" || isCashAssetClass(currentAsset.asset_class);
  const isTotalValue = pricingMode === "total_value";

  // Valores consolidados em tempo real
  const quantity = positionRow ? positionRow.quantity : Number(currentAsset.quantity ?? 0);
  const averageCost = positionRow ? positionRow.averageCost : Number(currentAsset.average_price ?? 0);
  const totalCost = positionRow
    ? positionRow.totalCostBRL
    : isTotalValue
      ? averageCost > 0 ? averageCost : quantity
      : quantity * averageCost;

  const currentPrice = positionRow ? positionRow.priceBRL : averageCost;
  const currentValue = positionRow ? positionRow.valueBRL : (isCash ? quantity : quantity * currentPrice);
  const unrealizedPnl = positionRow ? positionRow.unrealizedPnl : (isCash ? 0 : currentValue - totalCost);
  const unrealizedPnlPct = positionRow
    ? (positionRow.unrealizedPct ?? 0)
    : totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

  // Proventos consolidados (acumulados históricos + lançamentos periódicos)
  const isUSD = currentAsset.currency === "USD";
  const usdRate = positionRow?.usdRate || 5.25;
  const totalDividendsNative = positionRow?.dividendsNative ?? (currentAsset.accumulated_dividends ?? 0);
  const totalDividendsBRL = positionRow ? positionRow.dividends : totalDividendsNative * (isUSD ? usdRate : 1);
  const accumulatedDividendsNative = currentAsset.accumulated_dividends ?? 0;
  const periodicDividendsNative = Math.max(0, totalDividendsNative - accumulatedDividendsNative);

  // Custo na moeda nativa do ativo (para cálculo de YoC homogêneo na mesma moeda)
  const totalCostNative = positionRow
    ? positionRow.totalCost
    : isTotalValue
      ? averageCost > 0 ? averageCost : quantity
      : quantity * averageCost;

  const yieldOnCostPct = calculateYieldOnCostTotal(accumulatedDividendsNative, periodicDividendsNative, totalCostNative);

  const totalReturnPnl = positionRow
    ? positionRow.totalReturnPnl
    : (isCash ? 0 : unrealizedPnl + totalDividendsBRL);
  const totalReturnPct = positionRow
    ? (positionRow.totalReturnPct ?? 0)
    : totalCost > 0 ? (totalReturnPnl / totalCost) * 100 : 0;

  const isClosed = !isCash && quantity <= 0 && currentValue <= 0;
  const appliedCost = positionRow?.historicalCostBRL ?? totalCost;
  const redeemedAmount = positionRow?.historicalRedeemedBRL ?? 0;
  const finalPnl = positionRow?.totalReturnPnl ?? (redeemedAmount - appliedCost + totalDividendsBRL);
  const finalReturnPct = positionRow?.finalReturnPct ?? (appliedCost > 0 ? (finalPnl / appliedCost) * 100 : null);

  // Métrica da TIR / Fluxo do Bolso individual do ativo
  const assetIrr = positionRow?.irrResult;
  const isAssetIrrReady = Boolean(assetIrr?.isEligible && assetIrr.annualizedRatePct !== null);
  const hasPeriodRate = Boolean(
    assetIrr?.isEligible &&
    assetIrr.periodRatePct !== null &&
    Math.abs(assetIrr.periodRatePct ?? 0) <= 500,
  );
  const hasIrr = isAssetIrrReady || hasPeriodRate;
  const irrRate = assetIrr?.annualizedRatePct ?? assetIrr?.periodRatePct ?? null;
  const irrLabel =
    isAssetIrrReady
      ? `${(assetIrr?.annualizedRatePct ?? 0) >= 0 ? "+" : ""}${(assetIrr?.annualizedRatePct ?? 0).toFixed(1)}% a.a.`
      : hasPeriodRate && (assetIrr?.daysElapsed ?? 0) >= 30
        ? `${(assetIrr?.periodRatePct ?? 0) >= 0 ? "+" : ""}${(assetIrr?.periodRatePct ?? 0).toFixed(1)}% no período`
        : "Em formação";
  const irrSub =
    assetIrr?.status === "insufficient_capital_coverage"
      ? "Aguardando compras"
      : (assetIrr?.daysElapsed ?? 0) < 30
        ? `Histórico de ${assetIrr?.daysElapsed ?? 0}d`
        : isAssetIrrReady
          ? `Ponderada (${assetIrr?.daysElapsed}d)`
          : `Histórico de ${assetIrr?.daysElapsed}d (< 365d p/ anualizar)`;


  const formatTxType = (type: PortfolioTransactionType) => {
    switch (type) {
      case "buy":
      case "subscription":
        return { label: "Compra", variant: "positive" as const };
      case "sell":
        return { label: "Venda", variant: "negative" as const };
      case "dividend":
      case "jcp":
      case "fii_yield":
        return { label: "Provento", variant: "default" as const };
      case "split":
        return { label: "Desdobramento", variant: "muted" as const };
      case "reverse_split":
        return { label: "Grupamento", variant: "muted" as const };
      default:
        return { label: type, variant: "muted" as const };
    }
  };

  const resolvedSector = currentAsset.sector?.trim() || (currentAsset.asset_class ? inferSectorFromTicker(currentAsset.ticker, currentAsset.asset_class) : null);

  const effectiveTargets = calculateEffectiveAssetTargets({
    assets: (assetsQuery.data ?? []).map((a) => {
      const cls = a.asset_class?.trim() || "Ações";
      const sec = a.sector?.trim() || inferSectorFromTicker(a.ticker, cls);
      return {
        id: a.id,
        ticker: a.ticker,
        assetClass: cls,
        sector: sec,
        score: a.score ?? null,
        allocation_status: a.allocation_status ?? "active",
      };
    }),
    classTargets: (groupTargetsClass.data ?? []).map((ct) => ({
      className: ct.name,
      targetPercentage: ct.target_percentage,
    })),
    sectorTargets: (groupTargetsSector.data ?? [])
      .map((st) => ({
        className:
          st.class_name?.trim() ||
          (resolvedSector && st.name === resolvedSector && currentAsset.asset_class ? currentAsset.asset_class : ""),
        sectorName: st.name,
        targetPercentage: st.target_percentage,
      }))
      .filter((st) => st.className.length > 0),
  });

  const effectiveResult = effectiveTargets.find((r) => r.assetId === currentAsset.id) ?? null;
  const assetTargetPct =
    !isCash && effectiveResult && effectiveResult.classTargetPct > 0
      ? effectiveResult.effectiveTargetPct
      : null;

  const classTarget = currentAsset.asset_class
    ? (groupTargetsClass.data ?? []).find((c) => c.name === currentAsset.asset_class)
    : undefined;
  const classTargetPct =
    effectiveResult && effectiveResult.classTargetPct > 0
      ? effectiveResult.classTargetPct
      : (classTarget?.target_percentage ?? null);

  const sectorTarget = resolvedSector
    ? (groupTargetsSector.data ?? []).find(
        (s) => s.name === resolvedSector && (!s.class_name || s.class_name === currentAsset.asset_class),
      )
    : undefined;
  const sectorTargetPct = sectorTarget?.target_percentage ?? null;

  const totalPortfolioValue = position.totalBRL || position.rows.reduce((s, r) => s + r.valueBRL, 0);
  const currentPctInPortfolio = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;

  const hasAssetTarget = assetTargetPct !== null && assetTargetPct > 0;
  const targetValueBRL = hasAssetTarget ? (totalPortfolioValue * assetTargetPct) / 100 : 0;
  const gapBRL = hasAssetTarget ? targetValueBRL - currentValue : 0;
  const gapCents = numberToCents(gapBRL);

  // Desconto vs Preço Médio (PM) para Renda Variável
  const hasDiscountVsPM = !isTotalValue && !isCash && averageCost > 0 && currentPrice < averageCost;
  const diffVsPMPct = !isTotalValue && !isCash && averageCost > 0 ? ((currentPrice - averageCost) / averageCost) * 100 : 0;

  // Sugestão de cotas para absorver o gap
  const suggestedQtyToAbsorb =
    !isTotalValue && currentPrice > 0 && gapBRL > 0 ? Math.floor(gapBRL / currentPrice) : undefined;
  const suggestedTotalCents = gapCents > 0 ? gapCents : undefined;

  // Metadados de Governança, Nota e Tese (null nunca fabrica "Nota 8")
  const assetScore = currentAsset.score ?? null;
  const allocationStatus = currentAsset.allocation_status ?? "active";
  const convictionMeta = getScoreConvictionMeta(assetScore);
  const statusMeta = ALLOCATION_STATUS_META[allocationStatus];
  const archetypeCriteria = CRITERIA_BY_ARCHETYPE[getScoreArchetypeKey(currentAsset.asset_class)] ?? [];
  const metCriteriaCount = archetypeCriteria.filter(
    (c) => Number(currentAsset.score_criteria?.[c.key] ?? 0) >= 1,
  ).length;
  const reviewFreqMonths = currentAsset.review_frequency_months ?? 6;
  const maxAllowedDays = reviewFreqMonths * 30.4375;
  const lastReviewedDate = currentAsset.last_reviewed_at ? new Date(currentAsset.last_reviewed_at) : null;
  const daysSinceReview = lastReviewedDate
    ? Math.floor((nowMs - lastReviewedDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isReviewOverdue = daysSinceReview !== null && daysSinceReview > maxAllowedDays;

  const statusBadgeVariant =
    allocationStatus === "active"
      ? ("positive" as const)
      : allocationStatus === "quarantine"
        ? ("warning" as const)
        : allocationStatus === "exit"
          ? ("negative" as const)
          : ("muted" as const);

  const statusBadgeLabel = statusMeta.label;

  const scoreBadgeVariant =
    assetScore === null
      ? ("muted" as const)
      : assetScore >= 7
        ? ("positive" as const)
        : assetScore >= 4
          ? ("warning" as const)
          : ("negative" as const);

  const handleAporteClick = () => {
    guardAction(() => {
      if (onOpenWizard) {
        onOpenWizard(currentAsset, suggestedQtyToAbsorb, suggestedTotalCents);
      } else {
        onAction?.("buy", currentAsset);
      }
    }, "Registrar Aporte");
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={currentAsset.ticker}
        description={resolvedSector ? `${currentAsset.asset_class ?? "Ativo"} · ${resolvedSector}` : (currentAsset.asset_class ?? "Ativo em Carteira")}
        size="2xl"
        footer={
          <ModalFooter
            borderless
            destructiveAction={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  guardAction(() => {
                    setDeleteConfirmOpen(true);
                  }, "Excluir Ativo da Carteira")
                }
                className="text-critical hover:bg-critical/10"
              >
                <Trash2 className="size-3.5 mr-1" aria-hidden="true" />
                Excluir Ativo da Carteira
              </Button>
            }
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </ModalFooter>
        }
      >
        <div className="flex flex-col gap-5 pt-1">
          {/* Header de Metadados & Ações Rápidas */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {isSharedWithFamily && (
                <Badge variant="portfolio" size="xs">
                  Patrimônio Familiar
                </Badge>
              )}
              {isClosed ? (
                <Badge variant="muted" size="xs">
                  Posição Encerrada
                </Badge>
              ) : null}
              {currentAsset.currency !== "BRL" ? (
                <Badge variant="muted" size="xs">
                  {currentAsset.currency}
                </Badge>
              ) : null}
              {!isClosed && currentAsset.fixed_income_metadata && currentAsset.fixed_income_metadata.rate_value > 0 ? (
                <Badge variant="default" size="xs">
                  {formatFixedIncomeRateLabel(currentAsset.fixed_income_metadata)} • Projetado
                </Badge>
              ) : null}
              {!isClosed && positionRow?.isMatured ? (
                <Badge variant="negative" size="xs">
                  Vencido em {formatDateBR(positionRow.maturityDate ?? "")}
                </Badge>
              ) : !isClosed && positionRow?.maturityDate ? (
                <Badge variant="warning" size="xs">
                  Vence em {formatDateBR(positionRow.maturityDate)}
                </Badge>
              ) : null}
              {!isClosed && positionRow?.fixedIncomeResult && positionRow.fixedIncomeResult.businessDaysAccrued > 0 ? (
                <Badge variant="muted" size="xs">
                  {positionRow.fixedIncomeResult.businessDaysAccrued}d úteis desde {formatDateBR(currentAsset.fixed_income_metadata?.base_date ?? "")}
                </Badge>
              ) : null}
              {!isClosed && currentAsset.fixed_income_metadata?.is_tax_exempt ? (
                <Badge variant="positive" size="xs">
                  Isento de IR
                </Badge>
              ) : !isClosed && positionRow?.fixedIncomeResult?.hasExplicitTaxInfo ? (
                positionRow?.fixedIncomeResult?.taxCountdown ? (
                  <Badge variant="muted" size="xs">
                    IR {positionRow.taxRatePct}% <ArrowRight className="size-2.5 inline-block mx-0.5" aria-hidden="true" /> {positionRow.fixedIncomeResult.taxCountdown.nextRatePct}% em {positionRow.fixedIncomeResult.taxCountdown.daysRemaining}d
                  </Badge>
                ) : (
                  <Badge variant="muted" size="xs">
                    IR {positionRow?.taxRatePct ?? 22.5}%
                  </Badge>
                )
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  guardAction(() => {
                    onAction?.("buy", currentAsset);
                  }, "Registrar Aporte")
                }
                className="gap-1 text-xs text-primary flex-1 sm:flex-initial"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Aportar</span>
              </Button>
              {!isClosed ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    guardAction(() => {
                      onAction?.("sell", currentAsset);
                    }, "Registrar Resgate")
                  }
                  className={`gap-1 text-xs flex-1 sm:flex-initial ${positionRow?.isMatured ? "border-critical-strong/60 text-critical-strong" : ""}`}
                >
                  <ArrowDownLeft className="size-3.5" aria-hidden="true" />
                  <span>{positionRow?.isMatured ? "Liquidar Caixa" : isTotalValue ? "Resgatar" : "Vender"}</span>
                </Button>
              ) : null}
              {isTotalValue && !isClosed && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    guardAction(() => {
                      setCalibrateOpen(true);
                    }, "Calibrar Renda Fixa")
                  }
                  className="size-8 !min-w-8 !w-8 p-0 shrink-0 text-muted-foreground cursor-pointer"
                  title="Calibrar com saldo do extrato"
                  aria-label="Calibrar com saldo do extrato"
                >
                  <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">Calibrar com saldo do extrato</span>
                </Button>
              )}
              {(!isTotalValue || totalDividendsNative > 0 || (currentAsset.accumulated_dividends ?? 0) > 0) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    guardAction(() => {
                      onAction?.("dividend", currentAsset);
                    }, "Lançar Proventos")
                  }
                  className="gap-1 text-xs text-positive-strong flex-1 sm:flex-initial"
                >
                  <Receipt className="size-3.5" aria-hidden="true" />
                  <span>{isTotalValue ? "Rendimento" : "Provento"}</span>
                </Button>
              )}
              {!isTotalValue && !isCash && !isClosed && quantity > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    guardAction(() => {
                      setSplitOpen(true);
                      onAction?.("split", currentAsset);
                    }, "Desdobrar / Agrupar Cotas")
                  }
                  className="size-8 !min-w-8 !w-8 p-0 shrink-0 text-muted-foreground cursor-pointer"
                  title="Desdobramento ou grupamento de cotas"
                  aria-label="Desdobramento ou grupamento de cotas"
                >
                  <Scissors className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">Desdobrar ou agrupar cotas</span>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  guardAction(() => {
                    setEditOpen(true);
                  }, "Editar Ativo")
                }
                className="size-8 !min-w-8 !w-8 p-0 shrink-0 text-muted-foreground cursor-pointer"
                title="Editar Ativo"
                aria-label="Editar Ativo"
              >
                <Edit2 className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Editar Ativo</span>
              </Button>
            </div>
          </div>

          {/* Grid de Métricas Principais da Posição */}
          {isClosed ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground truncate">Custódia</span>
                <span className="font-mono text-sm sm:text-base font-bold text-muted-foreground whitespace-nowrap tabular-nums">
                  R$ 0,00
                </span>
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  Posição liquidada
                </span>
              </div>

              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground truncate">Total Aplicado</span>
                <span className="font-mono text-sm sm:text-base font-bold text-foreground whitespace-nowrap tabular-nums">
                  <MoneyText cents={numberToCents(appliedCost)} />
                </span>
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  Custo histórico
                </span>
              </div>

              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground truncate">Total Resgatado</span>
                <span className="font-mono text-sm sm:text-base font-bold text-foreground whitespace-nowrap tabular-nums">
                  <MoneyText cents={numberToCents(redeemedAmount)} />
                </span>
                <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap tabular-nums">
                  {totalDividendsNative > 0 ? (isUSD ? `+ $ ${totalDividendsNative.toFixed(2)} proventos` : `+ R$ ${totalDividendsNative.toFixed(2)} proventos`) : "Crédito em caixa"}
                </span>
              </div>

              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground truncate">Rentabilidade Final</span>
                <span
                  className={cn(
                    "font-mono text-sm sm:text-base font-bold whitespace-nowrap tabular-nums",
                    finalPnl >= 0 ? "text-positive-strong" : "text-critical-strong",
                  )}
                >
                  <MoneyText cents={numberToCents(finalPnl)} sign="explicit" />
                </span>
                <span className={`text-[10px] font-mono font-semibold truncate ${finalPnl >= 0 ? "text-positive-strong" : "text-critical-strong"}`}>
                  {finalReturnPct !== null ? `${finalReturnPct >= 0 ? "+" : ""}${finalReturnPct.toFixed(2)}% realizado` : "—"}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                  {isTotalValue ? "Saldo Atual" : "Posição Total"}
                </span>
                <span className="font-mono text-sm sm:text-base font-bold text-foreground tabular-nums tracking-tight whitespace-nowrap" title={formatCentsAsBRL(numberToCents(currentValue))}>
                  <MoneyText cents={numberToCents(currentValue)} />
                </span>
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  {isTotalValue
                    ? (currentAsset.fixed_income_metadata?.rate_value && currentAsset.fixed_income_metadata.rate_value > 0
                        ? "Na curva projetada"
                        : "Saldo cadastrado manual")
                    : `${quantity} cota(s)`}
                </span>
              </div>

              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                  {isTotalValue ? "Valor Aplicado" : "Preço Médio (PM)"}
                </span>
                <span className="font-mono text-sm sm:text-base font-bold text-foreground whitespace-nowrap tabular-nums">
                  <MoneyText cents={numberToCents(isTotalValue ? totalCost : averageCost)} currency={isTotalValue ? "BRL" : currentAsset.currency} />
                </span>
                <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap tabular-nums">
                  {isTotalValue ? "Aporte inicial" : <>Custo: <MoneyText cents={numberToCents(totalCost)} currency="BRL" /></>}
                </span>
              </div>

              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                  {isTotalValue ? "Rendimento Total" : "Resultado Total"}
                </span>
                <span
                  className={cn(
                    "font-mono text-sm sm:text-base font-bold whitespace-nowrap tabular-nums",
                    (totalReturnPnl ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong",
                  )}
                  title={`Retorno Total: ${(totalReturnPnl ?? 0) >= 0 ? "+" : ""}${formatCentsAsBRL(numberToCents(totalReturnPnl ?? 0))} (${(totalReturnPct ?? 0).toFixed(2)}%)`}
                >
                  {(totalReturnPnl ?? 0) >= 0 ? "+" : ""}
                  <MoneyText cents={numberToCents(totalReturnPnl ?? 0)} />
                </span>
                <div className="flex items-center gap-1.5 text-[10px] font-mono truncate">
                  <span
                    className={(totalReturnPct ?? 0) >= 0 ? "text-positive-strong font-semibold" : "text-negative-strong font-semibold"}
                  >
                    {(totalReturnPct ?? 0) >= 0 ? "+" : ""}
                    {(totalReturnPct ?? 0).toFixed(2)}%
                  </span>
                  {totalDividendsNative > 0 && !isTotalValue ? (
                    <span className="text-muted-foreground text-[9px] truncate" title={`Cotação: ${(unrealizedPnlPct ?? 0) >= 0 ? "+" : ""}${(unrealizedPnlPct ?? 0).toFixed(2)}% | Proventos: +${(yieldOnCostPct ?? 0).toFixed(2)}%`}>
                      (Cotação {(unrealizedPnlPct ?? 0) >= 0 ? "+" : ""}${(unrealizedPnlPct ?? 0).toFixed(1)}%)
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Card 4: TIR / Fluxo do Ativo (XIRR) */}
              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground truncate" title="Taxa Interna de Retorno ponderada pelas datas de aportes, resgates e proventos">
                  TIR do Ativo
                </span>
                <span
                  className={cn(
                    "font-mono text-sm sm:text-base font-bold whitespace-nowrap tabular-nums",
                    hasIrr ? ((irrRate ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong") : "text-muted-foreground",
                  )}
                  title={`TIR Ponderada no Tempo: ${irrLabel} (${irrSub})`}
                >
                  {irrLabel}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono truncate" title={irrSub}>
                  {irrSub}
                </span>
              </div>

              {/* Card 5: Vencimento (Renda Fixa sem provento) ou Yield on Cost */}
              {isTotalValue && totalDividendsNative === 0 ? (
                <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
                  <span className="text-[11px] font-medium text-muted-foreground truncate">Vencimento</span>
                  <span className="font-mono text-sm sm:text-base font-bold text-foreground whitespace-nowrap tabular-nums">
                    {positionRow?.maturityDate ? formatDateBR(positionRow.maturityDate) : "Indeterminado"}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">
                    {positionRow?.isMatured
                      ? "Título vencido"
                      : currentAsset.fixed_income_metadata?.is_tax_exempt
                        ? "Isento de IR"
                        : positionRow?.fixedIncomeResult?.hasExplicitTaxInfo
                          ? positionRow?.fixedIncomeResult?.taxCountdown
                            ? `IR ${positionRow.taxRatePct}% (cai p/ ${positionRow.fixedIncomeResult.taxCountdown.nextRatePct}% em ${positionRow.fixedIncomeResult.taxCountdown.daysRemaining}d)`
                            : `IR ${positionRow?.taxRatePct ?? 22.5}%`
                          : "Acumulativo"}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
                  <span className="text-[11px] font-medium text-muted-foreground truncate">Yield on Cost (YoC)</span>
                  <span className="font-mono text-sm sm:text-base font-bold text-positive-strong whitespace-nowrap tabular-nums">
                    {yieldOnCostPct.toFixed(2)}%
                  </span>
                  {accumulatedDividendsNative > 0 ? (
                    <div className="flex flex-col gap-0.5 min-w-0 overflow-x-auto no-scrollbar">
                      <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap tabular-nums">
                        Extrato: <MoneyText cents={numberToCents(periodicDividendsNative)} currency={currentAsset.currency} />
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap tabular-nums">
                        Acumulados: <MoneyText cents={numberToCents(accumulatedDividendsNative)} currency={currentAsset.currency} />
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono font-semibold whitespace-nowrap tabular-nums">
                        Total: <MoneyText cents={numberToCents(totalDividendsNative)} currency={currentAsset.currency} />
                        {isUSD && totalDividendsNative > 0 ? (
                          <span className="font-normal text-muted-foreground ml-1">
                            (≈ <MoneyText cents={numberToCents(totalDividendsBRL)} currency="BRL" />)
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap tabular-nums">
                      Proventos: <MoneyText cents={numberToCents(totalDividendsNative)} currency={currentAsset.currency} />
                      {isUSD && totalDividendsNative > 0 ? (
                        <span className="font-normal text-muted-foreground ml-1">
                          (≈ <MoneyText cents={numberToCents(totalDividendsBRL)} currency="BRL" />)
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Diagnóstico de Alocação & Metas */}
          {!isClosed && !isCash && (
            <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs">
              {/* Cabeçalho do Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="size-4 text-primary shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Diagnóstico de Alocação & Metas
                  </span>
                  {hasAssetTarget ? (
                    <Badge variant="default" size="xs">
                      Meta: {formatPercent(assetTargetPct ?? 0)}%
                    </Badge>
                  ) : sectorTargetPct !== null ? (
                    <Badge variant="muted" size="xs">
                      Setor: {formatPercent(sectorTargetPct)}%
                    </Badge>
                  ) : classTargetPct !== null ? (
                    <Badge variant="muted" size="xs">
                      Classe: {formatPercent(classTargetPct)}%
                    </Badge>
                  ) : null}
                </div>

                {hasDiscountVsPM ? (
                  <Badge variant="positive" size="xs" className="self-start sm:self-auto gap-1">
                    <TrendingDown className="size-3" aria-hidden="true" />
                    <span>Desconto de {Math.abs(diffVsPMPct).toFixed(1)}% vs PM</span>
                  </Badge>
                ) : diffVsPMPct > 0 ? (
                  <Badge variant="muted" size="xs" className="self-start sm:self-auto gap-1">
                    <TrendingUp className="size-3" aria-hidden="true" />
                    <span>+{diffVsPMPct.toFixed(1)}% acima do PM</span>
                  </Badge>
                ) : null}
              </div>

              {/* Métricas do Diagnóstico */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    % na Carteira
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                    {currentPctInPortfolio.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    de R$ {totalPortfolioValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Meta Derivada
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                    {hasAssetTarget
                      ? `${formatPercent(assetTargetPct ?? 0)}%`
                      : sectorTargetPct !== null
                        ? `${formatPercent(sectorTargetPct)}% (setor)`
                        : "Não definida"}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">
                    {hasAssetTarget ? (
                      <>Alvo: <MoneyText cents={numberToCents(targetValueBRL)} /></>
                    ) : (
                      "Configure em Rebalancear > Metas"
                    )}
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Gap Orçamentário
                  </span>
                  {hasAssetTarget ? (
                    gapBRL > 0 ? (
                      <>
                        <span className="font-mono text-sm font-bold text-positive-strong tabular-nums">
                          +<MoneyText cents={gapCents} tone="positive" />
                        </span>
                        <span className="text-[10px] text-positive-strong font-medium truncate">
                          {suggestedQtyToAbsorb ? `${suggestedQtyToAbsorb} cota(s) sugerida(s)` : "Abaixo da meta"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-sm font-bold text-muted-foreground tabular-nums">
                          Equilibrado
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          Meta atingida
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      <span className="font-mono text-sm font-bold text-muted-foreground tabular-nums">
                        —
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        Sem meta por ativo
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-col justify-end min-w-0 col-span-2 sm:col-span-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={gapBRL > 0 || hasDiscountVsPM ? "default" : "outline"}
                    onClick={handleAporteClick}
                    className="gap-1.5 text-xs font-semibold w-full"
                  >
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    <span>Aportar no Wizard</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Card de Governança & Tese do Ativo */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <SlidersHorizontal className="size-4 text-primary shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Tese & Governança do Ativo
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant={scoreBadgeVariant} size="xs">
                  {assetScore !== null ? `Nota ${assetScore}/10` : "Sem nota"}
                </Badge>
                <Badge variant={statusBadgeVariant} size="xs">
                  {statusBadgeLabel}
                </Badge>
                {assetScore !== null && (
                  <Badge variant="muted" size="xs">
                    {convictionMeta.label}
                  </Badge>
                )}
                {isReviewOverdue && (
                  <Badge variant="warning" size="xs" className="gap-1">
                    <Clock className="size-3" aria-hidden="true" />
                    <span>Revisão vencida</span>
                  </Badge>
                )}
              </div>
            </div>

            {effectiveResult?.formulaLabel && (
              <p className="text-[11px] text-muted-foreground">
                Fórmula na carteira: <span className="font-medium text-foreground">{effectiveResult.formulaLabel}</span>
              </p>
            )}

            {currentAsset.thesis_summary ? (
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Tese de Investimento
                </span>
                <p className="text-xs text-foreground/90 italic bg-surface-hover/50 border-l-2 border-primary/50 rounded-r-lg p-2.5">
                  &ldquo;{currentAsset.thesis_summary}&rdquo;
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs pt-1">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Ciclo de Revisão
                </span>
                <span className="text-xs font-semibold text-foreground">
                  A cada {reviewFreqMonths} meses
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Critérios Atendidos
                </span>
                <span className="text-xs font-semibold text-foreground font-mono">
                  {metCriteriaCount}/{archetypeCriteria.length}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Última Avaliação
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {currentAsset.last_reviewed_at
                    ? formatDateBR(currentAsset.last_reviewed_at.slice(0, 10))
                    : "Não registrada"}
                </span>
              </div>
              <div className="flex flex-col justify-end min-w-0 col-span-2 sm:col-span-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEvaluationOpen(true)}
                  className="gap-1.5 text-xs font-medium w-full cursor-pointer"
                >
                  <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                  <span>Avaliar Tese & Nota</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Card de Custódia Internacional Dual (USD / BRL) */}
          {isUSD && (
            <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="size-4 text-primary shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Custódia Internacional (USD)
                  </span>
                </div>
                <Badge variant="muted" size="xs">
                  Taxa PTAX: R$ {usdRate.toFixed(4)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Posição em US$
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                    $ {(currentValue / usdRate).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    R$ <MoneyText cents={numberToCents(currentValue)} />
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Cotação Nativa
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                    $ {(positionRow?.priceQuote ?? (currentPrice / usdRate)).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    R$ <MoneyText cents={numberToCents(currentPrice)} />
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Preço Médio US$
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                    $ {averageCost.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Custo nativo
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Proventos em US$
                  </span>
                  <span className="font-mono text-sm font-bold text-positive-strong tabular-nums">
                    $ {totalDividendsNative.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    YoC Nativo: {yieldOnCostPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Histórico de Transações do Ledger */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Histórico de Operações & Proventos</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setTxToEdit(null);
                    setCreateTxOpen(true);
                  }}
                  className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10 gap-1 cursor-pointer"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  <span>Nova Operação</span>
                </Button>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {(txs ?? []).length} operação(ões)
                </span>
              </div>
            </div>

            {txLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : (txs ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Nenhuma operação registrada individualmente no histórico.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface/60">
                {(txs ?? []).map((tx) => {
                  const txInfo = formatTxType(tx.type);
                  return (
                    <div
                      key={tx.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 p-3 text-xs hover:bg-surface-hover/60 transition-colors"
                    >
                      {/* Linha 1 no mobile / Lado esquerdo no desktop */}
                      <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant={txInfo.variant} size="xs" className="shrink-0">
                            {txInfo.label}
                          </Badge>
                          <span className="font-mono text-muted-foreground shrink-0">{tx.date}</span>
                        </div>
                        {/* No mobile, exibe o total na ponta da linha 1 */}
                        <span className="font-mono font-semibold text-foreground sm:hidden shrink-0">
                          <MoneyText cents={numberToCents(tx.total)} currency={currentAsset.currency} />
                        </span>
                      </div>

                      {/* Linha 2 no mobile: detalhes de cotação e botões de ação / Lado direito no desktop */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        {tx.quantity > 0 && !isTotalValue ? (
                          <span className="text-muted-foreground font-mono text-[11px] sm:text-xs">
                            {tx.quantity} un @ <MoneyText cents={numberToCents(tx.price)} currency={currentAsset.currency} />
                          </span>
                        ) : (
                          <span className="hidden sm:inline" />
                        )}

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* No desktop, exibe o total antes dos botões */}
                          <span className="font-mono font-semibold text-foreground hidden sm:inline mr-1">
                            <MoneyText cents={numberToCents(tx.total)} currency={currentAsset.currency} />
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              guardAction(() => {
                                setTxToEdit(tx);
                              }, "Editar Operação de Investimento")
                            }
                            className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Editar lançamento"
                            aria-label="Editar lançamento"
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              guardAction(() => {
                                setTxToDelete(tx);
                              }, "Excluir Operação de Investimento")
                            }
                            className="size-7 p-0 text-muted-foreground hover:text-negative-strong cursor-pointer"
                            title="Excluir lançamento"
                            aria-label="Excluir lançamento"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Diálogo de Edição Cadastral */}
      <AssetEditDialog
        asset={currentAsset}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Diálogo de Calibração de Marco Zero */}
      <CalibrateFixedIncomeDialog
        asset={currentAsset}
        open={calibrateOpen}
        onOpenChange={setCalibrateOpen}
        currentEstimatedValueCents={numberToCents(currentValue)}
      />

      {/* Confirmação de Exclusão do Ativo */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Excluir ${currentAsset.ticker}?`}
        description="Esta ação removerá o ativo da sua carteira, incluindo todas as transações vinculadas. Essa operação não pode ser desfeita."
        confirmLabel="Sim, excluir ativo"
        variant="destructive"
        onConfirm={async () => {
          triggerSensory("destructive");
          await deleteAsset.mutateAsync(currentAsset.id);
          onOpenChange(false);
        }}
      />

      {/* Confirmação de Exclusão de Transação Individual */}
      <ConfirmDialog
        open={txToDelete !== null}
        onOpenChange={(next) => !next && setTxToDelete(null)}
        title="Excluir movimentação?"
        description="Esta operação será removida do histórico do ativo e a posição recalculada atomicamente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={async () => {
          if (txToDelete) {
            triggerSensory("destructive");
            await deleteTx.mutateAsync(txToDelete);
            setTxToDelete(null);
          }
        }}
      />

      {/* Painel Unificado de Operação / Edição / Split */}
      <QuickTransactionSheet
        open={txToEdit !== null || createTxOpen || splitOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setTxToEdit(null);
            setCreateTxOpen(false);
            setSplitOpen(false);
          }
        }}
        asset={currentAsset}
        initialType={splitOpen ? "split" : "buy"}
        editTransaction={txToEdit}
      />

      {/* Diálogo de Avaliação Holística de Tese & Nota */}
      <AssetScoreEvaluationDialog
        asset={currentAsset}
        open={evaluationOpen}
        onOpenChange={setEvaluationOpen}
      />

      {upgradeModal}
    </>
  );
}
