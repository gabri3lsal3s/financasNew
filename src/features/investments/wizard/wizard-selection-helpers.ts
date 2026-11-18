import { numberToCents } from "@/domain/money";
import { resolveAssetPrecision, resolveInitialUnitOrPositionCost } from "@/domain/portfolio";
import {
  inferSectorFromTicker,
  type AporteSuggestionItem,
  type TickerSearchResult,
} from "@/domain/portfolio/tickers-catalog";
import { getAssetPricingMode, isCashAssetClass, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import type { PortfolioAsset } from "@/types";
import { defaultWizardState, type InvestmentWizardState, type WizardMode } from "./wizard-state";

export interface WizardSectorTarget {
  className: string;
  sectorName: string;
  target_percentage: number;
}

export function expandWizardSectorTargets(
  rawSectorTargets: readonly { name: string; class_name?: string | null; target_percentage: number }[],
  classes: readonly string[],
  positionRows: readonly { assetClass: string | null; ticker: string; sector?: string | null }[],
): WizardSectorTarget[] {
  return rawSectorTargets.flatMap((st) => {
    if (st.class_name && st.class_name.trim().length > 0) {
      return [{ className: st.class_name, sectorName: st.name, target_percentage: st.target_percentage }];
    }
    const matched = classes.filter((cls) =>
      positionRows.some(
        (r) => r.assetClass === cls && (r.sector === st.name || inferSectorFromTicker(r.ticker, cls) === st.name),
      ),
    );
    return (matched.length === 0 ? ["Ações"] : matched).map((className) => ({
      className,
      sectorName: st.name,
      target_percentage: st.target_percentage,
    }));
  });
}

export function buildInitialWizardState(params: {
  initialAsset?: PortfolioAsset | null;
  initialMode?: WizardMode;
  initialQuantity?: number | string | null;
  initialTotalCents?: number | null;
}): InvestmentWizardState {
  const { initialAsset, initialMode, initialQuantity, initialTotalCents } = params;
  if (initialAsset) {
    const mode: WizardMode = initialMode && initialMode !== "select" ? initialMode : "buy";
    const priceCents = numberToCents(resolveInitialUnitOrPositionCost(initialAsset));
    const quantityStr = initialQuantity !== undefined && initialQuantity !== null ? String(initialQuantity) : "";
    const numQty = parseFloat(quantityStr) || 0;
    const totalCents =
      initialTotalCents !== undefined && initialTotalCents !== null && initialTotalCents > 0
        ? initialTotalCents
        : numQty > 0 && priceCents > 0
          ? Math.round(numQty * priceCents)
          : 0;
    return {
      ...defaultWizardState,
      mode,
      step: 2,
      selectedAsset: initialAsset,
      ticker: initialAsset.ticker,
      assetClass: initialAsset.asset_class ?? "Ações",
      currency: initialAsset.currency,
      isCash: isCashAssetClass(initialAsset.asset_class),
      priceCents,
      quantityStr,
      totalCents,
      appliedCostCents: priceCents,
    };
  }
  if (initialMode === "new_asset") {
    return { ...defaultWizardState, mode: "new_asset", step: 1 };
  }
  return defaultWizardState;
}

export function buildStateFromSearchResult(
  prev: InvestmentWizardState,
  res: TickerSearchResult,
  existingAssets: readonly PortfolioAsset[],
  forceNewAssetStep1 = false,
): InvestmentWizardState {
  const isCash = isCashAssetClass(res.assetClass);
  if (!forceNewAssetStep1 && res.isExisting && res.existingAssetId) {
    const asset = existingAssets.find((a) => a.id === res.existingAssetId) ?? null;
    return {
      ...prev,
      mode: "buy",
      step: 2,
      searchQuery: res.ticker,
      selectedAsset: asset,
      ticker: res.ticker,
      name: res.name,
      assetClass: res.assetClass,
      sector: res.sector ?? asset?.sector ?? "",
      currency: res.currency,
      isCash,
      appliedCostCents: numberToCents(resolveInitialUnitOrPositionCost(asset)),
    };
  }
  return {
    ...prev,
    mode: forceNewAssetStep1 ? prev.mode : "new_asset",
    step: 2,
    searchQuery: res.ticker,
    selectedAsset: forceNewAssetStep1 ? prev.selectedAsset : null,
    ticker: res.ticker,
    name: res.name,
    assetClass: res.assetClass,
    sector: res.sector ?? "",
    currency: res.currency,
    isCash,
  };
}

export function buildStateFromSuggestion(
  prev: InvestmentWizardState,
  item: AporteSuggestionItem,
  existingAssets: readonly PortfolioAsset[],
  positionRows: readonly { assetId: string; priceBRL?: number }[],
  cashAsset: PortfolioAsset | null,
): InvestmentWizardState {
  const asset = existingAssets.find((a) => a.id === item.assetId);
  const row = positionRows.find((r) => r.assetId === item.assetId);
  const priceBRL = row?.priceBRL ?? Number(asset?.average_price ?? 0);
  const isTotalValue =
    getAssetPricingMode(asset ?? { ticker: item.ticker, asset_class: item.assetClass, notes: null }) === "total_value" ||
    isFixedIncomeClass(item.assetClass) ||
    isTesouroAsset(item.ticker, item.assetClass);
  const cashAvailableBRL = cashAsset?.quantity ?? 0;

  if (isTotalValue) {
    const suggestedAmount =
      item.suggestedTotalBRL && item.suggestedTotalBRL > 0
        ? item.suggestedTotalBRL
        : cashAvailableBRL > 0
          ? Math.min(cashAvailableBRL, item.gapBRL)
          : item.gapBRL;
    const totalCents = Math.round(suggestedAmount * 100);
    return {
      ...prev,
      mode: "buy",
      step: 2,
      searchQuery: item.ticker,
      selectedAsset: asset ?? null,
      ticker: item.ticker,
      assetClass: item.assetClass,
      sector: item.sector ?? asset?.sector ?? "",
      currency: asset?.currency ?? "BRL",
      isCash: false,
      priceCents: totalCents,
      quantityStr: "",
      totalCents,
      syncCash: cashAvailableBRL > 0 && suggestedAmount > 0,
    };
  }

  const precision = resolveAssetPrecision({
    assetClass: item.assetClass,
    ticker: item.ticker,
    currency: (asset?.currency ?? "BRL") as "BRL" | "USD",
  });
  let suggestedQty = item.suggestedQty ?? 0;
  if (!(suggestedQty > 0) && cashAvailableBRL > 0 && priceBRL > 0) {
    const factor = precision > 0 ? 10 ** precision : 1;
    suggestedQty = Math.min(
      Math.floor((item.gapBRL / priceBRL) * factor) / factor,
      Math.floor((cashAvailableBRL / priceBRL) * factor) / factor,
    );
  }
  const priceCents = Math.round(priceBRL * 100);
  const totalCents = suggestedQty > 0 ? Math.round(suggestedQty * priceBRL * 100) : 0;
  const formattedQty =
    suggestedQty > 0 ? (precision > 0 ? parseFloat(suggestedQty.toFixed(precision)).toString() : String(suggestedQty)) : "";

  return {
    ...prev,
    mode: "buy",
    step: 2,
    searchQuery: item.ticker,
    selectedAsset: asset ?? null,
    ticker: item.ticker,
    assetClass: item.assetClass,
    sector: item.sector ?? asset?.sector ?? "",
    currency: asset?.currency ?? "BRL",
    isCash: false,
    priceCents,
    quantityStr: formattedQty,
    totalCents,
    syncCash: suggestedQty > 0,
    recordContribution: suggestedQty <= 0,
  };
}
