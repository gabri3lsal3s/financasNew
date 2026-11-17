import { useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, GitFork, Info, Receipt, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DatePicker,
  Modal,
  ModalFooter,
  MoneyInput,
  NumericInput,
  Select,
} from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { MonthPicker } from "@/components/modules";
import { todayISO } from "@/domain/debts";
import { currentMonth } from "@/lib/date";
import { numberToCents, parseDecimalNumber } from "@/domain/money";
import { calculateWeightedAveragePrice } from "@/domain/portfolio/summary";
import { sellAssetPosition } from "@/domain/portfolio/operations";
import { calculateFixedIncomeBalance } from "@/domain/portfolio/fixed-income";
import { resolveDividendDate, resolveDividendNote, type DividendEntryMode } from "@/domain/portfolio/dividends";
import {
  getAssetPricingMode,
  isCashAssetClass,
  isFixedIncomeClass,
  isTesouroAsset,
} from "@/domain/portfolio/valuation";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsBRL, formatPercent } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  usePortfolioAssets,
  usePortfolioPosition,
  useRecordOrder,
  useUpdatePortfolioDividend,
  useUpdatePortfolioTransaction,
} from "@/state";
import type {
  PortfolioAsset,
  PortfolioDividend,
  PortfolioTransaction,
  PortfolioTransactionType,
} from "@/types";
import { FundingSourceSelector } from "./funding-source-selector";
import { flagsFromFundingSource, type FundingSource } from "./funding-source-utils";

export interface QuickTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: PortfolioAsset | null;
  initialType?: PortfolioTransactionType;
  editTransaction?: PortfolioTransaction | null;
  editDividend?: PortfolioDividend | null;
  onClose?: () => void;
  onSuccess?: () => void;
}

const parseNumber = parseDecimalNumber;
const QUICK_TX_FORM_ID = "quick-transaction-form";

