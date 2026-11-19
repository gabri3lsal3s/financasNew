import { useEffect, useMemo, useRef, useState } from "react";
import { todayISO } from "@/domain/debts";
import { formatDecimalNumber, numberToCents, parseDecimalNumber } from "@/domain/money";
import { fetchPtaxForDate } from "@/services/quotes";
import {
  calculateFixedIncomeRedemptionPreview,
  calculateWeightedAveragePrice,
  classifyAssetValuation,
  computeCorporateEventFactor,
  computeDividendTotalFromMode,
  convertOrderAmountToBRL,
  getFixedIncomeCurrentGrossBalance,
  resolveFixedIncomeAppliedCost,
  resolvePortfolioUsdRate,
  sellAssetPosition,
  type DividendCalculationMode,
} from "@/domain/portfolio";
import type { DividendEntryMode } from "@/domain/portfolio/dividends";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import { currentMonth } from "@/lib/date";
import {
  usePortfolioAssets,
  usePortfolioPosition,
  useRecordOrder,
  useUpdatePortfolioDividend,
  useUpdatePortfolioTransaction,
} from "@/state";
import type { PortfolioAsset, PortfolioDividend, PortfolioTransaction, PortfolioTransactionType } from "@/types";
import type { FundingSource } from "../funding-source-utils";
import { executeQuickTransactionSubmit, validateQuickTransactionInput } from "./quick-transaction-submit";

export interface UseQuickTransactionFormParams {
  asset?: PortfolioAsset | null;
  initialType?: PortfolioTransactionType;
  editTransaction?: PortfolioTransaction | null;
  editDividend?: PortfolioDividend | null;
  onCloseComplete: () => void;
  onSuccess?: () => void;
}

