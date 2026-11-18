import {
  ALLOCATION_STATUS_META,
  CRITERIA_BY_ARCHETYPE,
  calculateEffectiveAssetTargets,
  getScoreArchetypeKey,
  getScoreConvictionMeta,
} from "@/domain/portfolio";
import { inferSectorFromTicker } from "@/domain/portfolio/tickers-catalog";
import { formatSignedPct } from "@/services/masks";
import type { GroupTarget, PortfolioAsset } from "@/types";
import type { PortfolioPositionRow } from "@/state";

export function deriveIrrDisplay(positionRow: PortfolioPositionRow | undefined) {
  const assetIrr = positionRow?.irrResult;
  const isAssetIrrReady = Boolean(assetIrr?.isEligible && assetIrr.annualizedRatePct !== null);
  const hasPeriodRate = Boolean(
    assetIrr?.isEligible &&
      assetIrr.periodRatePct !== null &&
      Math.abs(assetIrr.periodRatePct ?? 0) <= 500,
  );
  const hasIrr = isAssetIrrReady || hasPeriodRate;
  const irrRate = assetIrr?.annualizedRatePct ?? assetIrr?.periodRatePct ?? null;
  const irrLabel = isAssetIrrReady
    ? `${formatSignedPct(assetIrr?.annualizedRatePct ?? 0)} a.a.`
    : hasPeriodRate && (assetIrr?.daysElapsed ?? 0) >= 30
      ? `${formatSignedPct(assetIrr?.periodRatePct ?? 0)} no período`
      : "Em formação";
  const irrSub =
    assetIrr?.status === "insufficient_capital_coverage"
      ? "Aguardando compras"
      : (assetIrr?.daysElapsed ?? 0) < 30
        ? `Histórico de ${assetIrr?.daysElapsed ?? 0}d`
        : isAssetIrrReady
          ? `Ponderada (${assetIrr?.daysElapsed}d)`
          : `Histórico de ${assetIrr?.daysElapsed}d (< 365d p/ anualizar)`;

  return { hasIrr, irrRate, irrLabel, irrSub };
}

export function deriveTargetsSummary(params: {
  currentAsset: PortfolioAsset;
  allAssets: readonly PortfolioAsset[];
  classTargets: readonly GroupTarget[];
  sectorTargets: readonly GroupTarget[];
  resolvedSector: string | null;
  isCash: boolean;
}) {
  const { currentAsset, allAssets, classTargets, sectorTargets, resolvedSector, isCash } = params;
  const effectiveTargets = calculateEffectiveAssetTargets({
    assets: allAssets.map((a) => {
      const cls = a.asset_class?.trim() || "Ações";
      return {
        id: a.id,
        ticker: a.ticker,
        assetClass: cls,
        sector: a.sector?.trim() || inferSectorFromTicker(a.ticker, cls),
        score: a.score ?? null,
        allocation_status: a.allocation_status ?? "active",
      };
    }),
    classTargets: classTargets.map((ct) => ({ className: ct.name, targetPercentage: ct.target_percentage })),
    sectorTargets: sectorTargets
      .map((st) => ({
        className:
          st.class_name?.trim() ||
          (resolvedSector && st.name === resolvedSector && currentAsset.asset_class
            ? currentAsset.asset_class
            : ""),
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
    ? classTargets.find((c) => c.name === currentAsset.asset_class)
    : undefined;
  const classTargetPct =
    effectiveResult && effectiveResult.classTargetPct > 0
      ? effectiveResult.classTargetPct
      : (classTarget?.target_percentage ?? null);
  const sectorTarget = resolvedSector
    ? sectorTargets.find(
        (s) => s.name === resolvedSector && (!s.class_name || s.class_name === currentAsset.asset_class),
      )
    : undefined;

  return {
    effectiveResult,
    assetTargetPct,
    classTargetPct,
    sectorTargetPct: sectorTarget?.target_percentage ?? null,
  };
}

export function deriveGovernanceSummary(currentAsset: PortfolioAsset, nowMs: number) {
  const assetScore = currentAsset.score ?? null;
  const allocationStatus = currentAsset.allocation_status ?? "active";
  const convictionMeta = getScoreConvictionMeta(assetScore);
  const statusMeta = ALLOCATION_STATUS_META[allocationStatus];
  const archetypeCriteria = CRITERIA_BY_ARCHETYPE[getScoreArchetypeKey(currentAsset.asset_class)] ?? [];
  const metCriteriaCount = archetypeCriteria.filter(
    (c) => Number(currentAsset.score_criteria?.[c.key] ?? 0) >= 1,
  ).length;
  const reviewFreqMonths = currentAsset.review_frequency_months ?? 6;
  const lastReviewedDate = currentAsset.last_reviewed_at ? new Date(currentAsset.last_reviewed_at) : null;
  const daysSinceReview = lastReviewedDate
    ? Math.floor((nowMs - lastReviewedDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    assetScore,
    allocationStatus,
    convictionMeta,
    statusMeta,
    archetypeCriteria,
    metCriteriaCount,
    reviewFreqMonths,
    isReviewOverdue: daysSinceReview !== null && daysSinceReview > reviewFreqMonths * 30.4375,
  };
}