function QuickTransactionSheetContent({
  open,
  onOpenChange,
  asset = null,
  initialType = "buy",
  editTransaction = null,
  editDividend = null,
  onClose,
  onSuccess,
}: QuickTransactionSheetProps) {
  const assetsQuery = usePortfolioAssets();
  const recordOrder = useRecordOrder();
  const updateTx = useUpdatePortfolioTransaction();
  const updateDividend = useUpdatePortfolioDividend();
  const position = usePortfolioPosition();
  const usdRate = position.rows.find((r) => r.currency === "USD")?.usdRate ?? 5.25;

  const isEditingTransaction = Boolean(editTransaction);
  const isEditingDividend = Boolean(editDividend);
  const isEditMode = isEditingTransaction || isEditingDividend;

  const allAssets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const cashAsset = useMemo(
    () => allAssets.find((a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA") ?? null,
    [allAssets],
  );

  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    () =>
      editTransaction?.asset_id ??
      editDividend?.asset_id ??
      asset?.id ??
      allAssets.find((a) => !isCashAssetClass(a.asset_class))?.id ??
      allAssets[0]?.id ??
      "",
  );

  const [type, setType] = useState<PortfolioTransactionType>(() => {
    if (editDividend) return "dividend";
    if (editTransaction) return editTransaction.type;
    return initialType;
  });

  const [date, setDate] = useState(() => {
    if (editDividend) return editDividend.date.slice(0, 10);
    if (editTransaction) return editTransaction.date.slice(0, 10);
    return todayISO();
  });

  const [month, setMonth] = useState(() => {
    if (editDividend) return editDividend.date.slice(0, 7);
    return currentMonth();
  });

  const [dividendEntryMode, setDividendEntryMode] = useState<DividendEntryMode>(() => {
    if (editDividend?.notes?.includes("[MENSAL]")) return "monthly";
    return "daily";
  });

  const [dividendCalcMode, setDividendCalcMode] = useState<"total" | "per_share">("total");
  const [perShareCents, setPerShareCents] = useState(0);

  const [quantityStr, setQuantityStr] = useState(() => {
    if (editTransaction && editTransaction.type !== "split" && editTransaction.type !== "reverse_split") {
      return String(editTransaction.quantity);
    }
    return "";
  });

  const [priceCents, setPriceCents] = useState(() => {
    if (editTransaction && editTransaction.type !== "split" && editTransaction.type !== "reverse_split") {
      return numberToCents(editTransaction.price);
    }
    return 0;
  });

  const [totalCents, setTotalCents] = useState(() => {
    if (editDividend) return numberToCents(editDividend.amount);
    if (editTransaction) return numberToCents(editTransaction.total);
    return 0;
  });

  // Origem de recursos para Compra/Aporte (padrão Bolso) e flag de Crédito em Caixa para Venda/Provento
  const [buyFundingSource, setBuyFundingSource] = useState<FundingSource>("pocket");
  const [creditCash, setCreditCash] = useState<boolean>(() => {
    if (editDividend) return Boolean(editDividend.sync_cash);
    return true;
  });

  // Proporção livre De X para Y (Split / Bonificação / Grupamento)
  const [splitFromStr, setSplitFromStr] = useState<string>(() => {
    if (editTransaction?.type === "reverse_split") return String(editTransaction.quantity);
    if (initialType === "reverse_split") return "2";
    return "1";
  });
  const [splitToStr, setSplitToStr] = useState<string>(() => {
    if (editTransaction?.type === "split") return String(editTransaction.quantity);
    if (initialType === "reverse_split") return "1";
    return "2";
  });

  const [error, setError] = useState<string | null>(null);
  const [customAppliedCostCents, setCustomAppliedCostCents] = useState<number | null>(null);
  const [customTaxRatePct, setCustomTaxRatePct] = useState<number | null>(null);
  const [customTaxAmountCents, setCustomTaxAmountCents] = useState<number | null>(null);
  const [showTaxEditor, setShowTaxEditor] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetAsset = useMemo(() => {
    if (asset) return asset;
    return allAssets.find((a) => a.id === selectedAssetId) ?? null;
  }, [asset, selectedAssetId, allAssets]);

  const defaultAppliedCost =
    targetAsset?.fixed_income_metadata?.initial_investment_value !== undefined &&
    targetAsset.fixed_income_metadata.initial_investment_value !== null &&
    targetAsset.fixed_income_metadata.initial_investment_value > 0
      ? targetAsset.fixed_income_metadata.initial_investment_value
      : targetAsset?.average_price !== undefined && targetAsset.average_price > 0
        ? targetAsset.average_price
        : (targetAsset?.fixed_income_metadata?.base_value ?? 0);

  const appliedCostCents =
    customAppliedCostCents !== null ? customAppliedCostCents : numberToCents(defaultAppliedCost);

  const isCash = isCashAssetClass(targetAsset?.asset_class ?? null);
  const isTesouro = targetAsset ? isTesouroAsset(targetAsset.ticker, targetAsset.asset_class) : false;
  const isFixedIncome = targetAsset ? isFixedIncomeClass(targetAsset.asset_class) || isTesouro : false;
  const pricingMode = targetAsset ? getAssetPricingMode(targetAsset) : "unit_price";
  const isTotalValue =
    !isCash &&
    Boolean(targetAsset) &&
    (pricingMode === "total_value" || (isFixedIncome && !isTesouro));

  const parsedQty = parseNumber(quantityStr);
  const isDividendType = type === "dividend" || type === "jcp" || type === "fii_yield";
  const isCorporateEvent = type === "split" || type === "reverse_split";

  // Fator calculado a partir de De X para Y cotas
  const parsedSplitFrom = parseNumber(splitFromStr);
  const parsedSplitTo = parseNumber(splitToStr);
  const computedEventFactor = useMemo(() => {
    if (parsedSplitFrom <= 0 || parsedSplitTo <= 0) return 0;
    return type === "split" ? parsedSplitTo / parsedSplitFrom : parsedSplitFrom / parsedSplitTo;
  }, [parsedSplitFrom, parsedSplitTo, type]);

  // Valor calculado de proventos quando Por Cota está ativo
  const custodyQty = Math.max(0, targetAsset?.quantity ?? 0);
  const effectiveDividendTotalBRL = useMemo(() => {
    if (dividendCalcMode === "per_share" && !isTotalValue) {
      return Math.round((perShareCents / 100) * custodyQty * 100) / 100;
    }
    return totalCents / 100;
  }, [dividendCalcMode, isTotalValue, perShareCents, custodyQty, totalCents]);

  const currentOrderTotalBRL = useMemo(() => {
    if (isCash) return totalCents / 100;
    if (isTotalValue) return (totalCents || priceCents) / 100;
    if (isDividendType) return effectiveDividendTotalBRL;
    const unitBRL = (priceCents / 100) * (targetAsset?.currency === "USD" ? usdRate : 1);
    return Math.round(parsedQty * unitBRL * 100) / 100;
  }, [isCash, isTotalValue, isDividendType, totalCents, priceCents, effectiveDividendTotalBRL, parsedQty, targetAsset, usdRate]);

  // Prévia de Recálculo de PM na Compra
  const buyPreview = useMemo(() => {
    if (!targetAsset || isCash || isTotalValue || parsedQty <= 0 || priceCents <= 0) return null;
    const unitPrice = priceCents / 100;
    return calculateWeightedAveragePrice(
      targetAsset.quantity,
      targetAsset.average_price,
      parsedQty,
      unitPrice,
    );
  }, [targetAsset, isCash, isTotalValue, parsedQty, priceCents]);

  // Prévia de Venda
  const sellPreview = useMemo(() => {
    if (!targetAsset || isCash || isTotalValue || parsedQty <= 0 || priceCents <= 0) return null;
    const unitPrice = priceCents / 100;
    return sellAssetPosition({
      currentQuantity: targetAsset.quantity,
      currentAveragePrice: targetAsset.average_price,
      sellQuantity: parsedQty,
      sellPrice: unitPrice,
      assetClass: targetAsset.asset_class,
    });
  }, [targetAsset, isCash, isTotalValue, parsedQty, priceCents]);

  // Saldo bruto acumulado de Renda Fixa na data de referência
  const currentGrossBalance = useMemo(() => {
    if (!targetAsset) return 0;
    if (!targetAsset.fixed_income_metadata) {
      return targetAsset.average_price > 0 ? targetAsset.average_price : targetAsset.quantity;
    }
    const currentCost =
      targetAsset.fixed_income_metadata.initial_investment_value &&
      targetAsset.fixed_income_metadata.initial_investment_value > 0
        ? targetAsset.fixed_income_metadata.initial_investment_value
        : targetAsset.average_price > 0
          ? targetAsset.average_price
          : (targetAsset.fixed_income_metadata.base_value ?? 0);
    const baseValue =
      targetAsset.fixed_income_metadata.base_value !== undefined &&
      targetAsset.fixed_income_metadata.base_value !== null &&
      targetAsset.fixed_income_metadata.base_value > 0
        ? targetAsset.fixed_income_metadata.base_value
        : currentCost;
    const fiRes = calculateFixedIncomeBalance({
      baseValue,
      baseDate: targetAsset.fixed_income_metadata.base_date,
      initialInvestmentDate: targetAsset.fixed_income_metadata.initial_investment_date,
      maturityDate: targetAsset.fixed_income_metadata.maturity_date,
      rateType: targetAsset.fixed_income_metadata.rate_type,
      rateValue: targetAsset.fixed_income_metadata.rate_value,
      isTaxExempt: targetAsset.fixed_income_metadata.is_tax_exempt,
      manualTaxRatePct: targetAsset.fixed_income_metadata.manual_tax_rate_pct,
      totalCost: currentCost,
      today: date,
    });
    return fiRes.grossValue > 0 ? fiRes.grossValue : currentCost;
  }, [targetAsset, date]);

  // Prévia de Resgate de Renda Fixa & Tributação
  const fixedIncomeSellTaxPreview = useMemo(() => {
    if (
      type !== "sell" ||
      !targetAsset ||
      !targetAsset.fixed_income_metadata ||
      (totalCents <= 0 && priceCents <= 0)
    ) {
      return null;
    }

    const currentCost =
      targetAsset.fixed_income_metadata?.initial_investment_value &&
      targetAsset.fixed_income_metadata.initial_investment_value > 0
        ? targetAsset.fixed_income_metadata.initial_investment_value
        : targetAsset.average_price > 0
          ? targetAsset.average_price
          : (targetAsset.fixed_income_metadata?.base_value ?? 0);
    const withdrawGross = (totalCents || priceCents) / 100;
    const appliedCostBasis = appliedCostCents > 0 ? appliedCostCents / 100 : currentCost;

    const baseValue =
      targetAsset.fixed_income_metadata.base_value !== undefined &&
      targetAsset.fixed_income_metadata.base_value !== null &&
      targetAsset.fixed_income_metadata.base_value > 0
        ? targetAsset.fixed_income_metadata.base_value
        : appliedCostBasis > 0
          ? appliedCostBasis
          : currentCost;

    const fiRes = calculateFixedIncomeBalance({
      baseValue,
      baseDate: targetAsset.fixed_income_metadata.base_date,
      initialInvestmentDate: targetAsset.fixed_income_metadata.initial_investment_date,
      maturityDate: targetAsset.fixed_income_metadata.maturity_date,
      rateType: targetAsset.fixed_income_metadata.rate_type,
      rateValue: targetAsset.fixed_income_metadata.rate_value,
      isTaxExempt: targetAsset.fixed_income_metadata.is_tax_exempt,
      manualTaxRatePct: targetAsset.fixed_income_metadata.manual_tax_rate_pct,
      totalCost: appliedCostBasis > 0 ? appliedCostBasis : currentCost,
      today: date,
    });

    const isExempt = Boolean(targetAsset.fixed_income_metadata.is_tax_exempt);
    const grossBalance = Math.max(fiRes.grossValue, currentCost);
    const proportion = grossBalance > 0 ? Math.min(1, withdrawGross / grossBalance) : 1;
    const projectedTax = isExempt ? 0 : Math.round(fiRes.taxAmount * proportion * 100) / 100;
    const projectedTaxRatePct = isExempt ? 0 : fiRes.taxRatePct;

    const costBasisProportion = Math.round(appliedCostBasis * proportion * 100) / 100;
    const realizedProfit = Math.round((withdrawGross - costBasisProportion) * 100) / 100;
    const realizedProfitPct =
      costBasisProportion > 0 ? Math.round((realizedProfit / costBasisProportion) * 10000) / 100 : 0;

    let effectiveTaxAmount = projectedTax;
    let effectiveTaxRatePct = projectedTaxRatePct;

    if (customTaxAmountCents !== null) {
      effectiveTaxAmount = Math.max(0, customTaxAmountCents / 100);
      effectiveTaxRatePct =
        realizedProfit > 0
          ? Math.round((effectiveTaxAmount / realizedProfit) * 10000) / 100
          : customTaxRatePct !== null
            ? customTaxRatePct
            : projectedTaxRatePct;
    } else if (customTaxRatePct !== null) {
      effectiveTaxRatePct = Math.max(0, customTaxRatePct);
      effectiveTaxAmount =
        effectiveTaxRatePct === 0
          ? 0
          : Math.max(0, Math.round(Math.max(0, realizedProfit) * (effectiveTaxRatePct / 100) * 100) / 100);
    }

    const isCustomized = customTaxRatePct !== null || customTaxAmountCents !== null;
    const netCredit = Math.max(0, Math.round((withdrawGross - effectiveTaxAmount) * 100) / 100);

    const remainingGrossBalance = Math.max(0, Math.round((grossBalance - withdrawGross) * 100) / 100);
    const remainingCostBasis = Math.max(0, Math.round((appliedCostBasis - costBasisProportion) * 100) / 100);

    return {
      grossAmount: withdrawGross,
      grossBalance,
      appliedCostBasis: costBasisProportion,
      realizedProfit,
      realizedProfitPct,
      remainingGrossBalance,
      remainingCostBasis,
      netBalance: fiRes.netValue,
      projectedTaxRatePct,
      projectedTaxAmount: projectedTax,
      taxRatePct: effectiveTaxRatePct,
      taxAmount: effectiveTaxAmount,
      netCredit,
      isExempt,
      isCustomized,
      taxCountdown: fiRes.taxCountdown,
      isMatured: fiRes.isMatured,
    };
  }, [type, targetAsset, totalCents, priceCents, appliedCostCents, date, customTaxRatePct, customTaxAmountCents]);

  const fiSellResult = fixedIncomeSellTaxPreview;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setError(null);
      setCustomTaxRatePct(null);
      setCustomTaxAmountCents(null);
      setShowTaxEditor(false);
      onClose?.();
    }
  };

  const isBusy =
    recordOrder.isPending || updateTx.isPending || updateDividend.isPending || isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAsset || isBusy || isSubmittingRef.current) return;

    const price = priceCents / 100;
    const total = isCash
      ? totalCents / 100
      : isTotalValue
        ? (totalCents || priceCents) / 100
        : isDividendType
          ? effectiveDividendTotalBRL
          : Math.round(parsedQty * price * 100) / 100;

    if (isTotalValue) {
      if (type === "buy" && total <= 0) {
        setError("Informe o valor do aporte.");
        return;
      }
      if (type === "sell") {
        if (total <= 0) {
          setError("Informe o valor do resgate.");
          return;
        }
        const maxBalance = fiSellResult?.grossBalance ?? targetAsset.average_price;
        if (!isEditingTransaction && maxBalance > 0 && total > maxBalance * 1.005) {
          setError(`Valor excede o saldo bruto acumulado (${formatCentsAsBRL(numberToCents(maxBalance))}).`);
          return;
        }
      }
    } else if (type === "buy" || type === "sell" || type === "subscription") {
      if (!isCash && parsedQty <= 0) {
        setError("Informe uma quantidade válida de cotas.");
        return;
      }
      if (!isCash && price <= 0) {
        setError("Informe o preço unitário da ordem.");
        return;
      }
      if (isCash && total <= 0) {
        setError("Informe o valor da movimentação em caixa.");
        return;
      }
      if (!isEditingTransaction && type === "sell" && !isCash && parsedQty > targetAsset.quantity) {
        setError(`Quantidade excede a custódia atual (${targetAsset.quantity} cotas).`);
        return;
      }
    }

    if (isDividendType && total <= 0) {
      setError("Informe o valor válido do provento recebido.");
      return;
    }

    if (isCorporateEvent && (computedEventFactor <= 1 || !Number.isFinite(computedEventFactor))) {
      setError(
        type === "split"
          ? "Para desdobro ou bonificação, a proporção final (Para) deve ser maior que a inicial (De)."
          : "Para grupamento, a proporção inicial (De) deve ser maior que a final (Para).",
      );
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Modo Edição de Provento Existente
      if (editDividend) {
        const resolvedDate = resolveDividendDate(
          dividendEntryMode,
          dividendEntryMode === "monthly" ? month : date,
        );
        const resolvedNotes = resolveDividendNote(dividendEntryMode, editDividend.notes ?? "", type);
        const rate = targetAsset.currency === "USD" ? usdRate : 1;
        const cashAmountBRL = Math.round(total * rate * 100) / 100;

        await updateDividend.mutateAsync({
          id: editDividend.id,
          patch: {
            amount: total,
            date: resolvedDate,
            ticker: targetAsset.ticker,
            asset_id: targetAsset.id,
            notes: resolvedNotes,
            sync_cash: Boolean(creditCash && cashAmountBRL > 0),
            cash_amount: creditCash && cashAmountBRL > 0 ? cashAmountBRL : null,
          },
          syncCash: creditCash,
          previousSyncCash: Boolean(editDividend.sync_cash),
          previousCashAmount: editDividend.cash_amount ?? editDividend.amount,
        });

        handleOpenChange(false);
        onSuccess?.();
        return;
      }

      // 2. Modo Edição de Lançamento / Transação Existente
      if (editTransaction) {
        const resolvedQty = isCorporateEvent
          ? Math.round(computedEventFactor * 1000000) / 1000000
          : isTotalValue
            ? 1
            : parsedQty;
        const resolvedPrice = isCorporateEvent ? 0 : isTotalValue ? total : price;
        const resolvedTotal = isCorporateEvent ? 0 : total;

        await updateTx.mutateAsync({
          id: editTransaction.id,
          patch: {
            type,
            date,
            quantity: resolvedQty,
            price: resolvedPrice,
            total: resolvedTotal,
          },
        });

        handleOpenChange(false);
        onSuccess?.();
        return;
      }

      // 3. Criação de Nova Operação / Ordem
      const resolvedDate = isDividendType
        ? resolveDividendDate(dividendEntryMode, dividendEntryMode === "monthly" ? month : date)
        : date;
      const resolvedNotes = isDividendType ? resolveDividendNote(dividendEntryMode, "", type) : undefined;

      const buyFlags = flagsFromFundingSource(buyFundingSource);
      const effectiveSyncCash =
        type === "buy" || type === "subscription" ? buyFlags.syncCash : isCorporateEvent ? false : creditCash;
      const effectiveRecordContribution =
        type === "buy" || type === "subscription" ? buyFlags.recordContribution : false;

      await recordOrder.mutateAsync({
        asset: targetAsset,
        type,
        date: resolvedDate,
        quantity: isTotalValue
          ? 1
          : isCorporateEvent
            ? Math.round(computedEventFactor * 1000000) / 1000000
            : parsedQty,
        price: isTotalValue ? total : isCorporateEvent ? 0 : price,
        total: isCorporateEvent ? 0 : total,
        syncCash: effectiveSyncCash,
        cashAsset,
        recordContribution: effectiveRecordContribution,
        notes: resolvedNotes,
        usdRate,
        appliedCostBasis: isTotalValue && appliedCostCents > 0 ? appliedCostCents / 100 : undefined,
        customTaxAmount: isTotalValue && fixedIncomeSellTaxPreview ? fixedIncomeSellTaxPreview.taxAmount : undefined,
        customTaxRatePct: isTotalValue && fixedIncomeSellTaxPreview ? fixedIncomeSellTaxPreview.taxRatePct : undefined,
        netCreditAmount: isTotalValue && fixedIncomeSellTaxPreview ? fixedIncomeSellTaxPreview.netCredit : undefined,
      });

      const operationLabel =
        type === "buy" || type === "subscription"
          ? "Compra / Aporte registrado"
          : type === "sell"
            ? "Venda / Resgate registrado"
            : isDividendType
              ? "Provento registrado"
              : "Evento corporativo registrado";
      pushToast({
        title: operationLabel,
        description: `${targetAsset.ticker} atualizado na carteira com sucesso.`,
        variant: "success",
      });

      handleOpenChange(false);
      onSuccess?.();
    } catch (err) {
      triggerSensory("destructive");
      setError(getErrorMessage(err));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const assetOptions = allAssets
    .filter((a) => !isCashAssetClass(a.asset_class))
    .map((a) => ({
      value: a.id,
      label: `${a.ticker} (${a.asset_class ?? "Ativo"})`,
    }));

  const operations = [
    {
      id: "buy",
      label: isTotalValue ? "Aporte / Aplicação" : "Compra / Aporte",
      icon: ArrowUpRight,
      activeClass: "border-primary bg-primary/10 text-primary-strong shadow-xs font-bold",
    },
    {
      id: "sell",
      label: isTotalValue ? "Resgate" : "Venda / Resgate",
      icon: ArrowDownLeft,
      activeClass: "border-negative/60 bg-negative/10 text-negative-strong shadow-xs font-bold",
    },
    {
      id: "dividend",
      label: isTotalValue ? "Rendimento / Cupom" : "Provento",
      icon: Receipt,
      activeClass: "border-positive/60 bg-positive/10 text-positive-strong shadow-xs font-bold",
    },
    {
      id: "split",
      label: "Desdobro / Bonif.",
      icon: GitFork,
      activeClass: "border-warning/60 bg-warning/10 text-warning-strong shadow-xs font-bold",
    },
    {
      id: "reverse_split",
      label: "Grupamento",
      icon: RotateCcw,
      activeClass: "border-warning/60 bg-warning/10 text-warning-strong shadow-xs font-bold",
    },
  ];

  const availableOperations = isEditingDividend
    ? operations.filter((op) => op.id === "dividend")
    : isEditingTransaction
      ? isTotalValue
        ? operations.filter((op) => op.id !== "split" && op.id !== "reverse_split" && op.id !== "dividend")
        : operations.filter((op) => op.id !== "dividend")
      : isTotalValue
        ? operations.filter((op) => op.id !== "split" && op.id !== "reverse_split")
        : operations;

  const modalTitle = isEditingDividend
    ? `Editar Provento${targetAsset ? ` · ${targetAsset.ticker}` : ""}`
    : isEditingTransaction
      ? `Editar Movimentação${targetAsset ? ` · ${targetAsset.ticker}` : ""}`
      : targetAsset
        ? `Movimentar ${targetAsset.ticker}`
        : "Nova Operação na Carteira";

  const modalDescription = isEditMode
    ? "Ajuste valor, cotas ou data com recálculo automático da posição em custódia."
    : "Registre compras, vendas, proventos ou eventos corporativos em tempo real.";

  const resultedEventQty = useMemo(() => {
    if (!targetAsset || computedEventFactor <= 1) return null;
    if (type === "split") {
      return Math.round(targetAsset.quantity * computedEventFactor * 10000) / 10000;
    }
    return Math.round((targetAsset.quantity / computedEventFactor) * 10000) / 10000;
  }, [targetAsset, computedEventFactor, type]);

  const resultedEventAvgPrice = useMemo(() => {
    if (!targetAsset || computedEventFactor <= 1) return null;
    if (type === "split") {
      return targetAsset.average_price / computedEventFactor;
    }
    return targetAsset.average_price * computedEventFactor;
  }, [targetAsset, computedEventFactor, type]);

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={modalTitle}
      description={modalDescription}
      size="lg"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isBusy}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={QUICK_TX_FORM_ID}
            disabled={!targetAsset || isBusy}
          >
            {isBusy ? "Processando..." : isEditMode ? "Salvar Alterações" : "Confirmar Operação"}
          </Button>
        </ModalFooter>
      }
    >
      <form id={QUICK_TX_FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Seleção do Ativo (quando não pré-fornecido e não está em modo edição) */}
        {!asset && !isEditMode && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Selecione o Ativo
            </span>
            <Select
              value={selectedAssetId}
              onValueChange={(val) => {
                setSelectedAssetId(val);
                setCustomAppliedCostCents(null);
              }}
              options={assetOptions}
              placeholder="Escolha um ativo da carteira"
            />
          </div>
        )}

        {/* Seletor de Operação */}
        {availableOperations.length > 1 && (
          <div
            className={cn(
              "grid gap-2",
              availableOperations.length >= 5
                ? "grid-cols-2 sm:grid-cols-3"
                : availableOperations.length === 3
                  ? "grid-cols-3"
                  : "grid-cols-2",
            )}
            role="tablist"
            aria-label="Tipo de Operação"
          >
            {availableOperations.map((op) => {
              const Icon = op.icon;
              const isSelected = type === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    const nextType = op.id as PortfolioTransactionType;
                    setType(nextType);
                    if (nextType === "reverse_split" && !isEditingTransaction) {
                      setSplitFromStr("2");
                      setSplitToStr("1");
                    } else if (nextType === "split" && !isEditingTransaction) {
                      setSplitFromStr("1");
                      setSplitToStr("2");
                    }
                    triggerSensory("selection");
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
                    isSelected
                      ? op.activeClass
                      : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{op.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 1. MODO COMPRA / APORTE */}
        {(type === "buy" || type === "subscription") && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {isTotalValue ? (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="quick-rf-aporte-amount" className="text-xs font-semibold text-foreground">
                    Valor do Aporte / Aplicação ({targetAsset?.currency ?? "BRL"})
                  </label>
                  <MoneyInput
                    id="quick-rf-aporte-amount"
                    cents={totalCents || priceCents}
                    onCentsChange={(cents) => {
                      setTotalCents(cents);
                      setPriceCents(cents);
                    }}
                    placeholder="R$ 0,00"
                    aria-label="Valor do aporte em renda fixa"
                  />
                </div>
              ) : !isCash ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="quick-buy-qty" className="text-xs font-semibold text-foreground">
                      Quantidade
                    </label>
                    <NumericInput
                      id="quick-buy-qty"
                      value={quantityStr}
                      onValueChange={setQuantityStr}
                      placeholder="Ex: 10"
                      aria-label="Quantidade de cotas"
                      showCalculatorAction
                      className="text-base sm:text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="quick-buy-price" className="text-xs font-semibold text-foreground">
                      Preço Unitário ({targetAsset?.currency ?? "BRL"})
                    </label>
                    <MoneyInput
                      id="quick-buy-price"
                      cents={priceCents}
                      currency={targetAsset?.currency ?? "BRL"}
                      onCentsChange={setPriceCents}
                      placeholder={targetAsset?.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="quick-cash-amount" className="text-xs font-semibold text-foreground">
                    Valor do Depósito em Caixa
                  </label>
                  <MoneyInput
                    id="quick-cash-amount"
                    cents={totalCents}
                    onCentsChange={setTotalCents}
                    placeholder="R$ 0,00"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">
                  Data da Operação
                </label>
                <DatePicker value={date} onValueChange={setDate} />
              </div>
            </div>

            {!isEditingTransaction && isTotalValue && (totalCents > 0 || priceCents > 0) && (
              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/35 p-3 text-xs">
                <span className="text-muted-foreground">Saldo aplicado resultante:</span>
                <span className="font-mono font-bold text-primary-strong text-sm">
                  <MoneyText cents={numberToCents((targetAsset?.average_price ?? 0) + (totalCents || priceCents) / 100)} />
                </span>
              </div>
            )}

            {!isEditingTransaction && !isTotalValue && buyPreview && parsedQty > 0 && priceCents > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/35 p-3 text-xs">
                <span className="text-muted-foreground">Novo Preço Médio Resultante:</span>
                <span className="font-mono font-bold text-primary-strong text-sm">
                  <MoneyText cents={numberToCents(buyPreview.newAveragePrice)} currency={targetAsset?.currency ?? "BRL"} />
                </span>
              </div>
            )}

            {!isEditingTransaction && !isCash && (
              <FundingSourceSelector
                value={buyFundingSource}
                onChange={setBuyFundingSource}
                cashBalanceBRL={cashAsset?.quantity ?? 0}
                orderTotalBRL={currentOrderTotalBRL}
                label="Origem dos recursos desta compra"
              />
            )}
          </div>
        )}

        {/* 2. MODO VENDA / RESGATE */}
        {type === "sell" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {isTotalValue ? (
                <div className="flex flex-col gap-3 sm:col-span-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="quick-rf-sell-amount" className="text-xs font-semibold text-foreground">
                      Valor a Resgatar ({targetAsset?.currency ?? "BRL"})
                    </label>
                    <MoneyInput
                      id="quick-rf-sell-amount"
                      cents={totalCents || priceCents}
                      onCentsChange={(cents) => {
                        setTotalCents(cents);
                        setPriceCents(cents);
                      }}
                      placeholder="R$ 0,00"
                      aria-label="Valor a resgatar em renda fixa"
                    />
                    {!isEditingTransaction && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] text-muted-foreground">Resgatar:</span>
                        {[
                          { label: "25%", pct: 0.25 },
                          { label: "50%", pct: 0.5 },
                          { label: "75%", pct: 0.75 },
                          { label: "100% (Total)", pct: 1 },
                        ].map((s) => (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => {
                              const balance = fixedIncomeSellTaxPreview?.grossBalance ?? currentGrossBalance;
                              const cents = Math.round(balance * s.pct * 100);
                              setTotalCents(cents);
                              setPriceCents(cents);
                            }}
                            className="rounded-md border border-border/80 bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isEditingTransaction && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="quick-rf-applied-cost" className="text-xs font-semibold text-foreground">
                          Custo Original da Aplicação (R$)
                        </label>
                        <span className="text-[11px] text-muted-foreground">Base contábil</span>
                      </div>
                      <MoneyInput
                        id="quick-rf-applied-cost"
                        cents={appliedCostCents}
                        onCentsChange={setCustomAppliedCostCents}
                        placeholder="R$ 0,00"
                        aria-label="Custo original da aplicação do lote"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        Valor original investido neste lote (utilizado para apurar o lucro realizado e rentabilidade final).
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="quick-sell-qty" className="text-xs font-semibold text-foreground">
                      Quantidade a Vender
                    </label>
                    <NumericInput
                      id="quick-sell-qty"
                      value={quantityStr}
                      onValueChange={setQuantityStr}
                      placeholder={`Máx: ${targetAsset?.quantity ?? 0}`}
                      aria-label="Quantidade a vender"
                      showCalculatorAction
                      className="text-base sm:text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="quick-sell-price" className="text-xs font-semibold text-foreground">
                      Preço de Venda ({targetAsset?.currency ?? "BRL"})
                    </label>
                    <MoneyInput
                      id="quick-sell-price"
                      cents={priceCents}
                      currency={targetAsset?.currency ?? "BRL"}
                      onCentsChange={setPriceCents}
                      placeholder={targetAsset?.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">
                  Data {isTotalValue ? "do Resgate" : "da Venda"}
                </label>
                <DatePicker value={date} onValueChange={setDate} />
              </div>
            </div>

            {!isEditingTransaction && isTotalValue && (totalCents > 0 || priceCents > 0) && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/35 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Saldo bruto restante após resgate:</span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    <MoneyText
                      cents={Math.max(
                        0,
                        numberToCents(
                          (fixedIncomeSellTaxPreview?.grossBalance ??
                            targetAsset?.fixed_income_metadata?.base_value ??
                            targetAsset?.average_price ??
                            0) - (totalCents || priceCents) / 100,
                        ),
                      )}
                    />
                  </span>
                </div>
                {fixedIncomeSellTaxPreview && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-1">
                    <span>Custo original remanescente:</span>
                    <span className="font-mono text-foreground">
                      <MoneyText cents={numberToCents(fixedIncomeSellTaxPreview.remainingCostBasis)} />
                    </span>
                  </div>
                )}
              </div>
            )}

            {!isEditingTransaction && fixedIncomeSellTaxPreview && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 text-xs shadow-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2 gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">Discriminação do Resgate</span>
                    {fixedIncomeSellTaxPreview.isCustomized && (
                      <Badge variant="warning" size="xs">
                        Ajustado
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {fixedIncomeSellTaxPreview.isExempt && !fixedIncomeSellTaxPreview.isCustomized && (
                      <Badge variant="positive" size="xs">
                        Isento de IR
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setShowTaxEditor((prev) => !prev)}
                      className={cn(
                        fixedIncomeSellTaxPreview.isCustomized
                          ? "text-warning-strong font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-label="Ajustar alíquota e imposto de renda retido na fonte"
                    >
                      <SlidersHorizontal className="size-3" aria-hidden="true" />
                      <span>
                        {showTaxEditor
                          ? "Fechar Ajuste"
                          : `Alíquota: ${formatPercent(fixedIncomeSellTaxPreview.taxRatePct)}`}
                      </span>
                    </Button>
                  </div>
                </div>

                {showTaxEditor && (
                  <div className="flex flex-col gap-2.5 rounded-lg border border-border/80 bg-muted/35 p-2.5 my-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-foreground">
                        Ajuste Fiscal Manual (Nota de Corretagem)
                      </span>
                      {fixedIncomeSellTaxPreview.isCustomized && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomTaxRatePct(null);
                            setCustomTaxAmountCents(null);
                          }}
                          className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                        >
                          <RotateCcw className="size-3" aria-hidden="true" />
                          <span>Restaurar Projeção</span>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="quick-tax-rate" className="text-[11px] font-medium text-foreground">
                          Alíquota de IR (%):
                        </label>
                        <span className="text-[11px] text-muted-foreground">Regressiva</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                          { label: "22,5%", rate: 22.5 },
                          { label: "20%", rate: 20 },
                          { label: "17,5%", rate: 17.5 },
                          { label: "15%", rate: 15 },
                          { label: "Isento (0%)", rate: 0 },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              setCustomTaxRatePct(item.rate);
                              setCustomTaxAmountCents(null);
                            }}
                            className={cn(
                              "rounded px-2 py-0.5 text-[11px] font-medium border transition-colors cursor-pointer",
                              fixedIncomeSellTaxPreview.taxRatePct === item.rate && customTaxAmountCents === null
                                ? "border-primary bg-primary/10 text-primary-strong font-bold"
                                : "border-border/80 bg-surface hover:bg-surface-hover text-foreground",
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-0.5">
                        <NumericInput
                          id="quick-tax-rate"
                          value={customTaxRatePct !== null ? String(customTaxRatePct) : String(fixedIncomeSellTaxPreview.taxRatePct)}
                          onValueChange={(val) => {
                            const num = parseNumber(val);
                            setCustomTaxRatePct(isNaN(num) ? 0 : Math.max(0, Math.min(100, num)));
                            setCustomTaxAmountCents(null);
                          }}
                          placeholder="Ex: 22,5"
                          aria-label="Alíquota personalizada de imposto de renda"
                          className="text-base sm:text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
                      <div className="flex items-center justify-between">
                        <label htmlFor="quick-tax-irrf" className="text-[11px] font-medium text-foreground">
                          IRRF Retido na Fonte ({targetAsset?.currency ?? "BRL"}):
                        </label>
                        <span className="text-[11px] text-muted-foreground">Valor na corretora</span>
                      </div>
                      <MoneyInput
                        id="quick-tax-irrf"
                        cents={
                          customTaxAmountCents !== null
                            ? customTaxAmountCents
                            : numberToCents(fixedIncomeSellTaxPreview.taxAmount)
                        }
                        currency={targetAsset?.currency ?? "BRL"}
                        onCentsChange={(cents) => {
                          setCustomTaxAmountCents(cents);
                          if (fixedIncomeSellTaxPreview.realizedProfit > 0) {
                            const effectiveRate = Math.round(((cents / 100) / fixedIncomeSellTaxPreview.realizedProfit) * 10000) / 100;
                            setCustomTaxRatePct(effectiveRate);
                          }
                        }}
                        placeholder="R$ 0,00"
                        aria-label="Valor de imposto de renda retido na fonte"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valor Bruto do Resgate:</span>
                  <span className="font-mono font-medium text-foreground">
                    <MoneyText cents={numberToCents(fixedIncomeSellTaxPreview.grossAmount)} />
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Custo Original Aplicado:</span>
                  <span className="font-mono font-medium text-foreground">
                    <MoneyText cents={numberToCents(fixedIncomeSellTaxPreview.appliedCostBasis)} />
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rendimento Bruto Realizado:</span>
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      fixedIncomeSellTaxPreview.realizedProfit >= 0 ? "text-positive-strong" : "text-critical-strong",
                    )}
                  >
                    {fixedIncomeSellTaxPreview.realizedProfit >= 0 ? "+" : ""}
                    <MoneyText cents={numberToCents(fixedIncomeSellTaxPreview.realizedProfit)} /> (
                    {fixedIncomeSellTaxPreview.realizedProfitPct >= 0 ? "+" : ""}
                    {formatPercent(fixedIncomeSellTaxPreview.realizedProfitPct)})
                  </span>
                </div>

                <div
                  className={cn(
                    "flex items-center justify-between",
                    fixedIncomeSellTaxPreview.taxAmount > 0 ? "text-warning-strong" : "text-muted-foreground",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span>IRRF Retido na Fonte ({formatPercent(fixedIncomeSellTaxPreview.taxRatePct)}):</span>
                    {fixedIncomeSellTaxPreview.isCustomized && (
                      <Badge variant="warning" size="xs">
                        Ajustado
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-medium">
                      {fixedIncomeSellTaxPreview.taxAmount > 0 ? "−" : ""}
                      <MoneyText cents={numberToCents(fixedIncomeSellTaxPreview.taxAmount)} />
                    </span>
                    {!showTaxEditor && (
                      <button
                        type="button"
                        onClick={() => setShowTaxEditor(true)}
                        className="text-[11px] underline text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-2 font-bold">
                  <span className="text-foreground">Crédito Líquido no Caixa:</span>
                  <span className="font-mono text-positive-strong text-sm">
                    <MoneyText cents={numberToCents(fixedIncomeSellTaxPreview.netCredit)} />
                  </span>
                </div>

                {fixedIncomeSellTaxPreview.taxCountdown && (
                  <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                    A alíquota de IR reduzirá para{" "}
                    <span className="font-semibold text-foreground">
                      {formatPercent(fixedIncomeSellTaxPreview.taxCountdown.nextRatePct)}
                    </span>{" "}
                    em{" "}
                    <span className="font-semibold text-foreground">
                      {fixedIncomeSellTaxPreview.taxCountdown.daysRemaining} dias
                    </span>
                    .
                  </p>
                )}
              </div>
            )}

            {!isEditingTransaction && !isTotalValue && sellPreview && parsedQty > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 text-xs shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Resultado Realizado:</span>
                  <span
                    className={cn(
                      "font-mono font-bold text-sm",
                      sellPreview.realizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong",
                    )}
                  >
                    {sellPreview.realizedPnl >= 0 ? "+" : ""}
                    <MoneyText cents={numberToCents(sellPreview.realizedPnl)} currency={targetAsset?.currency ?? "BRL"} /> (
                    {sellPreview.realizedPnlPct >= 0 ? "+" : ""}
                    {formatPercent(sellPreview.realizedPnlPct)})
                  </span>
                </div>

                {targetAsset?.asset_class === "Ações" && (
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                    <Info className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span>Isenção de IRPF se o total de vendas de ações no mês for até R$ 20.000,00.</span>
                  </div>
                )}
              </div>
            )}

            {!isEditingTransaction && (
              <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-muted/35 p-3 text-xs">
                <Checkbox
                  id="quick-sell-sync-cash"
                  checked={creditCash}
                  onCheckedChange={(c) => setCreditCash(Boolean(c))}
                  label="Creditar o valor líquido da venda diretamente no Caixa da carteira"
                />
              </div>
            )}
          </div>
        )}

        {/* 3. MODO PROVENTO (DIVIDENDO / JCP / RENDIMENTO) */}
        {isDividendType && (
          <div className="flex flex-col gap-4">
            {/* Alternador Valor Total vs Por Cota (quando não for Renda Fixa valor total) */}
            {!isTotalValue && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground">Formato do Valor</span>
                <div className="flex items-center gap-1 rounded-xl bg-muted/35 p-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => {
                      setDividendCalcMode("total");
                      triggerSensory("selection");
                    }}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      dividendCalcMode === "total"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Valor Total Recebido
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDividendCalcMode("per_share");
                      triggerSensory("selection");
                    }}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      dividendCalcMode === "per_share"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Valor por Cota
                  </button>
                </div>
              </div>
            )}

            {dividendCalcMode === "per_share" && !isTotalValue ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="quick-div-per-share" className="text-xs font-semibold text-foreground">
                  Rendimento por Cota (Líquido) ({targetAsset?.currency ?? "BRL"})
                </label>
                <MoneyInput
                  id="quick-div-per-share"
                  cents={perShareCents}
                  currency={targetAsset?.currency ?? "BRL"}
                  onCentsChange={setPerShareCents}
                  placeholder={targetAsset?.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                />
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/35 p-3 text-xs">
                  <span className="text-muted-foreground">
                    Total calculado ({custodyQty} cotas):
                  </span>
                  <span className="font-mono font-bold text-positive-strong text-sm">
                    <MoneyText
                      cents={numberToCents(effectiveDividendTotalBRL)}
                      currency={targetAsset?.currency ?? "BRL"}
                    />
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quick-div-amount" className="text-xs font-semibold text-foreground">
                  Valor Total Recebido (Líquido) ({targetAsset?.currency ?? "BRL"})
                </label>
                <MoneyInput
                  id="quick-div-amount"
                  cents={totalCents}
                  currency={targetAsset?.currency ?? "BRL"}
                  onCentsChange={setTotalCents}
                  placeholder={targetAsset?.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                />
              </div>
            )}

            {/* Alternador de Modo de Data */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">Modo de Registro</span>
              <div className="flex items-center gap-1 rounded-xl bg-muted/35 p-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => {
                    setDividendEntryMode("daily");
                    triggerSensory("selection");
                  }}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer",
                    dividendEntryMode === "daily"
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Diário (Data Exata)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDividendEntryMode("monthly");
                    triggerSensory("selection");
                  }}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer",
                    dividendEntryMode === "monthly"
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Extrato do Mês
                </button>
              </div>

              {dividendEntryMode === "daily" ? (
                <DatePicker value={date} onValueChange={setDate} />
              ) : (
                <div className="flex flex-col gap-1">
                  <MonthPicker value={month} onValueChange={setMonth} />
                  <p className="text-[11px] text-muted-foreground">
                    Gravado como {month}-01 com tag [MENSAL].
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-muted/35 p-3 text-xs">
              <Checkbox
                id="quick-div-sync-cash"
                checked={creditCash}
                onCheckedChange={(c) => setCreditCash(Boolean(c))}
                label="Creditar o rendimento diretamente no Caixa da carteira"
              />
              <p className="text-[11px] text-muted-foreground pl-6">
                Aumenta a liquidez em caixa para reinvestimentos sem registrar novo aporte financeiro do bolso.
              </p>
            </div>
          </div>
        )}

        {/* 4. MODO EVENTOS CORPORATIVOS: DESDOBRO / BONIFICAÇÃO / GRUPAMENTO X:Y */}
        {isCorporateEvent && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {type === "split" ? "Fator (1 para N) · Proporção X para Y" : "Fator (N para 1) · Proporção X para Y"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Ex.: {type === "split" ? "1 para 10 ou 10 para 11 (bonif.)" : "10 para 1 ou 5 para 2"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="quick-split-from" className="text-xs font-semibold text-foreground">
                    De (cotas atuais)
                  </label>
                  <NumericInput
                    id="quick-split-from"
                    value={splitFromStr}
                    onValueChange={setSplitFromStr}
                    placeholder={type === "split" ? "1" : "10"}
                    className="font-mono text-base sm:text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="quick-split-to" className="text-xs font-semibold text-foreground">
                    Para (novas cotas)
                  </label>
                  <NumericInput
                    id="quick-split-to"
                    value={splitToStr}
                    onValueChange={setSplitToStr}
                    placeholder={type === "split" ? "10" : "1"}
                    className="font-mono text-base sm:text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Data do Evento
                  </label>
                  <DatePicker value={date} onValueChange={setDate} />
                </div>
              </div>
            </div>

            {targetAsset && resultedEventQty !== null && resultedEventAvgPrice !== null && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/35 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Posição Resultante:</span>
                  <span className="font-mono font-bold text-foreground">
                    {resultedEventQty} cotas a{" "}
                    <MoneyText
                      cents={numberToCents(resultedEventAvgPrice)}
                      currency={targetAsset.currency ?? "BRL"}
                      className="inline font-bold"
                    />
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-1">
                  <span>
                    Antes: {targetAsset.quantity} cotas a{" "}
                    <MoneyText
                      cents={numberToCents(targetAsset.average_price)}
                      currency={targetAsset.currency ?? "BRL"}
                      className="inline"
                    />
                  </span>
                  <span>Custo total preservado</span>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

export function QuickTransactionSheet(props: QuickTransactionSheetProps) {
  if (!props.open) return null;

  const instanceKey = `${props.editTransaction?.id ?? props.editDividend?.id ?? props.asset?.id ?? "new"}-${props.initialType ?? "buy"}-${props.open ? "open" : "closed"}`;

  return <QuickTransactionSheetContent key={instanceKey} {...props} />;
}