export function useQuickTransactionForm({
  asset = null,
  initialType = "buy",
  editTransaction = null,
  editDividend = null,
  onCloseComplete,
  onSuccess,
}: UseQuickTransactionFormParams) {
  const assetsQuery = usePortfolioAssets();
  const recordOrder = useRecordOrder();
  const updateTx = useUpdatePortfolioTransaction();
  const updateDividend = useUpdatePortfolioDividend();
  const position = usePortfolioPosition();
  const usdRate = resolvePortfolioUsdRate(position.rows);

  const isEditingTransaction = Boolean(editTransaction);
  const isEditingDividend = Boolean(editDividend);
  const isEditMode = isEditingTransaction || isEditingDividend;

  const allAssets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const cashAsset = useMemo(
    () => allAssets.find((a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA") ?? null,
    [allAssets],
  );

  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    () => editTransaction?.asset_id ?? editDividend?.asset_id ?? asset?.id ?? allAssets.find((a) => !isCashAssetClass(a.asset_class))?.id ?? allAssets[0]?.id ?? "",
  );
  const [type, setType] = useState<PortfolioTransactionType>(() =>
    editDividend ? "dividend" : editTransaction ? editTransaction.type : initialType,
  );
  const [date, setDate] = useState(() =>
    editDividend ? editDividend.date.slice(0, 10) : editTransaction ? editTransaction.date.slice(0, 10) : todayISO(),
  );
  const [month, setMonth] = useState(() => (editDividend ? editDividend.date.slice(0, 7) : currentMonth()));
  const [dividendEntryMode, setDividendEntryMode] = useState<DividendEntryMode>(() =>
    editDividend?.notes?.includes("[MENSAL]") ? "monthly" : "daily",
  );
  const [dividendCalcMode, setDividendCalcMode] = useState<DividendCalculationMode>("total");
  const [perShareCents, setPerShareCents] = useState(0);
  const [quantityStr, setQuantityStr] = useState(() =>
    editTransaction && editTransaction.type !== "split" && editTransaction.type !== "reverse_split"
      ? formatDecimalNumber(editTransaction.quantity)
      : "",
  );
  const [priceCents, setPriceCents] = useState(() =>
    editTransaction && editTransaction.type !== "split" && editTransaction.type !== "reverse_split" ? numberToCents(editTransaction.price) : 0,
  );
  const [totalCents, setTotalCents] = useState(() =>
    editDividend ? numberToCents(editDividend.amount) : editTransaction ? numberToCents(editTransaction.total) : 0,
  );
  const [buyFundingSource, setBuyFundingSource] = useState<FundingSource>("pocket");
  const [creditCash, setCreditCash] = useState<boolean>(() => (editDividend ? Boolean(editDividend.sync_cash) : true));
  const [recordWithdrawal, setRecordWithdrawal] = useState<boolean>(true);
  const [splitFromStr, setSplitFromStr] = useState<string>(() =>
    editTransaction?.type === "reverse_split" ? String(editTransaction.quantity) : initialType === "reverse_split" ? "2" : "1",
  );
  const [splitToStr, setSplitToStr] = useState<string>(() =>
    editTransaction?.type === "split" ? String(editTransaction.quantity) : initialType === "reverse_split" ? "1" : "2",
  );
  const [error, setError] = useState<string | null>(null);
  const [customAppliedCostCents, setCustomAppliedCostCents] = useState<number | null>(null);
  const [customTaxRatePct, setCustomTaxRatePct] = useState<number | null>(null);
  const [customTaxAmountCents, setCustomTaxAmountCents] = useState<number | null>(null);
  const [customInitialDate, setCustomInitialDate] = useState<string | null>(null);
  const [fxRateBRL, setFxRateBRL] = useState<number | null>(() => editTransaction?.fx_rate ?? null);
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetAsset = useMemo(
    () => asset ?? allAssets.find((a) => a.id === selectedAssetId) ?? null,
    [asset, selectedAssetId, allAssets],
  );
  const appliedCostCents = customAppliedCostCents !== null ? customAppliedCostCents : numberToCents(resolveFixedIncomeAppliedCost(targetAsset));
  const valuation = useMemo(
    () => classifyAssetValuation({ selectedAsset: targetAsset, ticker: targetAsset?.ticker ?? "", assetClass: targetAsset?.asset_class ?? "", notes: targetAsset?.notes }),
    [targetAsset],
  );
  const parsedQty = parseDecimalNumber(quantityStr);
  const isDividendType = type === "dividend" || type === "jcp" || type === "fii_yield";
  const isCorporateEvent = type === "split" || type === "reverse_split";
  const computedEventFactor = useMemo(
    () => isCorporateEvent ? computeCorporateEventFactor(type, parseDecimalNumber(splitFromStr), parseDecimalNumber(splitToStr)) : 0,
    [isCorporateEvent, type, splitFromStr, splitToStr],
  );
  useEffect(() => {
    if (targetAsset?.currency !== "BRL" && !editTransaction) {
      void fetchPtaxForDate(date).then((rate) => {
        if (rate && !fxRateBRL) {
          setFxRateBRL(rate);
        }
      });
    }
  }, [date, targetAsset?.currency, editTransaction, fxRateBRL]);

  const custodyQty = Math.max(0, targetAsset?.quantity ?? 0);
  const effectiveDividendTotalBRL = useMemo(
    () => computeDividendTotalFromMode({ calcMode: dividendCalcMode, totalCents, perShareCents, custodyQty, isTotalValue: valuation.isTotalValue }),
    [dividendCalcMode, valuation.isTotalValue, perShareCents, custodyQty, totalCents],
  );
  const currentOrderTotalBRL = useMemo(() => {
    const currency = targetAsset?.currency ?? "BRL";
    const effectiveRate = fxRateBRL && fxRateBRL > 0 ? fxRateBRL : usdRate;
    if (valuation.isCash) return totalCents / 100;
    if (valuation.isTotalValue) return convertOrderAmountToBRL((totalCents || priceCents) / 100, currency, effectiveRate);
    if (isDividendType) return convertOrderAmountToBRL(effectiveDividendTotalBRL, currency, effectiveRate);
    return convertOrderAmountToBRL(parsedQty * (priceCents / 100), currency, effectiveRate);
  }, [valuation.isCash, valuation.isTotalValue, isDividendType, totalCents, priceCents, effectiveDividendTotalBRL, parsedQty, targetAsset, usdRate, fxRateBRL]);

  const buyPreview = useMemo(() => {
    if (!targetAsset || valuation.isCash || valuation.isTotalValue || parsedQty <= 0 || priceCents <= 0) return null;
    const calc = calculateWeightedAveragePrice(targetAsset.quantity, targetAsset.average_price, parsedQty, priceCents / 100);
    const nativeTotal = Math.round(parsedQty * (priceCents / 100) * 100) / 100;
    return {
      currentAveragePrice: targetAsset.average_price,
      newAveragePrice: calc.newAveragePrice,
      totalOrderValueNative: nativeTotal,
      totalOrderValueBRL: convertOrderAmountToBRL(nativeTotal, targetAsset.currency ?? "BRL", usdRate),
    };
  }, [targetAsset, valuation.isCash, valuation.isTotalValue, parsedQty, priceCents, usdRate]);

  const sellVariablePreview = useMemo(() => {
    if (!targetAsset || valuation.isCash || valuation.isTotalValue || parsedQty <= 0 || priceCents <= 0) return null;
    const res = sellAssetPosition({ currentQuantity: targetAsset.quantity, currentAveragePrice: targetAsset.average_price, sellQuantity: parsedQty, sellPrice: priceCents / 100, assetClass: targetAsset.asset_class });
    return { realizedPnl: res.realizedPnl, realizedPnlPct: res.realizedPnlPct, showActionExemptionNote: targetAsset.asset_class === "Ações" };
  }, [targetAsset, valuation.isCash, valuation.isTotalValue, parsedQty, priceCents]);

  const currentGrossBalance = useMemo(() => getFixedIncomeCurrentGrossBalance(targetAsset, date), [targetAsset, date]);
  const fiSellResult = useMemo(() => {
    if (type !== "sell" || !targetAsset?.fixed_income_metadata || (totalCents <= 0 && priceCents <= 0)) return null;
    return calculateFixedIncomeRedemptionPreview({
      asset: targetAsset,
      withdrawGross: (totalCents || priceCents) / 100,
      date,
      appliedCostOverride: appliedCostCents > 0 ? appliedCostCents / 100 : null,
      customTaxRatePct,
      customTaxAmount: customTaxAmountCents !== null ? customTaxAmountCents / 100 : null,
      customInitialDate,
    });
  }, [type, targetAsset, totalCents, priceCents, appliedCostCents, date, customTaxRatePct, customTaxAmountCents, customInitialDate]);

  const isBusy = recordOrder.isPending || updateTx.isPending || updateDividend.isPending || isSubmitting;

  const resetOnClose = () => {
    setError(null);
    setCustomTaxRatePct(null);
    setCustomTaxAmountCents(null);
    setCustomInitialDate(null);
    setRecordWithdrawal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAsset || isBusy || isSubmittingRef.current) return;
    const payload = {
      targetAsset, cashAsset, type, date, month, dividendEntryMode, parsedQty, priceCents, totalCents,
      effectiveDividendTotalBRL, isCash: valuation.isCash, isTotalValue: valuation.isTotalValue,
      isDividendType, isCorporateEvent, computedEventFactor, buyFundingSource, creditCash,
      recordWithdrawal, customInitialDate, usdRate,
      fxRateBRL, appliedCostCents, fiSellResult, editDividend, editTransaction,
      recordOrder: recordOrder.mutateAsync, updateTx: updateTx.mutateAsync, updateDividend: updateDividend.mutateAsync,
    };
    const check = validateQuickTransactionInput(payload);
    if (check.error) {
      setError(check.error);
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    const submitError = await executeQuickTransactionSubmit(payload, check.total, check.price);
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    if (submitError) {
      setError(submitError);
    } else {
      onCloseComplete();
      onSuccess?.();
    }
  };

  return {
    allAssets, cashAsset, targetAsset, selectedAssetId, setSelectedAssetId, type, setType,
    date, setDate, month, setMonth, dividendEntryMode, setDividendEntryMode, dividendCalcMode,
    setDividendCalcMode, perShareCents, setPerShareCents, quantityStr, setQuantityStr, priceCents,
    setPriceCents, totalCents, setTotalCents, buyFundingSource, setBuyFundingSource, creditCash,
    setCreditCash, recordWithdrawal, setRecordWithdrawal, splitFromStr, setSplitFromStr, splitToStr, setSplitToStr, error, setError,
    appliedCostCents, setCustomAppliedCostCents, customTaxRatePct, setCustomTaxRatePct,
    customTaxAmountCents, setCustomTaxAmountCents, customInitialDate, setCustomInitialDate, fxRateBRL, setFxRateBRL, isEditMode, isEditingTransaction, isEditingDividend,
    ...valuation, isDividendType, isCorporateEvent, custodyQty, currentOrderTotalBRL, buyPreview,
    sellVariablePreview, currentGrossBalance, fiSellResult, isBusy, resetOnClose, handleSubmit,
  };
}
