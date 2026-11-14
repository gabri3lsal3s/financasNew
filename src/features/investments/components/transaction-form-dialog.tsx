import { useMemo, useRef, useState } from "react";
import { Alert, Button, ConfirmDialog, Modal, ModalFooter, MoneyInput, MoneyText, NumberStepperInput, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { todayISO } from "@/domain/debts";
import {
  calculateFixedIncomeBalance,
  calculateWeightedAveragePrice,
  getAssetPricingMode,
  isCashAssetClass,
  sellAssetPosition,
} from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import {
  useCreatePortfolioContribution,
  useCreatePortfolioDividend,
  useCreatePortfolioTransaction,
  useDeletePortfolioContribution,
  useDeletePortfolioTransaction,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioPosition,
  useUpdatePortfolioAsset,
  useUpdatePortfolioContribution,
  useUpdatePortfolioTransaction,
} from "@/state";
import { numberToCents, parseDecimalNumber } from "@/domain/money";
import type { DbInsert, PortfolioAsset, PortfolioContribution, PortfolioTransaction, PortfolioTransactionType } from "@/types";

export interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: PortfolioAsset;
  /** Transação em edição — quando informada, o diálogo salva (update) em vez de criar. */
  transaction?: PortfolioTransaction | null;
  /** Aporte vinculado conhecido (quando aberto a partir do extrato com via aporte). */
  linkedContribution?: PortfolioContribution;
}

interface TransactionFormContentProps {
  asset: PortfolioAsset;
  transaction?: PortfolioTransaction | null;
  linkedContribution?: PortfolioContribution;
  onClose: () => void;
}

const TX_OPTIONS: { value: PortfolioTransactionType; label: string }[] = [
  { value: "buy", label: "Compra" },
  { value: "sell", label: "Venda" },
  { value: "dividend", label: "Dividendo" },
  { value: "jcp", label: "Juros sobre capital (JCP)" },
  { value: "fii_yield", label: "Rendimento de FII" },
  { value: "subscription", label: "Subscrição" },
  { value: "split", label: "Split (desdobramento)" },
  { value: "reverse_split", label: "Grupamento (reverse split)" },
];

const NEEDS_QTY_PRICE: readonly PortfolioTransactionType[] = ["buy", "sell", "subscription"];
const IS_DIVIDEND: readonly PortfolioTransactionType[] = ["dividend", "jcp", "fii_yield"];
const IS_SPLIT: readonly PortfolioTransactionType[] = ["split", "reverse_split"];

export type FundingSource = "pocket" | "cash";

