/**
 * Cálculos puros de ordens, câmbio USD, preço médio, eventos corporativos
 * e prévias financeiras do InvestmentWizard e QuickTransactionSheet.
 *
 * Módulo puro — sem dependência de UI, React ou Supabase.
 */

import { parseDecimalNumber } from "@/domain/money/parse";
import type { AssetCurrency, PortfolioAsset } from "@/types";
import { resolveAssetPrecision } from "./aporte";
import { sellAssetPosition } from "./operations";
import { calculateWeightedAveragePrice } from "./summary";
import {
  FALLBACK_USD_RATE,
  getAssetPricingMode,
  isCashAssetClass,
  isFixedIncomeClass,
  isTesouroAsset,
  type AssetPricingMode,
} from "./valuation";
import { calculateFixedIncomeRedemptionPreview } from "./fixed-income-redemption-preview";

export type OrderWizardMode =
  | "select"
  | "new_asset"
  | "buy"
  | "sell"
  | "dividend"
  | "split"
  | "reverse_split"
  | "existing_aporte";

export type DividendCalculationMode = "total" | "per_share";

export interface AssetValuationClassification {
  isCash: boolean;
  isTesouro: boolean;
  isFixedIncome: boolean;
  isTotalValue: boolean;
  pricingMode: AssetPricingMode;
}

export interface WizardOrderPreviewInput {
  mode: OrderWizardMode;
  selectedAsset: PortfolioAsset | null;
  ticker: string;
  assetClass: string;
  currency: AssetCurrency;
  isCash: boolean;
  notes: string;
  quantityStr: string;
  priceCents: number;
  totalCents: number;
  date: string;
  splitFactor: number;
  reverseSplitFactor: number;
  splitFromStr?: string;
  splitToStr?: string;
  dividendCalcMode?: DividendCalculationMode;
  perShareCents?: number;
  appliedCostCents: number;
  customTaxRatePct?: number | null;
  customTaxAmountCents?: number | null;
  syncCash: boolean;
  recordContribution: boolean;
}

