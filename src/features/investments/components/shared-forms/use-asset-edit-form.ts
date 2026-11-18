import { useRef, useState } from "react";
import { todayISO } from "@/domain/debts";
import { numberToCents, parseDecimalNumber } from "@/domain/money";
import { assetMetadataSchema } from "@/domain/portfolio/schemas";
import { inferSectorFromTicker } from "@/domain/portfolio/tickers-catalog";
import { isCashAssetClass, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import { getErrorMessage } from "@/services/errors";
import {
  useAssetPrices,
  useEmergencyFundComposition,
  useFamilyMode,
  useMyFamily,
  useSetManualPrice,
  useUpdatePortfolioAsset,
} from "@/state";
import type { AssetCurrency, FixedIncomeMetadata, FixedIncomeRateType, PortfolioAsset } from "@/types";
import { buildEmergencyConfigWithAssetToggle, isAssetInEmergencyConfig } from "../emergency-fund-sync";
import { CLASSES_WITH_EDITABLE_CURRENCY } from "./asset-form-constants";

export function useAssetEditForm(asset: PortfolioAsset, onClose: () => void) {
  const updateAsset = useUpdatePortfolioAsset();
  const pricesQuery = useAssetPrices();
  const setManualPrice = useSetManualPrice();
  const emergencyFund = useEmergencyFundComposition();
  const { isFamilyModeEnabled } = useFamilyMode();
  const { data: myFamilyData } = useMyFamily();
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isFamily, setIsFamily] = useState(Boolean(asset.is_family));
  const initialEmergencyIncluded = isAssetInEmergencyConfig({
    config: emergencyFund.config,
    assetId: asset.id,
    assetClass: asset.asset_class,
    isCash: isCashAssetClass(asset.asset_class),
  });
  const [isEmergencyFund, setIsEmergencyFund] = useState(initialEmergencyIncluded);
  const [ticker, setTicker] = useState(asset.ticker);
  const [assetClass, setAssetClass] = useState(asset.asset_class ?? "Ações");
  const [sector, setSector] = useState(asset.sector ?? inferSectorFromTicker(asset.ticker, asset.asset_class));
  const [currency, setCurrency] = useState<AssetCurrency>(asset.currency ?? "BRL");
  const [notes, setNotes] = useState(() =>
    asset.notes ? asset.notes.replace(/\[PRICING:(UNIT|TOTAL)\]/g, "").replace(/\[VALUATION:CUSTOM\]/g, "").trim() : "",
  );
  const [accumulatedDividendsCents, setAccumulatedDividendsCents] = useState(numberToCents(asset.accumulated_dividends ?? 0));
  const [estimatedDividendPerShareCents, setEstimatedDividendPerShareCents] = useState(
    numberToCents(asset.estimated_monthly_dividend_per_share ?? 0),
  );
  const [fixedIncomeRateType, setFixedIncomeRateType] = useState<FixedIncomeRateType>(asset.fixed_income_metadata?.rate_type ?? "cdi");
  const [fixedIncomeRateValue, setFixedIncomeRateValue] = useState<number>(asset.fixed_income_metadata?.rate_value ?? 0);
  const [fixedIncomeBaseDate, setFixedIncomeBaseDate] = useState<string>(asset.fixed_income_metadata?.base_date ?? todayISO());
  const [fixedIncomeInitialInvestmentDate, setFixedIncomeInitialInvestmentDate] = useState<string>(
    asset.fixed_income_metadata?.initial_investment_date ?? "",
  );
  const [fixedIncomeMaturityDate, setFixedIncomeMaturityDate] = useState<string>(asset.fixed_income_metadata?.maturity_date ?? "");
  const [fixedIncomeIsTaxExempt, setFixedIncomeIsTaxExempt] = useState<boolean>(Boolean(asset.fixed_income_metadata?.is_tax_exempt));
  const [fixedIncomeManualTaxRatePct, setFixedIncomeManualTaxRatePct] = useState<number | null>(
    asset.fixed_income_metadata?.manual_tax_rate_pct ?? null,
  );
  const [isCustomValuation, setIsCustomValuation] = useState<boolean>(
    Boolean(asset.notes?.includes("[VALUATION:CUSTOM]") || asset.notes?.includes("[PRICING:TOTAL]")),
  );
  const [error, setError] = useState<string | null>(null);

  const isCash = isCashAssetClass(assetClass) || ticker.trim().toUpperCase() === "CAIXA";
  const isTesouro = isTesouroAsset(ticker, assetClass);
  const isFixedIncome = isFixedIncomeClass(assetClass) || isTesouro;
  const isCrypto = assetClass === "Cripto";
  const isTotalValueMode = !isCash && (isFixedIncome || isCustomValuation);
  const isClosed = !isCash && asset.quantity <= 0;

  const priceQuote = (pricesQuery.data ?? []).find((p) => p.ticker.toUpperCase() === (asset.ticker ?? ticker).trim().toUpperCase());
  const existingInitialPrice =
    asset.fixed_income_metadata?.initial_investment_value && asset.fixed_income_metadata.initial_investment_value > 0
      ? asset.fixed_income_metadata.initial_investment_value
      : asset.average_price > 0
        ? asset.average_price
        : asset.quantity > 0
          ? asset.quantity
          : 0;
  const existingCurrentPrice = isClosed
    ? 0
    : asset.fixed_income_metadata?.base_value && asset.fixed_income_metadata.base_value > 0
      ? asset.fixed_income_metadata.base_value
      : (priceQuote?.manual_price ?? priceQuote?.price ?? existingInitialPrice);

  const [initialPriceCents, setInitialPriceCents] = useState(numberToCents(existingInitialPrice));
  const [currentPriceCents, setCurrentPriceCents] = useState(numberToCents(existingCurrentPrice));
  const [quantityStr, setQuantityStr] = useState(
    asset.quantity !== undefined && asset.quantity > 0 ? String(asset.quantity) : isCash ? String(asset.quantity ?? 0) : "",
  );
  const [averagePriceCents, setAveragePriceCents] = useState(asset.average_price !== undefined ? numberToCents(asset.average_price) : 0);

  const hasStoredDividends = (asset.accumulated_dividends ?? 0) > 0 || (asset.estimated_monthly_dividend_per_share ?? 0) > 0;
  const [distributesInterest, setDistributesInterest] = useState(isFixedIncome ? hasStoredDividends : false);

  const handleClassChange = (newClass: string) => {
    setAssetClass(newClass);
    setSector(inferSectorFromTicker(ticker, newClass));
    if (!CLASSES_WITH_EDITABLE_CURRENCY.has(newClass)) setCurrency("BRL");
    const upper = ticker.toUpperCase();
    if (upper.includes("LCI") || upper.includes("LCA") || upper.includes("CRI") || upper.includes("CRA")) {
      setFixedIncomeIsTaxExempt(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (updateAsset.isPending || setManualPrice.isPending || isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const parsedQuantity = parseDecimalNumber(quantityStr);
    const cleanNotes = notes.replace(/\[VALUATION:CUSTOM\]/g, "").replace(/\[PRICING:(UNIT|TOTAL)\]/g, "").trim();
    const finalNotes = [cleanNotes, isCustomValuation && !isFixedIncome ? "[VALUATION:CUSTOM]" : ""].filter(Boolean).join(" ") || null;
    const payloadQuantity = isCash ? parsedQuantity : isClosed ? 0 : isTotalValueMode ? 1 : Math.max(0, parsedQuantity);
    const payloadAvgPrice = isCash ? 1 : isClosed ? 0 : isTotalValueMode ? initialPriceCents / 100 : Math.max(0, averagePriceCents / 100);

    let fiMetadata: FixedIncomeMetadata | null = null;
    if (isFixedIncome && !isCash) {
      const existingFi = asset.fixed_income_metadata;
      const currentBalance = currentPriceCents > 0 ? currentPriceCents / 100 : initialPriceCents / 100;
      fiMetadata = {
        rate_type: fixedIncomeRateType,
        rate_value: fixedIncomeRateValue,
        base_date: fixedIncomeBaseDate || existingFi?.base_date || todayISO(),
        base_value: isClosed ? 0 : isTotalValueMode && currentBalance > 0 ? currentBalance : (existingFi?.base_value ?? null),
        initial_investment_value: initialPriceCents > 0 ? initialPriceCents / 100 : (existingFi?.initial_investment_value ?? null),
        initial_investment_date: fixedIncomeInitialInvestmentDate ? fixedIncomeInitialInvestmentDate.slice(0, 10) : (existingFi?.initial_investment_date ?? null),
        maturity_date: fixedIncomeMaturityDate ? fixedIncomeMaturityDate.slice(0, 10) : null,
        is_tax_exempt: fixedIncomeIsTaxExempt,
        manual_tax_rate_pct: fixedIncomeIsTaxExempt ? null : fixedIncomeManualTaxRatePct,
      };
    }

    const saveDividends = assetClass !== "Cripto" && assetClass !== "Caixa" && (!isFixedIncome || distributesInterest);
    const validation = assetMetadataSchema.safeParse({
      ticker,
      asset_class: assetClass,
      sector: sector.trim() || null,
      currency,
      quantity: payloadQuantity,
      average_price: payloadAvgPrice,
      accumulated_dividends: saveDividends ? accumulatedDividendsCents / 100 : 0,
      estimated_monthly_dividend_per_share: saveDividends ? estimatedDividendPerShareCents / 100 : 0,
      fixed_income_metadata: fiMetadata,
      notes: finalNotes,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Dados inválidos");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    try {
      const effectiveFamily = isFamilyModeEnabled ? isFamily : Boolean(asset.is_family);
      await updateAsset.mutateAsync({
        id: asset.id,
        patch: {
          ...validation.data,
          review_frequency_months: validation.data.review_frequency_months ?? undefined,
          is_family: effectiveFamily,
          family_id: effectiveFamily ? (myFamilyData?.family?.id ?? asset.family_id ?? null) : null,
        },
      });
      if (isTotalValueMode) {
        const priceToSave = currentPriceCents > 0 ? currentPriceCents / 100 : initialPriceCents / 100;
        if (priceToSave > 0) await setManualPrice.mutateAsync({ ticker: validation.data.ticker, price: priceToSave });
      }
      if (isFixedIncome && !isCash && isEmergencyFund !== initialEmergencyIncluded) {
        const nextConfig = buildEmergencyConfigWithAssetToggle({
          config: emergencyFund.config,
          portfolioRows: emergencyFund.portfolioRows,
          breakdownAssetIds: emergencyFund.composition.breakdown.filter((b) => b.type === "asset").map((b) => b.id),
          assetId: asset.id,
          include: isEmergencyFund,
        });
        await emergencyFund.updateConfig(nextConfig);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    isFamilyModeEnabled, isFamily, setIsFamily, isEmergencyFund, setIsEmergencyFund, ticker, setTicker,
    assetClass, handleClassChange, sector, setSector, currency, setCurrency, notes, setNotes,
    accumulatedDividendsCents, setAccumulatedDividendsCents, estimatedDividendPerShareCents,
    setEstimatedDividendPerShareCents, fixedIncomeRateType, setFixedIncomeRateType, fixedIncomeRateValue,
    setFixedIncomeRateValue, fixedIncomeBaseDate, setFixedIncomeBaseDate, fixedIncomeInitialInvestmentDate,
    setFixedIncomeInitialInvestmentDate, fixedIncomeMaturityDate, setFixedIncomeMaturityDate,
    fixedIncomeIsTaxExempt, setFixedIncomeIsTaxExempt, fixedIncomeManualTaxRatePct,
    setFixedIncomeManualTaxRatePct, isCustomValuation, setIsCustomValuation, error, isCash, isTesouro,
    isFixedIncome, isCrypto, isTotalValueMode, isClosed, initialPriceCents, setInitialPriceCents,
    currentPriceCents, setCurrentPriceCents, quantityStr, setQuantityStr, averagePriceCents,
    setAveragePriceCents, distributesInterest, setDistributesInterest,
    isBusy: updateAsset.isPending || setManualPrice.isPending || isSubmitting, handleSubmit,
  };
}
