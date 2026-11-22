import { useState } from "react";
import { numberToCents } from "@/domain/money";
import { FALLBACK_USD_RATE } from "@/domain/portfolio";
import { calculateYieldOnCostTotal } from "@/domain/portfolio/snowball";
import { inferSectorFromTicker } from "@/domain/portfolio/tickers-catalog";
import { getAssetPricingMode, isCashAssetClass } from "@/domain/portfolio/valuation";
import {
  useAssetPosition,
  useFamilyMode,
  useGroupTargets,
  useMyFamily,
  usePortfolioAssets,
  usePortfolioPosition,
} from "@/state";
import type { PortfolioAsset } from "@/types";
import {
  deriveGovernanceSummary,
  deriveIrrDisplay,
  deriveTargetsSummary,
} from "./asset-detail-metrics-helpers";

export function useAssetDetailMetrics(asset: PortfolioAsset | null) {
  const { data: txs, isLoading: txLoading } = useAssetPosition(asset?.id ?? null);
  const assetsQuery = usePortfolioAssets();
  const position = usePortfolioPosition();
  const { isFamilyModeEnabled } = useFamilyMode();
  const { data: myFamilyData } = useMyFamily();
  const groupTargetsSector = useGroupTargets("sector");
  const groupTargetsClass = useGroupTargets("class");
  const [nowMs] = useState(() => Date.now());

  if (!asset) return null;

  const currentMember = myFamilyData?.currentMember;
  const allAssets = assetsQuery.data ?? [];
  const currentAsset = allAssets.find((a) => a.id === asset.id) ?? asset;

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

  const quantity = positionRow ? positionRow.quantity : Number(currentAsset.quantity ?? 0);
  const averageCost = positionRow ? positionRow.averageCost : Number(currentAsset.average_price ?? 0);
  const totalCost = positionRow
    ? positionRow.totalCostBRL
    : isTotalValue
      ? averageCost > 0
        ? averageCost
        : quantity
      : quantity * averageCost;

  const currentPrice = positionRow ? positionRow.priceBRL : averageCost;
  const currentValue = positionRow
    ? positionRow.valueBRL
    : isCash
      ? quantity
      : quantity * currentPrice;
  const unrealizedPnl = positionRow
    ? positionRow.unrealizedPnl
    : isCash
      ? 0
      : currentValue - totalCost;
  const unrealizedPnlPct = positionRow
    ? (positionRow.unrealizedPct ?? 0)
    : totalCost > 0
      ? (unrealizedPnl / totalCost) * 100
      : 0;

  const isUSD = currentAsset.currency === "USD";
  const usdRate = positionRow?.usdRate || FALLBACK_USD_RATE;
  const totalDividendsNative =
    positionRow?.dividendsNative ?? (currentAsset.accumulated_dividends ?? 0);
  const totalDividendsBRL = positionRow
    ? positionRow.dividends
    : totalDividendsNative * (isUSD ? usdRate : 1);
  const accumulatedDividendsNative = currentAsset.accumulated_dividends ?? 0;
  const periodicDividendsNative = Math.max(0, totalDividendsNative - accumulatedDividendsNative);
  const totalCostNative = positionRow
    ? positionRow.totalCost
    : isTotalValue
      ? averageCost > 0
        ? averageCost
        : quantity
      : quantity * averageCost;

  const yieldOnCostPct = calculateYieldOnCostTotal(
    accumulatedDividendsNative,
    periodicDividendsNative,
    totalCostNative,
  );
  const totalReturnPnl = positionRow
    ? positionRow.totalReturnPnl
    : isCash
      ? 0
      : unrealizedPnl + totalDividendsBRL;
  const totalReturnPct = positionRow
    ? (positionRow.totalReturnPct ?? 0)
    : totalCost > 0
      ? (totalReturnPnl / totalCost) * 100
      : 0;

  const isClosed = !isCash && quantity <= 0 && currentValue <= 0;
  const appliedCost = positionRow?.historicalCostBRL ?? totalCost;
  const redeemedAmount = positionRow?.historicalRedeemedBRL ?? 0;
  const finalPnl = positionRow?.totalReturnPnl ?? redeemedAmount - appliedCost + totalDividendsBRL;
  const finalReturnPct =
    positionRow?.finalReturnPct ?? (appliedCost > 0 ? (finalPnl / appliedCost) * 100 : null);

  const resolvedSector =
    currentAsset.sector?.trim() ||
    (currentAsset.asset_class
      ? inferSectorFromTicker(currentAsset.ticker, currentAsset.asset_class)
      : null);

  const targets = deriveTargetsSummary({
    currentAsset,
    allAssets,
    classTargets: groupTargetsClass.data ?? [],
    sectorTargets: groupTargetsSector.data ?? [],
    resolvedSector,
    isCash,
  });
  const totalPortfolioValue = position.totalBRL || position.rows.reduce((s, r) => s + r.valueBRL, 0);
  const currentPctInPortfolio = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;
  const hasAssetTarget = targets.assetTargetPct !== null && targets.assetTargetPct > 0;
  const targetValueBRL = hasAssetTarget ? (totalPortfolioValue * (targets.assetTargetPct ?? 0)) / 100 : 0;
  const gapBRL = hasAssetTarget ? targetValueBRL - currentValue : 0;
  const gapCents = numberToCents(gapBRL);

  const ceilingPriceNum =
    currentAsset.ceiling_price != null && Number(currentAsset.ceiling_price) > 0
      ? Number(currentAsset.ceiling_price)
      : null;
  const hasCeilingPrice = ceilingPriceNum !== null;
  const marginOfSafetyPct =
    hasCeilingPrice && currentPrice > 0
      ? ((ceilingPriceNum - currentPrice) / ceilingPriceNum) * 100
      : null;
  const hasOpportunityZone = hasCeilingPrice && currentPrice <= ceilingPriceNum;

  const hasDiscountVsPM = !isTotalValue && !isCash && averageCost > 0 && currentPrice < averageCost;
  const diffVsPMPct =
    !isTotalValue && !isCash && averageCost > 0
      ? ((currentPrice - averageCost) / averageCost) * 100
      : 0;

  return {
    currentAsset,
    ceilingPriceNum,
    hasCeilingPrice,
    marginOfSafetyPct,
    hasOpportunityZone,
    txs: txs ?? [],
    txLoading,
    positionRow,
    isSharedWithFamily,
    isCash,
    isTotalValue,
    isClosed,
    isUSD,
    usdRate,
    quantity,
    averageCost,
    totalCost,
    currentPrice,
    currentValue,
    unrealizedPnl,
    unrealizedPnlPct,
    totalDividendsNative,
    totalDividendsBRL,
    accumulatedDividendsNative,
    periodicDividendsNative,
    yieldOnCostPct,
    totalReturnPnl,
    totalReturnPct,
    appliedCost,
    redeemedAmount,
    finalPnl,
    finalReturnPct,
    ...deriveIrrDisplay(positionRow),
    resolvedSector,
    ...targets,
    totalPortfolioValue,
    currentPctInPortfolio,
    hasAssetTarget,
    targetValueBRL,
    gapBRL,
    gapCents,
    hasDiscountVsPM,
    diffVsPMPct,
    suggestedQtyToAbsorb:
      !isTotalValue && currentPrice > 0 && gapBRL > 0 ? Math.floor(gapBRL / currentPrice) : undefined,
    suggestedTotalCents: gapCents > 0 ? gapCents : undefined,
    ...deriveGovernanceSummary(currentAsset, nowMs),
  };
}

export type AssetDetailMetrics = NonNullable<ReturnType<typeof useAssetDetailMetrics>>;
