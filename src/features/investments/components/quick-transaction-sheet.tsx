import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, GitFork, Info, Receipt, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DatePicker,
  Input,
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
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { usePortfolioAssets, usePortfolioPosition, useRecordOrder } from "@/state";
import type { PortfolioAsset, PortfolioTransactionType } from "@/types";

export interface QuickTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: PortfolioAsset | null;
  initialType?: PortfolioTransactionType;
  onClose?: () => void;
  onSuccess?: () => void;
}

const parseNumber = parseDecimalNumber;

export function QuickTransactionSheet({
  open,
  onOpenChange,
  asset = null,
  initialType = "buy",
  onClose,
  onSuccess,
}: QuickTransactionSheetProps) {
  const assetsQuery = usePortfolioAssets();
  const recordOrder = useRecordOrder();
  const position = usePortfolioPosition();
  const usdRate = position.rows.find((r) => r.currency === "USD")?.usdRate ?? 5.25;

  const allAssets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const cashAsset = useMemo(
    () => allAssets.find((a) => isCashAssetClass(a.asset_class)) ?? null,
    [allAssets],
  );

  const [selectedAssetId, setSelectedAssetId] = useState<string>(() => asset?.id ?? (allAssets[0]?.id ?? ""));
  const [type, setType] = useState<PortfolioTransactionType>(initialType);
  const [date, setDate] = useState(() => todayISO());
  const [month, setMonth] = useState(() => currentMonth());
  // Modo de registro de provento: "daily" (data exata) ou "monthly" (extrato do mês)
  const [dividendEntryMode, setDividendEntryMode] = useState<DividendEntryMode>("daily");
  const [quantityStr, setQuantityStr] = useState("");
  const [priceCents, setPriceCents] = useState(0);
  const [totalCents, setTotalCents] = useState(0);
  const [syncCash, setSyncCash] = useState(true);
  const [recordContribution, setRecordContribution] = useState(false);
  const [splitFactor, setSplitFactor] = useState(2);
  const [error, setError] = useState<string | null>(null);

  // Custo original aplicado da posição/lote (especialmente para Renda Fixa)
  const [customAppliedCostCents, setCustomAppliedCostCents] = useState<number | null>(null);

  // Ajuste manual de tributação e IRRF no resgate
  const [customTaxRatePct, setCustomTaxRatePct] = useState<number | null>(null);
  const [customTaxAmountCents, setCustomTaxAmountCents] = useState<number | null>(null);
  const [showTaxEditor, setShowTaxEditor] = useState(false);

  // Ativo Alvo
  const targetAsset = useMemo(() => {
    if (asset) return asset;
    return allAssets.find((a) => a.id === selectedAssetId) ?? null;
  }, [asset, selectedAssetId, allAssets]);

  const defaultAppliedCost =
    (targetAsset?.fixed_income_metadata?.initial_investment_value !== undefined &&
      targetAsset.fixed_income_metadata.initial_investment_value !== null &&
      targetAsset.fixed_income_metadata.initial_investment_value > 0)
      ? targetAsset.fixed_income_metadata.initial_investment_value
      : (targetAsset?.average_price !== undefined && targetAsset.average_price > 0)
        ? targetAsset.average_price
        : (targetAsset?.fixed_income_metadata?.base_value ?? 0);

  const appliedCostCents =
    customAppliedCostCents !== null ? customAppliedCostCents : numberToCents(defaultAppliedCost);

  const isCash = isCashAssetClass(targetAsset?.asset_class ?? null);
  const isTesouro = targetAsset ? isTesouroAsset(targetAsset.ticker, targetAsset.asset_class) : false;
  const isFixedIncome = targetAsset ? (isFixedIncomeClass(targetAsset.asset_class) || isTesouro) : false;
  const pricingMode = targetAsset ? getAssetPricingMode(targetAsset) : "unit_price";
  const isTotalValue =
    !isCash &&
    !!targetAsset &&
    (pricingMode === "total_value" || (isFixedIncome && !isTesouro));

  const parsedQty = parseNumber(quantityStr);

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
      (targetAsset.fixed_income_metadata.initial_investment_value &&
        targetAsset.fixed_income_metadata.initial_investment_value > 0)
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

  // Prévia de Resgate de Renda Fixa & Tributação (Fase 63)
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
      (targetAsset.fixed_income_metadata?.initial_investment_value &&
        targetAsset.fixed_income_metadata.initial_investment_value > 0)
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

    // Tributação efetiva (considerando ajustes manuais de alíquota e IRRF retido)
    let effectiveTaxAmount = projectedTax;
    let effectiveTaxRatePct = projectedTaxRatePct;

    if (customTaxAmountCents !== null) {
      effectiveTaxAmount = Math.max(0, customTaxAmountCents / 100);
      effectiveTaxRatePct =
        realizedProfit > 0
          ? Math.round((effectiveTaxAmount / realizedProfit) * 10000) / 100
          : (customTaxRatePct !== null ? customTaxRatePct : projectedTaxRatePct);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAsset) return;
    setError(null);

    const price = priceCents / 100;
    const total = isCash
      ? totalCents / 100
      : isTotalValue
        ? (totalCents || priceCents) / 100
        : type === "dividend" || type === "jcp" || type === "fii_yield"
          ? totalCents / 100
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
        if (maxBalance > 0 && total > maxBalance * 1.005) {
          setError(`Valor excede o saldo bruto acumulado (R$ ${maxBalance.toFixed(2)}).`);
          return;
        }
      }
    } else if (type === "buy" || type === "sell") {
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
      if (type === "sell" && !isCash && parsedQty > targetAsset.quantity) {
        setError(`Quantidade excede a custódia atual (${targetAsset.quantity} cotas).`);
        return;
      }
    }

    if ((type === "dividend" || type === "jcp" || type === "fii_yield") && total <= 0) {
      setError("Informe o valor total do provento recebido.");
      return;
    }

    if ((type === "split" || type === "reverse_split") && splitFactor <= 1) {
      setError("O fator deve ser maior que 1.");
      return;
    }

    try {
      const isDividendType =
        type === "dividend" || type === "jcp" || type === "fii_yield";

      // Resolve data e nota para proventos conforme o modo de entrada
      const resolvedDate = isDividendType
        ? resolveDividendDate(dividendEntryMode, dividendEntryMode === "monthly" ? month : date)
        : date;
      const resolvedNotes = isDividendType
        ? resolveDividendNote(dividendEntryMode, "", type)
        : undefined;

      await recordOrder.mutateAsync({
        asset: targetAsset,
        type,
        date: resolvedDate,
        quantity: isTotalValue ? 1 : type === "split" || type === "reverse_split" ? splitFactor : parsedQty,
        price: isTotalValue ? total : price,
        total,
        syncCash,
        cashAsset,
        recordContribution,
        notes: resolvedNotes,
        usdRate,
        appliedCostBasis: isTotalValue && appliedCostCents > 0 ? appliedCostCents / 100 : undefined,
        customTaxAmount: isTotalValue && fixedIncomeSellTaxPreview ? fixedIncomeSellTaxPreview.taxAmount : undefined,
        customTaxRatePct: isTotalValue && fixedIncomeSellTaxPreview ? fixedIncomeSellTaxPreview.taxRatePct : undefined,
        netCreditAmount: isTotalValue && fixedIncomeSellTaxPreview ? fixedIncomeSellTaxPreview.netCredit : undefined,
      });

      triggerSensory(type === "sell" ? "destructive" : "success");
      const operationLabel =
        type === "buy" || type === "subscription"
          ? "Compra/Aporte registrado"
          : type === "sell"
            ? "Venda/Resgate registrado"
            : type === "dividend" || type === "jcp" || type === "fii_yield"
              ? "Provento registrado"
              : "Split registrado";
      pushToast({
        title: operationLabel,
        description: `${targetAsset?.ticker ?? "Ativo"} movimentado com sucesso.`,
      });

      handleOpenChange(false);
      onSuccess?.();
    } catch (err) {
      triggerSensory("destructive");
      setError(getErrorMessage(err));
    }
  };


  const assetOptions = allAssets.map((a) => ({
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
      label: "Desdobro",
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

  const availableOperations = isTotalValue
    ? operations.filter((op) => op.id !== "split" && op.id !== "reverse_split")
    : operations;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={
        targetAsset
          ? `Movimentar ${targetAsset.ticker}`
          : "Lançamento Rápido em Investimentos"
      }
      description="Registre compras, vendas, proventos ou eventos corporativos com atualização em tempo real da carteira."
      size="lg"
      showCalculator
    >

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Seleção do Ativo (quando não pré-fornecido) */}
        {!asset && (
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
                  setType(op.id as PortfolioTransactionType);
                  triggerSensory("selection");
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
                  isSelected
                    ? op.activeClass
                    : "border-border/80 bg-surface/60 text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{op.label}</span>
              </button>
            );
          })}
        </div>

        {/* 1. MODO COMPRA / APORTE */}
        {(type === "buy" || type === "subscription") && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {isTotalValue ? (
                <div className="flex flex-col gap-1.5 col-span-2">
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
                <div className="flex flex-col gap-1.5 col-span-2">
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

              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-semibold text-foreground">
                  Data da Operação
                </label>
                <DatePicker value={date} onValueChange={setDate} />
              </div>
            </div>

            {/* Prévia de Novo Saldo para RF */}
            {isTotalValue && (totalCents > 0 || priceCents > 0) && (
              <div className="flex items-center justify-between rounded-xl bg-surface-hover/60 p-3 text-xs">
                <span className="text-muted-foreground">Saldo aplicado resultante:</span>
                <span className="font-mono font-bold text-primary text-sm">
                  <MoneyText cents={numberToCents((targetAsset?.average_price ?? 0) + (totalCents || priceCents) / 100)} />
                </span>
              </div>
            )}

            {/* Prévia de Novo PM */}
            {!isTotalValue && buyPreview && parsedQty > 0 && priceCents > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-surface-hover/60 p-3 text-xs">
                <span className="text-muted-foreground">Novo Preço Médio Resultante:</span>
                <span className="font-mono font-bold text-primary text-sm">
                  <MoneyText cents={numberToCents(buyPreview.newAveragePrice)} currency={targetAsset?.currency ?? "BRL"} />
                </span>
              </div>
            )}

            {/* Origem dos Recursos da Compra (Exclusão Mútua) */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-subtle p-3 text-xs">
              <span className="font-semibold text-foreground">Origem dos recursos desta compra:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setRecordContribution(true);
                    setSyncCash(false);
                    triggerSensory("selection");
                  }}
                  className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium border transition-colors cursor-pointer text-left ${
                    recordContribution && !syncCash
                      ? "border-positive-strong bg-positive/10 text-positive-strong font-semibold shadow-2xs"
                      : "border-border/60 bg-surface hover:bg-surface-hover text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold">Dinheiro Novo (Aporte do Bolso)</div>
                  <div className="text-[10px] opacity-80">Alimenta o fluxo de aportes do mês</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRecordContribution(false);
                    setSyncCash(true);
                    triggerSensory("selection");
                  }}
                  className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium border transition-colors cursor-pointer text-left ${
                    syncCash && !recordContribution
                      ? "border-portfolio bg-portfolio/10 text-portfolio font-semibold shadow-2xs"
                      : "border-border/60 bg-surface hover:bg-surface-hover text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold">Saldo da Corretora (Caixa)</div>
                  <div className="text-[10px] opacity-80">
                    Disponível: R$ {Number(cashAsset?.quantity ?? 0).toFixed(2)}
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. MODO VENDA / DESINVESTIMENTO */}
        {type === "sell" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {isTotalValue ? (
                <div className="flex flex-col gap-3 col-span-2">
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
                    {/* Atalhos rápidos de percentual do saldo total */}
                    <div className="flex items-center gap-2 pt-1">
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
                          className="rounded-md border border-border/70 bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="quick-rf-applied-cost" className="text-xs font-semibold text-foreground">
                        Custo Original da Aplicação (R$)
                      </label>
                      <span className="text-[10px] text-muted-foreground">Base contábil</span>
                    </div>
                    <MoneyInput
                      id="quick-rf-applied-cost"
                      cents={appliedCostCents}
                      onCentsChange={setCustomAppliedCostCents}
                      placeholder="R$ 0,00"
                      aria-label="Custo original da aplicação do lote"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Valor original investido neste lote (utilizado para apurar o lucro realizado e rentabilidade final).
                    </span>
                  </div>
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

              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-semibold text-foreground">
                  Data {isTotalValue ? "do Resgate" : "da Venda"}
                </label>
                <DatePicker value={date} onValueChange={setDate} />
              </div>
            </div>

            {/* Prévia de Novo Saldo para RF */}
            {isTotalValue && (totalCents > 0 || priceCents > 0) && (
              <div className="flex flex-col gap-1.5 rounded-xl bg-surface-hover/60 p-3 text-xs">
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
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1">
                    <span>Custo original remanescente:</span>
                    <span className="font-mono text-foreground">
                      <MoneyText cents={numberToCents(fixedIncomeSellTaxPreview.remainingCostBasis)} />
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Painel de Discriminação Fiscal e Rentabilidade de Renda Fixa (Fase 63/72) */}
            {fixedIncomeSellTaxPreview && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/90 p-3.5 text-xs">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">Discriminação do Resgate</span>
                    {fixedIncomeSellTaxPreview.isCustomized && (
                      <Badge variant="warning" size="xs">
                        Ajustado
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {fixedIncomeSellTaxPreview.isExempt && !fixedIncomeSellTaxPreview.isCustomized ? (
                      <span className="rounded bg-positive/10 px-2 py-0.5 text-[11px] font-medium text-positive-strong">
                        Isento de IR
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setShowTaxEditor((prev) => !prev)}
                      className={cn(
                        "h-6 px-2 text-[11px] gap-1",
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
                          : `Alíquota: ${fixedIncomeSellTaxPreview.taxRatePct}%`}
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Editor expansível de Alíquota e IRRF Retido */}
                {showTaxEditor && (
                  <div className="flex flex-col gap-2.5 rounded-lg border border-border/70 bg-surface-hover/50 p-2.5 my-1">
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

                    {/* Alíquota de IR */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="quick-tax-rate" className="text-[11px] font-medium text-foreground">
                          Alíquota de IR (%):
                        </label>
                        <span className="text-[10px] text-muted-foreground">Regressiva</span>
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
                                : "border-border/60 bg-surface hover:bg-surface-hover text-foreground",
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
                          placeholder="Ex: 22.5"
                          aria-label="Alíquota personalizada de imposto de renda"
                        />
                      </div>
                    </div>

                    {/* Valor do IRRF Retido em R$ */}
                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <label htmlFor="quick-tax-irrf" className="text-[11px] font-medium text-foreground">
                          IRRF Retido na Fonte ({targetAsset?.currency ?? "BRL"}):
                        </label>
                        <span className="text-[10px] text-muted-foreground">Valor na corretora</span>
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
                      <span className="text-[10px] text-muted-foreground">
                        Informe o valor retido de IRRF informado pela corretora para ajustar o crédito líquido no Caixa.
                      </span>
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
                    {fixedIncomeSellTaxPreview.realizedProfitPct.toFixed(2)}%)
                  </span>
                </div>

                <div
                  className={cn(
                    "flex items-center justify-between",
                    fixedIncomeSellTaxPreview.taxAmount > 0 ? "text-warning-strong" : "text-muted-foreground",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span>IRRF Retido na Fonte ({fixedIncomeSellTaxPreview.taxRatePct}%):</span>
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
                        className="text-[10px] underline text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-2 font-bold">
                  <span className="text-foreground">Crédito Líquido no Caixa:</span>
                  <span className="font-mono text-positive-strong text-sm">
                    <MoneyText cents={numberToCents(fixedIncomeSellTaxPreview.netCredit)} />
                  </span>
                </div>

                {fixedIncomeSellTaxPreview.taxCountdown && (
                  <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    A alíquota de IR reduzirá para{" "}
                    <span className="font-semibold text-foreground">{fixedIncomeSellTaxPreview.taxCountdown.nextRatePct}%</span>{" "}
                    em <span className="font-semibold text-foreground">{fixedIncomeSellTaxPreview.taxCountdown.daysRemaining} dias</span>.
                  </p>
                )}
              </div>
            )}

            {/* Prévia de Lucro/Prejuízo Realizado */}
            {!isTotalValue && sellPreview && parsedQty > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/90 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Resultado Realizado:</span>
                  <span className={`font-mono font-bold text-sm ${sellPreview.realizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong"}`}>
                    {sellPreview.realizedPnl >= 0 ? "+" : ""}
                    <MoneyText cents={numberToCents(sellPreview.realizedPnl)} currency={targetAsset?.currency ?? "BRL"} /> ({sellPreview.realizedPnlPct >= 0 ? "+" : ""}{sellPreview.realizedPnlPct.toFixed(1)}%)
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

            <label className="flex items-center gap-2 cursor-pointer text-xs rounded-xl border border-border/60 bg-surface/40 p-3">
              <Checkbox checked={syncCash} onCheckedChange={(c) => setSyncCash(!!c)} />
              <span>Creditar o valor da venda diretamente no Caixa da carteira</span>
            </label>
          </div>
        )}

        {/* 3. MODO PROVENTO (DIVIDENDO / JCP / RENDIMENTO) */}
        {(type === "dividend" || type === "jcp" || type === "fii_yield") && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 col-span-2">
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

            {/* Alternador de Modo de Data */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">
                Modo de Registro
              </span>
              <div className="flex items-center gap-1 rounded-xl bg-surface-hover/60 p-1 border border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    setDividendEntryMode("daily");
                    triggerSensory("selection");
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    dividendEntryMode === "daily"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Diario (Data Exata)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDividendEntryMode("monthly");
                    triggerSensory("selection");
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    dividendEntryMode === "monthly"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Extrato do Mes
                </button>
              </div>

              {dividendEntryMode === "daily" ? (
                <DatePicker value={date} onValueChange={setDate} />
              ) : (
                <div className="flex flex-col gap-1">
                  <MonthPicker value={month} onValueChange={setMonth} />
                  <p className="text-[10px] text-muted-foreground">
                    Gravado como {month}-01 com tag [MENSAL].
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface/40 p-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={syncCash} onCheckedChange={(c) => setSyncCash(!!c)} />
                <span className="font-medium text-foreground">Creditar o rendimento diretamente no Caixa da carteira</span>
              </label>
              <p className="text-[11px] text-muted-foreground pl-6">
                Aumenta a liquidez em caixa para reinvestimentos sem registrar novo aporte financeiro do bolso.
              </p>
            </div>
          </div>
        )}

        {/* 4. MODO SPLIT / DESDOBRAMENTO */}
        {(type === "split" || type === "reverse_split") && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quick-split-factor" className="text-xs font-semibold text-foreground">
                  {type === "split" ? "Fator (1 para N)" : "Fator (N para 1)"}
                </label>
                <Input
                  id="quick-split-factor"
                  type="number"
                  min="2"
                  step="1"
                  value={splitFactor}
                  onChange={(e) => setSplitFactor(Number(e.target.value) || 2)}
                  className="font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Data do Evento
                </label>
                <DatePicker value={date} onValueChange={setDate} />
              </div>
            </div>

            {targetAsset && (
              <div className="flex flex-col gap-1 rounded-xl bg-surface-hover/60 p-3 text-xs">
                <span className="text-muted-foreground">Posição Resultante:</span>
                <span className="font-mono font-bold text-foreground">
                  {type === "split"
                    ? `${Math.round(targetAsset.quantity * splitFactor * 10000) / 10000} cotas a `
                    : `${Math.round((targetAsset.quantity / splitFactor) * 10000) / 10000} cotas a `}
                  <MoneyText
                    cents={numberToCents(
                      type === "split"
                        ? targetAsset.average_price / splitFactor
                        : targetAsset.average_price * splitFactor,
                    )}
                  />
                </span>
                <span className="text-[10px] text-muted-foreground">
                  O custo total da posição é rigorosamente preservado.
                </span>
              </div>
            )}
          </div>
        )}

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={recordOrder.isPending}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={recordOrder.isPending}
            className="w-full sm:w-auto"
          >
            {recordOrder.isPending ? "Processando..." : "Confirmar Operação"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