export interface InvestmentPreviewResult {
  currentQuantity: number;
  currentAveragePrice: number;
  newQuantity: number;
  newAveragePrice: number;
  remainingGrossValue?: number;
  remainingCostBasis?: number;
  totalOrderValueNative?: number;
  totalOrderValueBRL: number;
  cashDebitBRL: number;
  cashCreditBRL?: number;
  contributionBRL: number;
  realizedPnl?: number;
  realizedPnlPct?: number;
  taxAmountBRL?: number;
  taxRatePct?: number;
  iofAmountBRL?: number;
  isTaxCustomized?: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Centraliza a resolução da cotação USD/BRL a partir das linhas de posição,
 * eliminando fallbacks hardcoded espalhados pelos componentes.
 */
export function resolvePortfolioUsdRate(
  rows: readonly { currency?: string | null; usdRate?: number | null }[],
  fallback: number = FALLBACK_USD_RATE,
): number {
  const usdRow = rows.find(
    (r) =>
      r.currency === "USD" &&
      r.usdRate !== undefined &&
      r.usdRate !== null &&
      Number.isFinite(r.usdRate) &&
      r.usdRate > 0,
  );
  if (usdRow?.usdRate) return usdRow.usdRate;

  const anyRowWithRate = rows.find(
    (r) =>
      r.usdRate !== undefined &&
      r.usdRate !== null &&
      Number.isFinite(r.usdRate) &&
      r.usdRate > 0,
  );
  return anyRowWithRate?.usdRate ?? fallback;
}

/**
 * Retorna o multiplicador cambial para conversão em BRL (1 para BRL, taxa USD para USD).
 */
export function resolveUsdMultiplier(currency: AssetCurrency, usdRate?: number | null): number {
  if (currency !== "USD") return 1;
  return usdRate !== undefined && usdRate !== null && Number.isFinite(usdRate) && usdRate > 0
    ? usdRate
    : FALLBACK_USD_RATE;
}

/**
 * Converte um valor na moeda nativa do ativo para BRL arredondado em 2 casas decimais.
 */
export function convertOrderAmountToBRL(
  amountNative: number,
  currency: AssetCurrency,
  usdRate?: number | null,
): number {
  return round2(amountNative * resolveUsdMultiplier(currency, usdRate));
}

/**
 * Resolve o preço unitário ou custo inicial de referência ao pré-carregar um ativo.
 */
export function resolveInitialUnitOrPositionCost(asset: PortfolioAsset | null | undefined): number {
  if (!asset) return 0;
  const metaInitial = asset.fixed_income_metadata?.initial_investment_value;
  if (metaInitial !== undefined && metaInitial !== null && metaInitial > 0) {
    return metaInitial;
  }
  if (asset.average_price !== undefined && asset.average_price > 0) {
    return asset.average_price;
  }
  return asset.fixed_income_metadata?.base_value ?? 0;
}

/**
 * Classifica o modo de precificação e natureza de custódia do ativo/rascunho.
 */
export function classifyAssetValuation(input: {
  selectedAsset?: PortfolioAsset | null;
  ticker: string;
  assetClass: string;
  notes?: string | null;
  isCash?: boolean;
}): AssetValuationClassification {
  const ticker = input.selectedAsset?.ticker ?? input.ticker;
  const assetClass = input.selectedAsset?.asset_class ?? input.assetClass;
  const notes = input.selectedAsset?.notes ?? input.notes ?? null;
  const isCash = Boolean(input.isCash) || isCashAssetClass(assetClass);
  const isTesouro = isTesouroAsset(ticker, assetClass);
  const isFixedIncome = isFixedIncomeClass(assetClass) || isTesouro;
  const pricingMode = getAssetPricingMode(
    input.selectedAsset ?? { ticker, asset_class: assetClass, notes },
  );
  const isTotalValue = !isCash && (pricingMode === "total_value" || (isFixedIncome && !isTesouro) || isFixedIncome);

  return {
    isCash,
    isTesouro,
    isFixedIncome,
    isTotalValue,
    pricingMode,
  };
}

/**
 * Calcula o fator multiplicador/divisor de desdobro (`split`) ou grupamento (`reverse_split`)
 * a partir da proporção livre `De (X) para Para (Y)`.
 */
export function computeCorporateEventFactor(
  mode: "split" | "reverse_split",
  splitFrom: number,
  splitTo: number,
): number {
  if (!Number.isFinite(splitFrom) || !Number.isFinite(splitTo) || splitFrom <= 0 || splitTo <= 0) {
    return 0;
  }
  return mode === "split" ? splitTo / splitFrom : splitFrom / splitTo;
}

export interface CorporateEventPreviewResult {
  factor: number;
  newQuantity: number;
  newAveragePrice: number;
  isValid: boolean;
}

/**
 * Calcula a nova quantidade e novo preço médio após split/reverse_split preservando custo total.
 */
export function computeCorporateEventPreview(
  currentQuantity: number,
  currentAveragePrice: number,
  mode: "split" | "reverse_split",
  factor: number,
): CorporateEventPreviewResult {
  if (!Number.isFinite(factor) || factor <= 1) {
    return {
      factor: Number.isFinite(factor) ? factor : 0,
      newQuantity: currentQuantity,
      newAveragePrice: currentAveragePrice,
      isValid: false,
    };
  }
  const newQuantity =
    mode === "split"
      ? Math.round(currentQuantity * factor * 10000) / 10000
      : Math.round((currentQuantity / factor) * 10000) / 10000;
  const newAveragePrice =
    mode === "split" ? currentAveragePrice / factor : currentAveragePrice * factor;

  return {
    factor,
    newQuantity,
    newAveragePrice,
    isValid: true,
  };
}

/**
 * Resolve o fator efetivo de split/grupamento a partir dos campos X:Y ou fator legado.
 */
export function resolveEffectiveSplitFactor(input: {
  mode: "split" | "reverse_split";
  splitFactor: number;
  reverseSplitFactor: number;
  splitFromStr?: string;
  splitToStr?: string;
}): number {
  const fromStr = (input.splitFromStr ?? "").trim();
  const toStr = (input.splitToStr ?? "").trim();
  if (fromStr.length > 0 && toStr.length > 0) {
    const fromVal = parseDecimalNumber(fromStr);
    const toVal = parseDecimalNumber(toStr);
    return computeCorporateEventFactor(input.mode, fromVal, toVal);
  }
  return input.mode === "split" ? input.splitFactor : input.reverseSplitFactor;
}

/**
 * Calcula o valor total do provento em moeda nativa considerando modo Total vs Por Cota.
 */
export function computeDividendTotalFromMode(input: {
  calcMode: DividendCalculationMode;
  totalCents: number;
  perShareCents: number;
  custodyQty: number;
  isTotalValue?: boolean;
}): number {
  if (input.calcMode === "per_share" && !input.isTotalValue) {
    const safeQty = Math.max(0, input.custodyQty);
    return round2((Math.max(0, input.perShareCents) / 100) * safeQty);
  }
  return round2(Math.max(0, input.totalCents) / 100);
}

/**
 * Calcula a prévia financeira completa de uma operação (PM, P&L, IRRF, IOF, caixa e aporte).
 */
export function calculateWizardOrderPreview(
  state: WizardOrderPreviewInput,
  cashAvailableBRL = 0,
  usdRate = FALLBACK_USD_RATE,
): InvestmentPreviewResult {
  const parsedQty = parseDecimalNumber(state.quantityStr);
  const inputPrice = state.priceCents / 100;
  const inputTotal = state.totalCents / 100;

  const currentQty = state.selectedAsset?.quantity ?? 0;
  const currentAvgPrice = state.selectedAsset?.average_price ?? 0;

  const { isCash, isTotalValue } = classifyAssetValuation({
    selectedAsset: state.selectedAsset,
    ticker: state.ticker,
    assetClass: state.assetClass,
    notes: state.notes,
    isCash: state.isCash,
  });

  if (isCash) {
    const amount = inputTotal > 0 ? inputTotal : parsedQty;
    return {
      currentQuantity: currentQty,
      currentAveragePrice: 1,
      newQuantity: currentQty + amount,
      newAveragePrice: 1,
      totalOrderValueNative: amount,
      totalOrderValueBRL: amount,
      cashDebitBRL: 0,
      contributionBRL: amount,
    };
  }

  if (isTotalValue) {
    const amountNative = inputTotal > 0 ? inputTotal : inputPrice;
    const amountBRL = convertOrderAmountToBRL(amountNative, state.currency, usdRate);

    if (state.mode === "sell") {
      const redemption = calculateFixedIncomeRedemptionPreview({
        asset: state.selectedAsset,
        withdrawGross: amountNative,
        date: state.date,
        appliedCostOverride: state.appliedCostCents > 0 ? state.appliedCostCents / 100 : null,
        customTaxRatePct: state.customTaxRatePct,
        customTaxAmount:
          state.customTaxAmountCents !== null && state.customTaxAmountCents !== undefined
            ? state.customTaxAmountCents / 100
            : null,
      });

      if (!redemption) {
        return {
          currentQuantity: 1,
          currentAveragePrice: currentAvgPrice,
          newQuantity: 1,
          newAveragePrice: currentAvgPrice,
          totalOrderValueNative: 0,
          totalOrderValueBRL: 0,
          cashDebitBRL: 0,
          cashCreditBRL: 0,
          contributionBRL: 0,
        };
      }

      const netCreditBRL = convertOrderAmountToBRL(redemption.netCredit, state.currency, usdRate);

      return {
        currentQuantity: 1,
        currentAveragePrice: currentAvgPrice,
        newQuantity: redemption.isFullRedemption ? 0 : 1,
        newAveragePrice: redemption.remainingCostBasis,
        remainingGrossValue: redemption.remainingGrossBalance,
        remainingCostBasis: redemption.remainingCostBasis,
        totalOrderValueNative: amountNative,
        totalOrderValueBRL: amountBRL,
        cashDebitBRL: 0,
        cashCreditBRL: state.syncCash ? netCreditBRL : 0,
        contributionBRL: 0,
        realizedPnl: redemption.realizedProfit,
        realizedPnlPct: redemption.realizedProfitPct,
        taxAmountBRL: redemption.taxAmount,
        taxRatePct: redemption.taxRatePct,
        iofAmountBRL: redemption.iofAmount,
        isTaxCustomized: redemption.isCustomized,
      };
    }

    let cashDebitBRL = 0;
    let contributionBRL = amountBRL;
    if (state.syncCash && cashAvailableBRL > 0) {
      cashDebitBRL = Math.min(cashAvailableBRL, amountBRL);
      contributionBRL = Math.max(0, amountBRL - cashDebitBRL);
    }
    return {
      currentQuantity: 1,
      currentAveragePrice: currentAvgPrice,
      newQuantity: 1,
      newAveragePrice: currentAvgPrice + amountNative,
      totalOrderValueNative: amountNative,
      totalOrderValueBRL: amountBRL,
      cashDebitBRL: round2(cashDebitBRL),
      contributionBRL: round2(contributionBRL),
    };
  }

  if (state.mode === "sell") {
    const sellRes = sellAssetPosition({
      currentQuantity: currentQty,
      currentAveragePrice: currentAvgPrice,
      sellQuantity: parsedQty,
      sellPrice: inputPrice,
      assetClass: state.assetClass,
    });
    const orderTotalNative = parsedQty * inputPrice;
    const orderTotalBRL = convertOrderAmountToBRL(orderTotalNative, state.currency, usdRate);
    return {
      currentQuantity: currentQty,
      currentAveragePrice: currentAvgPrice,
      newQuantity: sellRes.remainingQuantity,
      newAveragePrice: sellRes.remainingAveragePrice,
      totalOrderValueNative: round2(orderTotalNative),
      totalOrderValueBRL: orderTotalBRL,
      cashDebitBRL: 0,
      cashCreditBRL: state.syncCash ? orderTotalBRL : 0,
      contributionBRL: 0,
      realizedPnl: sellRes.realizedPnl,
      realizedPnlPct: sellRes.realizedPnlPct,
    };
  }

  if (state.mode === "dividend") {
    const dividendNative = computeDividendTotalFromMode({
      calcMode: state.dividendCalcMode ?? "total",
      totalCents: state.totalCents,
      perShareCents: state.perShareCents ?? 0,
      custodyQty: currentQty,
      isTotalValue: false,
    });
    const dividendBRL = convertOrderAmountToBRL(dividendNative, state.currency, usdRate);
    return {
      currentQuantity: currentQty,
      currentAveragePrice: currentAvgPrice,
      newQuantity: currentQty,
      newAveragePrice: currentAvgPrice,
      totalOrderValueNative: dividendNative,
      totalOrderValueBRL: dividendBRL,
      cashDebitBRL: 0,
      cashCreditBRL: state.syncCash ? dividendBRL : 0,
      contributionBRL: 0,
    };
  }

  if (state.mode === "split" || state.mode === "reverse_split") {
    const effectiveFactor = resolveEffectiveSplitFactor({
      mode: state.mode,
      splitFactor: state.splitFactor,
      reverseSplitFactor: state.reverseSplitFactor,
      splitFromStr: state.splitFromStr,
      splitToStr: state.splitToStr,
    });
    const safeFactor = effectiveFactor > 0 ? effectiveFactor : 1;
    const eventPreview = computeCorporateEventPreview(
      currentQty,
      currentAvgPrice,
      state.mode,
      safeFactor,
    );
    return {
      currentQuantity: currentQty,
      currentAveragePrice: currentAvgPrice,
      newQuantity: eventPreview.isValid ? eventPreview.newQuantity : currentQty,
      newAveragePrice: eventPreview.isValid ? eventPreview.newAveragePrice : currentAvgPrice,
      totalOrderValueNative: 0,
      totalOrderValueBRL: 0,
      cashDebitBRL: 0,
      contributionBRL: 0,
    };
  }

  const orderPrice =
    inputPrice > 0 ? inputPrice : parsedQty > 0 && inputTotal > 0 ? inputTotal / parsedQty : 0;
  const orderTotalNative = parsedQty * orderPrice;
  const orderTotalBRL = convertOrderAmountToBRL(orderTotalNative, state.currency, usdRate);

  const lot = calculateWeightedAveragePrice(currentQty, currentAvgPrice, parsedQty, orderPrice);
  let cashDebitBRL = 0;
  let contributionBRL = orderTotalBRL;

  if (state.syncCash && cashAvailableBRL > 0) {
    cashDebitBRL = Math.min(cashAvailableBRL, orderTotalBRL);
    contributionBRL = Math.max(0, orderTotalBRL - cashDebitBRL);
  }

  return {
    currentQuantity: currentQty,
    currentAveragePrice: currentAvgPrice,
    newQuantity: lot.newQuantity,
    newAveragePrice: lot.newAveragePrice,
    totalOrderValueNative: round2(orderTotalNative),
    totalOrderValueBRL: orderTotalBRL,
    cashDebitBRL: round2(cashDebitBRL),
    cashCreditBRL: 0,
    contributionBRL: state.recordContribution ? round2(contributionBRL) : 0,
  };
}

export interface CashFitSummaryInput {
  gapBRL: number;
  assetClass: string;
  ticker: string;
  currency?: AssetCurrency | null;
  priceBRL: number;
  isTotalValue: boolean;
  cashAvailableBRL: number;
}

export interface CashFitSummary {
  text: string;
  fits: boolean;
  costBRL?: number;
}

/**
 * Calcula se o saldo disponível em caixa comporta ao menos parte do aporte sugerido.
 */
export function computeCashFitSummary({
  gapBRL,
  assetClass,
  ticker,
  currency,
  priceBRL,
  isTotalValue,
  cashAvailableBRL,
}: CashFitSummaryInput): CashFitSummary | null {
  if (cashAvailableBRL <= 0) return null;
  if (isTotalValue) {
    return { text: "Cabe no caixa: ", costBRL: Math.min(cashAvailableBRL, gapBRL), fits: true };
  }
  if (priceBRL <= 0) return null;
  const precision = resolveAssetPrecision({
    assetClass,
    ticker,
    currency: currency ?? "BRL",
  });
  const factor = precision > 0 ? 10 ** precision : 1;
  const maxUseful = Math.floor((gapBRL / priceBRL) * factor) / factor;
  const cashQty = Math.floor((cashAvailableBRL / priceBRL) * factor) / factor;
  const sharesFit = Math.min(maxUseful, cashQty);
  if (sharesFit > 0) {
    const qtyText = precision > 0 ? parseFloat(sharesFit.toFixed(precision)) : sharesFit;
    return {
      text: `Cabe no caixa: ${qtyText} cota${sharesFit > 1 ? "s" : ""} (~`,
      costBRL: sharesFit * priceBRL,
      fits: true,
    };
  }
  return {
    text: precision > 0 ? "Saldo em caixa insuficiente para aporte" : "Saldo em caixa insuficiente para 1 cota",
    fits: false,
  };
}