function TransactionFormContent({
  asset,
  transaction = null,
  linkedContribution = undefined,
  onClose,
}: TransactionFormContentProps) {
  const createTx = useCreatePortfolioTransaction();
  const updateTx = useUpdatePortfolioTransaction();
  const deleteTx = useDeletePortfolioTransaction();
  const createContrib = useCreatePortfolioContribution();
  const updateContrib = useUpdatePortfolioContribution();
  const deleteContrib = useDeletePortfolioContribution();
  const createDividend = useCreatePortfolioDividend();
  const updateAsset = useUpdatePortfolioAsset();
  const assetsQuery = usePortfolioAssets();
  const contributionsQuery = usePortfolioContributions();
  const positionQuery = usePortfolioPosition();

  const usdRate = positionQuery.rows.find((r) => r.currency === "USD")?.usdRate ?? 5.25;

  const allAssets = assetsQuery.data ?? [];
  const cashAsset = allAssets.find((a) => a.ticker.toUpperCase() === "CAIXA" || isCashAssetClass(a.asset_class));
  const cashBalance = typeof cashAsset?.quantity === "number" ? cashAsset.quantity : 0;

  // Localiza contribuição associada se não foi passada diretamente
  const existingContribution = useMemo(() => {
    if (linkedContribution) return linkedContribution;
    if (!transaction || transaction.type !== "buy") return undefined;
    return (contributionsQuery.data ?? []).find(
      (c) => c.asset_id === asset.id && c.date === transaction.date,
    );
  }, [linkedContribution, transaction, asset.id, contributionsQuery.data]);

  const [type, setType] = useState<PortfolioTransactionType>(transaction?.type ?? "buy");
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [quantity, setQuantity] = useState(transaction ? String(transaction.quantity) : "");
  const [price, setPrice] = useState(transaction ? String(transaction.price) : "");
  const [amountCents, setAmountCents] = useState(transaction ? numberToCents(transaction.total) : 0);

  const pricingMode = getAssetPricingMode(asset);
  const isCash = isCashAssetClass(asset.asset_class);
  const isTotalValue = !isCash && pricingMode === "total_value";

  const options = useMemo(() => {
    if (isTotalValue) {
      return [
        { value: "buy" as const, label: "Aplicação / Aporte" },
        { value: "sell" as const, label: "Resgate" },
        { value: "dividend" as const, label: "Rendimento / Cupom" },
      ];
    }
    return TX_OPTIONS;
  }, [isTotalValue]);

  // Origem/Destino dos recursos: se tem contribuição vinculada, foi pocket; senão cash
  const [fundingSource, setFundingSource] = useState<FundingSource>(() => {
    if (transaction?.type === "buy") {
      return existingContribution ? "pocket" : "cash";
    }
    return cashBalance > 0 ? "cash" : "pocket";
  });

  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = transaction !== null;
  const pending =
    isSubmitting ||
    createTx.isPending ||
    updateTx.isPending ||
    deleteTx.isPending ||
    createContrib.isPending ||
    updateContrib.isPending ||
    deleteContrib.isPending ||
    createDividend.isPending ||
    updateAsset.isPending;

  const withQtyPrice = NEEDS_QTY_PRICE.includes(type);
  const withAmount = IS_DIVIDEND.includes(type);
  const withFactor = IS_SPLIT.includes(type);

  const parseNumber = parseDecimalNumber;
  const parsedQty = parseNumber(quantity);
  const parsedPrice = parseNumber(price);

  const totalPreview =
    isTotalValue && amountCents > 0
      ? amountCents / 100
      : withQtyPrice
        ? Math.round(
            (Number.isFinite(parsedQty) ? parsedQty : 0) *
              (Number.isFinite(parsedPrice) ? parsedPrice : 0) *
              100,
          ) / 100
        : withAmount
          ? amountCents / 100
          : 0;

  const canSubmit =
    !pending &&
    date !== "" &&
    (isTotalValue
      ? totalPreview > 0
      : withQtyPrice
        ? totalPreview > 0
        : withAmount
          ? amountCents > 0
          : withFactor
            ? parsedQty > 0
            : false);

  const submit = async () => {
    if (!canSubmit || isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const orderAmount = totalPreview;

      // Validação contra venda a descoberto
      if (type === "sell") {
        if (isTotalValue) {
          const maxBalance = asset.fixed_income_metadata
            ? calculateFixedIncomeBalance({
                baseValue:
                  asset.fixed_income_metadata.base_value !== undefined &&
                  asset.fixed_income_metadata.base_value !== null &&
                  asset.fixed_income_metadata.base_value > 0
                    ? asset.fixed_income_metadata.base_value
                    : asset.average_price > 0
                      ? asset.average_price
                      : asset.quantity,
                baseDate: asset.fixed_income_metadata.base_date,
                initialInvestmentDate: asset.fixed_income_metadata.initial_investment_date,
                maturityDate: asset.fixed_income_metadata.maturity_date,
                rateType: asset.fixed_income_metadata.rate_type,
                rateValue: asset.fixed_income_metadata.rate_value,
                isTaxExempt: asset.fixed_income_metadata.is_tax_exempt,
                manualTaxRatePct: asset.fixed_income_metadata.manual_tax_rate_pct,
                totalCost: asset.average_price > 0 ? asset.average_price : asset.quantity,
                today: date,
              }).grossValue
            : asset.average_price > 0
              ? asset.average_price
              : asset.quantity;

          const effectiveMax = Math.max(
            maxBalance,
            asset.average_price > 0 ? asset.average_price : asset.quantity,
          );

          if (orderAmount > effectiveMax + 0.01) {
            setError(
              `Valor a resgatar (${asset.currency} ${orderAmount.toFixed(2)}) excede o saldo disponível (${asset.currency} ${effectiveMax.toFixed(2)}).`,
            );
            triggerSensory("destructive");
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            return;
          }
        } else if (parsedQty > asset.quantity) {
          setError(`Quantidade a vender (${parsedQty}) excede a custódia atual (${asset.quantity} cotas).`);
          triggerSensory("destructive");
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          return;
        }
      }

      const base = { asset_id: asset.id, type, date };
      let payload: Omit<DbInsert<PortfolioTransaction>, "user_id">;
      if (isTotalValue) {
        payload = { ...base, quantity: 1, price: orderAmount, total: orderAmount };
      } else if (withQtyPrice) {
        payload = { ...base, quantity: parsedQty, price: parsedPrice, total: totalPreview };
      } else if (withAmount) {
        payload = { ...base, quantity: 0, price: 0, total: amountCents / 100 };
      } else {
        payload = { ...base, quantity: parsedQty, price: 0, total: 0 };
      }

      // Converte totalPreview para BRL se for USD
      const totalBRL =
        asset.currency === "USD" ? Math.round(totalPreview * usdRate * 100) / 100 : totalPreview;

      if (isEdit && transaction) {
        await updateTx.mutateAsync({ id: transaction.id, patch: payload });

        // Se for compra, reconcilia a origem dos recursos (Pocket vs Cash)
        if (type === "buy") {
          const wasPocket = Boolean(existingContribution);
          const isNowPocket = fundingSource === "pocket";

          if (wasPocket && !isNowPocket) {
            // Mudou de Bolso para Caixa: remove aporte e debita Caixa
            if (existingContribution) {
              await deleteContrib.mutateAsync(existingContribution);
            }
            if (cashAsset) {
              const currentBal = Number(cashAsset.quantity ?? 0);
              const newBal = Math.max(0, Math.round((currentBal - totalBRL) * 100) / 100);
              await updateAsset.mutateAsync({
                id: cashAsset.id,
                patch: { quantity: newBal, average_price: 1 },
              });
            }
          } else if (!wasPocket && isNowPocket) {
            // Mudou de Caixa para Bolso: cria aporte e estorna Caixa
            await createContrib.mutateAsync({
              asset_id: asset.id,
              date,
              amount: totalBRL,
              notes: `Aporte · Compra de ${asset.ticker}`,
            });
            if (cashAsset) {
              const currentBal = Number(cashAsset.quantity ?? 0);
              const newBal = Math.round((currentBal + totalBRL) * 100) / 100;
              await updateAsset.mutateAsync({
                id: cashAsset.id,
                patch: { quantity: newBal, average_price: 1 },
              });
            }
          } else if (wasPocket && isNowPocket && existingContribution) {
            // Continuou Pocket: atualiza valor e data do aporte vinculado se mudaram
            if (existingContribution.amount !== totalBRL || existingContribution.date !== date) {
              await updateContrib.mutateAsync({
                id: existingContribution.id,
                input: { amount: totalBRL, date },
              });
            }
          } else if (!wasPocket && !isNowPocket && cashAsset) {
            // Continuou Caixa: ajusta o saldo do Caixa pela diferença de valor
            const prevTotalBRL =
              asset.currency === "USD" ? Math.round(transaction.total * usdRate * 100) / 100 : transaction.total;
            const delta = totalBRL - prevTotalBRL;
            if (delta !== 0) {
              const currentBal = Number(cashAsset.quantity ?? 0);
              const newBal = Math.max(0, Math.round((currentBal - delta) * 100) / 100);
              await updateAsset.mutateAsync({
                id: cashAsset.id,
                patch: { quantity: newBal, average_price: 1 },
              });
            }
          }
        }
      } else {
        // Nova transação
        await createTx.mutateAsync(payload);

        // 1. Compra ou Subscrição: atualiza o Preço Médio ponderado e quantidade em portfolio_assets
        if (type === "buy" || type === "subscription") {
          if (isTotalValue) {
            const currentCost = asset.average_price > 0 ? asset.average_price : asset.quantity;
            const newTotalApplied = Math.round((currentCost + orderAmount) * 100) / 100;

            const updatedFiMetadata = asset.fixed_income_metadata
              ? {
                  ...asset.fixed_income_metadata,
                  base_date: date,
                  base_value: newTotalApplied,
                  initial_investment_date:
                    asset.fixed_income_metadata.initial_investment_date ??
                    asset.fixed_income_metadata.base_date,
                  initial_investment_value:
                    (asset.fixed_income_metadata.initial_investment_value ?? currentCost) + orderAmount,
                }
              : null;

            await updateAsset.mutateAsync({
              id: asset.id,
              patch: {
                quantity: 1,
                average_price: newTotalApplied,
                ...(updatedFiMetadata ? { fixed_income_metadata: updatedFiMetadata } : {}),
              },
            });
          } else {
            const lotCalc = calculateWeightedAveragePrice(
              asset.quantity,
              asset.average_price,
              parsedQty,
              parsedPrice > 0 ? parsedPrice : totalPreview / (parsedQty || 1),
            );
            await updateAsset.mutateAsync({
              id: asset.id,
              patch: {
                quantity: lotCalc.newQuantity,
                average_price: lotCalc.newAveragePrice,
              },
            });
          }

          if (fundingSource === "pocket") {
            await createContrib.mutateAsync({
              asset_id: asset.id,
              date,
              amount: totalBRL,
              notes: `Aporte · Compra de ${asset.ticker}`,
            });
          } else if (fundingSource === "cash" && cashAsset) {
            const currentBal = Number(cashAsset.quantity ?? 0);
            const newBal = Math.max(0, Math.round((currentBal - totalBRL) * 100) / 100);
            await updateAsset.mutateAsync({
              id: cashAsset.id,
              patch: { quantity: newBal, average_price: 1 },
            });
          }
        } else if (type === "sell") {
          // 2. Venda / Resgate: reduz quantidade mantendo PM em portfolio_assets
          let netCreditBRL = totalBRL;

          if (isTotalValue) {
            const effectiveAppliedCost =
              asset.fixed_income_metadata?.initial_investment_value !== undefined &&
              asset.fixed_income_metadata?.initial_investment_value !== null &&
              asset.fixed_income_metadata.initial_investment_value > 0
                ? asset.fixed_income_metadata.initial_investment_value
                : asset.average_price > 0
                  ? asset.average_price
                  : (asset.fixed_income_metadata?.base_value ?? asset.quantity);

            let remainingGrossBalance: number;
            let remainingCost: number;

            if (asset.fixed_income_metadata) {
              const baseValue =
                asset.fixed_income_metadata.base_value !== undefined &&
                asset.fixed_income_metadata.base_value !== null &&
                asset.fixed_income_metadata.base_value > 0
                  ? asset.fixed_income_metadata.base_value
                  : effectiveAppliedCost;

              const fiRes = calculateFixedIncomeBalance({
                baseValue,
                baseDate: asset.fixed_income_metadata.base_date,
                initialInvestmentDate: asset.fixed_income_metadata.initial_investment_date,
                maturityDate: asset.fixed_income_metadata.maturity_date,
                rateType: asset.fixed_income_metadata.rate_type,
                rateValue: asset.fixed_income_metadata.rate_value,
                isTaxExempt: asset.fixed_income_metadata.is_tax_exempt,
                manualTaxRatePct: asset.fixed_income_metadata.manual_tax_rate_pct,
                totalCost: effectiveAppliedCost,
                today: date,
              });

              const grossBalance = Math.max(fiRes.grossValue, effectiveAppliedCost);
              const isFullRedemption = grossBalance > 0
                ? orderAmount >= grossBalance - 0.01
                : orderAmount >= effectiveAppliedCost - 0.01;

              const proportion = grossBalance > 0 ? Math.min(1, orderAmount / grossBalance) : 1;
              const projectedTax = asset.fixed_income_metadata.is_tax_exempt
                ? 0
                : Math.round(fiRes.taxAmount * proportion * 100) / 100;

              netCreditBRL = Math.max(0, Math.round((totalBRL - projectedTax) * 100) / 100);

              remainingGrossBalance = isFullRedemption
                ? 0
                : Math.max(0, Math.round((grossBalance - orderAmount) * 100) / 100);
              remainingCost = isFullRedemption
                ? 0
                : Math.max(0, Math.round(effectiveAppliedCost * (1 - proportion) * 100) / 100);
            } else {
              const isFullRedemption = orderAmount >= effectiveAppliedCost;
              remainingGrossBalance = isFullRedemption
                ? 0
                : Math.round(Math.max(0, effectiveAppliedCost - orderAmount) * 100) / 100;
              remainingCost = remainingGrossBalance;
            }

            const updatedFiMetadata = asset.fixed_income_metadata
              ? {
                  ...asset.fixed_income_metadata,
                  base_date: remainingGrossBalance > 0 ? date : asset.fixed_income_metadata.base_date,
                  base_value: remainingGrossBalance,
                  initial_investment_value: remainingCost,
                }
              : null;

            await updateAsset.mutateAsync({
              id: asset.id,
              patch: {
                quantity: remainingGrossBalance > 0 ? 1 : 0,
                average_price: remainingCost,
                ...(updatedFiMetadata ? { fixed_income_metadata: updatedFiMetadata } : {}),
              },
            });
          } else {
            const sellResult = sellAssetPosition({
              currentQuantity: asset.quantity,
              currentAveragePrice: asset.average_price,
              sellQuantity: parsedQty,
              sellPrice: parsedPrice > 0 ? parsedPrice : totalPreview / (parsedQty || 1),
            });
            await updateAsset.mutateAsync({
              id: asset.id,
              patch: {
                quantity: sellResult.remainingQuantity,
                average_price: sellResult.remainingAveragePrice,
              },
            });
          }

          // Credita no Caixa em BRL se selecionado (valor líquido descontado de IRRF se aplicável)
          if (fundingSource === "cash" && cashAsset && netCreditBRL > 0) {
            const currentBal = Number(cashAsset.quantity ?? 0);
            const newBal = Math.round((currentBal + netCreditBRL) * 100) / 100;
            await updateAsset.mutateAsync({
              id: cashAsset.id,
              patch: { quantity: newBal, average_price: 1 },
            });
          }
        } else if (type === "split" && parsedQty > 0) {
          // 3. Desdobramento
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: Math.round(asset.quantity * parsedQty * 10000) / 10000,
              average_price: Math.round((asset.average_price / parsedQty) * 10000) / 10000,
            },
          });
        } else if (type === "reverse_split" && parsedQty > 0) {
          // 4. Grupamento
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: Math.round((asset.quantity / parsedQty) * 10000) / 10000,
              average_price: Math.round(asset.average_price * parsedQty * 10000) / 10000,
            },
          });
        } else if (withAmount) {
          // 5. Proventos (Dividendo, JCP, FII Yield)
          await createDividend.mutateAsync({
            asset_id: asset.id,
            ticker: asset.ticker,
            date,
            amount: totalPreview,
            notes: `Rendimento de ${asset.ticker}`,
            sync_cash: fundingSource === "cash" && totalBRL > 0,
            cash_amount: fundingSource === "cash" && totalBRL > 0 ? totalBRL : null,
          });

          if (fundingSource === "cash" && cashAsset && totalBRL > 0) {
            const currentBal = Number(cashAsset.quantity ?? 0);
            const newBal = Math.round((currentBal + totalBRL) * 100) / 100;
            await updateAsset.mutateAsync({
              id: cashAsset.id,
              patch: { quantity: newBal, average_price: 1 },
            });
          }
        }
      }

      triggerSensory("success");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const confirmDeleteTx = async () => {
    if (!transaction) return;
    setError(null);
    try {
      await deleteTx.mutateAsync(transaction.id);
      triggerSensory("destructive");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            void submit();
          }
        }}
        className="mt-4 flex flex-col gap-3.5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Tipo de operação
            <Select
              value={type}
              onValueChange={(value) => setType(value as PortfolioTransactionType)}
              options={options}
              ariaLabel="Tipo de operação"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Data
            <DatePicker value={date} onValueChange={setDate} ariaLabel="Data da transação" />
          </label>
        </div>

        {withQtyPrice ? (
          <>
            {isTotalValue ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="transaction-rf-amount" className="text-xs font-semibold text-foreground">
                  {type === "sell" ? "Valor a resgatar" : "Valor do aporte / aplicação"} ({asset.currency})
                </label>
                <MoneyInput
                  id="transaction-rf-amount"
                  cents={amountCents > 0 ? amountCents : totalPreview > 0 ? numberToCents(totalPreview) : 0}
                  currency={asset.currency}
                  onCentsChange={(cents) => {
                    setAmountCents(cents);
                    setPrice(String(cents / 100));
                    setQuantity("1");
                  }}
                  placeholder={asset.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                  aria-label={type === "sell" ? "Valor a resgatar" : "Valor da aplicação"}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                  Quantidade
                  <NumberStepperInput
                    value={quantity}
                    step={1}
                    min={0}
                    onValueChange={setQuantity}
                    placeholder="Ex.: 10"
                    ariaLabel="Quantidade"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                  Preço unitário ({asset.currency})
                  <NumberStepperInput
                    value={price}
                    step={0.01}
                    min={0}
                    onValueChange={setPrice}
                    placeholder="Ex.: 42,50"
                    ariaLabel="Preço unitário"
                  />
                </label>
              </div>
            )}
            <p className="num text-xs text-muted-foreground">
              Total: <span className="font-semibold text-foreground"><MoneyText cents={numberToCents(totalPreview)} currency={asset.currency} /></span>
            </p>

            {/* Seletor exclusivo de Origem dos Recursos para Compras */}
            {type === "buy" && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-subtle p-3 text-xs">
                <span className="font-semibold text-foreground">Origem dos recursos desta compra:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFundingSource("pocket");
                      triggerSensory("selection");
                    }}
                    className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium border transition-colors cursor-pointer text-left ${
                      fundingSource === "pocket"
                        ? "border-positive-strong bg-positive/10 text-positive-strong font-semibold shadow-2xs"
                        : "border-border/60 bg-surface hover:bg-surface-hover text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold">Dinheiro Novo (Aporte do Bolso)</div>
                    <div className="text-[10px] opacity-80">Transferido da conta corrente (não altera o Caixa)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFundingSource("cash");
                      triggerSensory("selection");
                    }}
                    className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium border transition-colors cursor-pointer text-left ${
                      fundingSource === "cash"
                        ? "border-portfolio bg-portfolio/10 text-portfolio font-semibold shadow-2xs"
                        : "border-border/60 bg-surface hover:bg-surface-hover text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold">Saldo da Corretora (Caixa)</div>
                    <div className="text-[10px] opacity-80">
                      Disponível: R$ {cashBalance.toFixed(2)} (abate do saldo em Caixa)
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Seletor de Destino dos Recursos para Vendas */}
            {type === "sell" && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-subtle p-3 text-xs">
                <span className="font-semibold text-foreground">Destino dos recursos desta venda:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFundingSource("cash");
                      triggerSensory("selection");
                    }}
                    className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium border transition-colors cursor-pointer text-left ${
                      fundingSource === "cash"
                        ? "border-portfolio bg-portfolio/10 text-portfolio font-semibold shadow-2xs"
                        : "border-border/60 bg-surface hover:bg-surface-hover text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold">Creditar no Caixa</div>
                    <div className="text-[10px] opacity-80">
                      Adiciona {asset.currency === "USD" ? `R$ ${(Math.round(totalPreview * usdRate * 100) / 100).toFixed(2)}` : `R$ ${totalPreview.toFixed(2)}`} ao seu ativo Caixa
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFundingSource("pocket");
                      triggerSensory("selection");
                    }}
                    className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium border transition-colors cursor-pointer text-left ${
                      fundingSource === "pocket"
                        ? "border-positive-strong bg-positive/10 text-positive-strong font-semibold shadow-2xs"
                        : "border-border/60 bg-surface hover:bg-surface-hover text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold">Retirada Direta</div>
                    <div className="text-[10px] opacity-80">
                      Transferência direta para sua conta (não altera o Caixa)
                    </div>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}

        {withAmount ? (
          <>
            <label htmlFor="transaction-dividend-amount" className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Valor do provento ({asset.currency})
              <MoneyInput
                id="transaction-dividend-amount"
                cents={amountCents}
                currency={asset.currency}
                onCentsChange={setAmountCents}
                placeholder={asset.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Valor do provento"
              />
            </label>

            {/* Seletor de Destino dos Proventos */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-subtle p-3 text-xs">
              <span className="font-semibold text-foreground">Destino do valor do provento:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFundingSource("cash");
                    triggerSensory("selection");
                  }}
                  className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium border transition-colors cursor-pointer text-left ${
                    fundingSource === "cash"
                      ? "border-portfolio bg-portfolio/10 text-portfolio font-semibold shadow-2xs"
                      : "border-border/60 bg-surface hover:bg-surface-hover text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold">Creditar no Caixa</div>
                  <div className="text-[10px] opacity-80">
                    Soma R$ {(Math.round((amountCents / 100) * (asset.currency === "USD" ? usdRate : 1) * 100) / 100).toFixed(2)} ao Caixa
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFundingSource("pocket");
                    triggerSensory("selection");
                  }}
                  className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium border transition-colors cursor-pointer text-left ${
                    fundingSource === "pocket"
                      ? "border-positive-strong bg-positive/10 text-positive-strong font-semibold shadow-2xs"
                      : "border-border/60 bg-surface hover:bg-surface-hover text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold">Conta Externa</div>
                  <div className="text-[10px] opacity-80">
                    Apenas registra o histórico sem alterar o Caixa
                  </div>
                </button>
              </div>
            </div>
          </>
        ) : null}

        {withFactor ? (
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Fator ({type === "split" ? "2 = 2:1 (dobra cotas)" : "2 = 1:2 (reduz cotas)"})
            <NumberStepperInput
              value={quantity}
              step={1}
              min={0}
              onValueChange={setQuantity}
              placeholder="Ex.: 2"
              ariaLabel="Fator do desdobramento"
            />
          </label>
        ) : null}

        {error ? <Alert variant="error">{error}</Alert> : null}

        <ModalFooter
          destructiveAction={
            isEdit ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                className="text-critical-strong hover:bg-critical/10"
              >
                Excluir lançamento
              </Button>
            ) : undefined
          }
        >
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {pending ? "Salvando…" : isEdit ? "Salvar" : "Registrar"}
          </Button>
        </ModalFooter>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir lançamento?"
        description="A transação será removida e o ledger da posição recalculado automaticamente."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteTx.isPending}
        onConfirm={() => void confirmDeleteTx()}
      />
    </>
  );
}

/** Registro/edição de transação da carteira (§3.11.2) — alimenta o ledger derivado. */
export function TransactionFormDialog({
  open,
  onOpenChange,
  asset,
  transaction = null,
  linkedContribution = undefined,
}: TransactionFormDialogProps) {
  const isEdit = transaction !== null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Transação · ${asset.ticker}`}
      description={
        isEdit
          ? "Atualize a operação — o ledger, aportes vinculados e caixa derivado são recalculados."
          : "O ledger e o caixa derivado são recalculados a partir das transações."
      }
      size="lg"
      showCalculator
    >
      {open ? (
        <TransactionFormContent
          key={transaction?.id ?? "new-tx"}
          asset={asset}
          transaction={transaction}
          linkedContribution={linkedContribution}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
