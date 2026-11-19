import { numberToCents } from "@/domain/money";
import { resolveDividendDate, resolveDividendNote, type DividendEntryMode } from "@/domain/portfolio/dividends";
import { buildFixedIncomeSellNotes, type FixedIncomeRedemptionPreviewResult } from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsBRL } from "@/services/masks";
import { pushToast } from "@/services/toast";
import type {
  PortfolioAsset,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioTransaction,
  PortfolioTransactionType,
} from "@/types";
import { flagsFromFundingSource, type FundingSource } from "../funding-source-utils";

export interface QuickTransactionSubmitParams {
  targetAsset: PortfolioAsset;
  cashAsset: PortfolioAsset | null;
  type: PortfolioTransactionType;
  date: string;
  month: string;
  dividendEntryMode: DividendEntryMode;
  parsedQty: number;
  priceCents: number;
  totalCents: number;
  effectiveDividendTotalBRL: number;
  isCash: boolean;
  isTotalValue: boolean;
  isDividendType: boolean;
  isCorporateEvent: boolean;
  computedEventFactor: number;
  buyFundingSource: FundingSource;
  creditCash: boolean;
  recordWithdrawal?: boolean;
  customInitialDate?: string | null;
  usdRate: number;
  fxRateBRL?: number | null;
  appliedCostCents: number;
  fiSellResult: FixedIncomeRedemptionPreviewResult | null;
  editDividend: PortfolioDividend | null;
  editTransaction: PortfolioTransaction | null;
  linkedContribution?: PortfolioContribution | null;
  initialFundingSource?: FundingSource;
  recordOrder: (payload: RecordOrderMutationArg) => Promise<unknown>;
  updateTx: (payload: { id: string; patch: Partial<PortfolioTransaction> }) => Promise<unknown>;
  updateDividend: (payload: {
    id: string;
    patch: Partial<PortfolioDividend>;
    syncCash: boolean;
    previousSyncCash: boolean;
    previousCashAmount: number;
  }) => Promise<unknown>;
  deleteContribution?: (payload: { id: string; skipTransactionCascade?: boolean; suppressToast?: boolean }) => Promise<unknown>;
  createContribution?: (payload: {
    amount: number;
    date: string;
    asset_id?: string | null;
    notes?: string | null;
    suppressToast?: boolean;
  }) => Promise<unknown>;
  updateContribution?: (payload: {
    id: string;
    input: Partial<PortfolioContribution>;
    suppressToast?: boolean;
  }) => Promise<unknown>;
  updateAsset?: (payload: { id: string; patch: { quantity: number; average_price: number } }) => Promise<unknown>;
}

export interface RecordOrderMutationArg {
  asset: PortfolioAsset;
  type: PortfolioTransactionType;
  date: string;
  quantity: number;
  price: number;
  total: number;
  syncCash: boolean;
  cashAsset: PortfolioAsset | null;
  recordContribution: boolean;
  recordWithdrawal?: boolean;
  notes?: string;
  usdRate: number;
  fxRateBRL?: number;
  appliedCostBasis?: number;
  preRedemptionHoldingCost?: number;
  customTaxAmount?: number;
  customTaxRatePct?: number;
  netCreditAmount?: number;
  customInitialInvestmentDate?: string | null;
}

export function validateQuickTransactionInput(p: QuickTransactionSubmitParams): {
  error: string | null;
  total: number;
  price: number;
} {
  const price = p.priceCents / 100;
  const total = p.isCash
    ? p.totalCents / 100
    : p.isTotalValue
      ? (p.totalCents || p.priceCents) / 100
      : p.isDividendType
        ? p.effectiveDividendTotalBRL
        : Math.round(p.parsedQty * price * 100) / 100;

  if (p.isTotalValue) {
    if (p.type === "buy" && total <= 0) return { error: "Informe o valor do aporte.", total, price };
    if (p.type === "sell") {
      if (total <= 0) return { error: "Informe o valor do resgate.", total, price };
      const maxBalance = p.fiSellResult?.grossBalance ?? p.targetAsset.average_price;
      if (!p.editTransaction && maxBalance > 0 && total > maxBalance * 1.005) {
        return {
          error: `Valor excede o saldo bruto acumulado (${formatCentsAsBRL(numberToCents(maxBalance))}).`,
          total,
          price,
        };
      }
    }
  } else if (p.type === "buy" || p.type === "sell" || p.type === "subscription") {
    if (!p.isCash && p.parsedQty <= 0) return { error: "Informe uma quantidade válida de cotas.", total, price };
    if (!p.isCash && price <= 0) return { error: "Informe o preço unitário da ordem.", total, price };
    if (p.isCash && total <= 0) return { error: "Informe o valor da movimentação em caixa.", total, price };
    if (!p.editTransaction && p.type === "sell" && !p.isCash && p.parsedQty > p.targetAsset.quantity) {
      return { error: `Quantidade excede a custódia atual (${p.targetAsset.quantity} cotas).`, total, price };
    }
  }

  if (p.isDividendType && total <= 0) {
    return { error: "Informe o valor válido do provento recebido.", total, price };
  }
  if (p.isCorporateEvent && (p.computedEventFactor <= 1 || !Number.isFinite(p.computedEventFactor))) {
    return {
      error:
        p.type === "split"
          ? "Para desdobro ou bonificação, a proporção final (Para) deve ser maior que a inicial (De)."
          : "Para grupamento, a proporção inicial (De) deve ser maior que a final (Para).",
      total,
      price,
    };
  }
  return { error: null, total, price };
}

export async function executeQuickTransactionSubmit(
  p: QuickTransactionSubmitParams,
  total: number,
  price: number,
): Promise<string | null> {
  try {
    if (p.editDividend) {
      const resolvedDate = resolveDividendDate(p.dividendEntryMode, p.dividendEntryMode === "monthly" ? p.month : p.date);
      const resolvedNotes = resolveDividendNote(p.dividendEntryMode, p.editDividend.notes ?? "", p.type);
      const rate = p.targetAsset.currency === "USD" ? p.usdRate : 1;
      const cashAmountBRL = Math.round(total * rate * 100) / 100;
      await p.updateDividend({
        id: p.editDividend.id,
        patch: {
          amount: total,
          date: resolvedDate,
          ticker: p.targetAsset.ticker,
          asset_id: p.targetAsset.id,
          notes: resolvedNotes,
          sync_cash: Boolean(p.creditCash && cashAmountBRL > 0),
          cash_amount: p.creditCash && cashAmountBRL > 0 ? cashAmountBRL : null,
        },
        syncCash: p.creditCash,
        previousSyncCash: Boolean(p.editDividend.sync_cash),
        previousCashAmount: p.editDividend.cash_amount ?? p.editDividend.amount,
      });
      return null;
    }

    if (p.editTransaction) {
      const resolvedQty = p.isCorporateEvent
        ? Math.round(p.computedEventFactor * 1000000) / 1000000
        : p.isTotalValue ? 1 : p.parsedQty;

      const effectiveRate = p.fxRateBRL && p.fxRateBRL > 0
        ? p.fxRateBRL
        : p.targetAsset.currency !== "BRL"
          ? (p.usdRate > 1 ? p.usdRate : 5.25)
          : 1;

      const newTotalBRL = Math.round(total * effectiveRate * 100) / 100;

      const prevTotalNative = p.editTransaction.total > 0
        ? p.editTransaction.total
        : p.editTransaction.quantity > 0 && p.editTransaction.price > 0
          ? Math.round(p.editTransaction.quantity * p.editTransaction.price * 100) / 100
          : 0;

      const prevFxRate = p.editTransaction.fx_rate && p.editTransaction.fx_rate > 0
        ? p.editTransaction.fx_rate
        : p.targetAsset.currency !== "BRL"
          ? (p.usdRate > 1 ? p.usdRate : 5.25)
          : 1;

      const prevTotalBRL = Math.round(prevTotalNative * prevFxRate * 100) / 100;

      // Reconciliação retroativa da origem dos recursos (Caixa vs Dinheiro Novo/Aporte) para compras
      if (p.type === "buy" || p.type === "subscription") {
        const initialSource = p.initialFundingSource ?? (p.linkedContribution ? "pocket" : "cash");
        const currentSource = p.buyFundingSource;

        if (initialSource === "pocket" && currentSource === "cash") {
          // Transição: Dinheiro Novo (Bolso) -> Saldo em Caixa
          // 1. Remove o aporte vinculado (evita que continue constando como aporte do mês)
          if (p.linkedContribution && p.deleteContribution) {
            await p.deleteContribution({
              id: p.linkedContribution.id,
              skipTransactionCascade: true,
              suppressToast: true,
            });
          }
          // 2. Debita o valor atualizado do Caixa
          if (p.cashAsset && p.updateAsset && newTotalBRL > 0) {
            const newCashQty = Math.max(0, Math.round((p.cashAsset.quantity - newTotalBRL) * 100) / 100);
            await p.updateAsset({
              id: p.cashAsset.id,
              patch: {
                quantity: newCashQty,
                average_price: 1,
              },
            });
          }
        } else if (initialSource === "cash" && currentSource === "pocket") {
          // Transição: Saldo em Caixa -> Dinheiro Novo (Bolso)
          // 1. Devolve o montante previamente debitado ao Caixa
          if (p.cashAsset && p.updateAsset && prevTotalBRL > 0) {
            const newCashQty = Math.round((p.cashAsset.quantity + prevTotalBRL) * 100) / 100;
            await p.updateAsset({
              id: p.cashAsset.id,
              patch: {
                quantity: newCashQty,
                average_price: 1,
              },
            });
          }
          // 2. Cria o registro de aporte externo
          if (p.createContribution && newTotalBRL > 0) {
            await p.createContribution({
              amount: newTotalBRL,
              date: p.date,
              asset_id: p.targetAsset.id,
              notes: p.targetAsset.currency === "USD"
                ? `Aporte em ${p.targetAsset.ticker} ($${total.toFixed(2)})`
                : `Aporte em ${p.targetAsset.ticker}`,
              suppressToast: true,
            });
          }
        } else if (initialSource === "cash" && currentSource === "cash") {
          // Permanece vindo do Caixa: ajusta eventual diferença de valor no saldo do Caixa
          const delta = Math.round((newTotalBRL - prevTotalBRL) * 100) / 100;
          if (Math.abs(delta) > 0.001 && p.cashAsset && p.updateAsset) {
            const newCashQty = Math.max(0, Math.round((p.cashAsset.quantity - delta) * 100) / 100);
            await p.updateAsset({
              id: p.cashAsset.id,
              patch: {
                quantity: newCashQty,
                average_price: 1,
              },
            });
          }
        } else if (initialSource === "pocket" && currentSource === "pocket") {
          // Permanece Dinheiro Novo (Bolso): atualiza o aporte vinculado caso o valor ou a data tenham sido alterados
          if (p.linkedContribution && p.updateContribution) {
            const amountChanged = Math.abs(newTotalBRL - p.linkedContribution.amount) > 0.001;
            const dateChanged = p.date !== p.linkedContribution.date;
            if (amountChanged || dateChanged) {
              await p.updateContribution({
                id: p.linkedContribution.id,
                input: {
                  amount: newTotalBRL,
                  date: p.date,
                },
                suppressToast: true,
              });
            }
          }
        }
      }

      await p.updateTx({
        id: p.editTransaction.id,
        patch: {
          type: p.type,
          date: p.date,
          quantity: resolvedQty,
          price: p.isCorporateEvent ? 0 : p.isTotalValue ? total : price,
          total: p.isCorporateEvent ? 0 : total,
          ...(p.targetAsset?.currency !== "BRL"
            ? { fx_rate: p.fxRateBRL && p.fxRateBRL > 0 ? p.fxRateBRL : (p.usdRate > 1 ? p.usdRate : 5.25) }
            : p.fxRateBRL && p.fxRateBRL > 0
              ? { fx_rate: p.fxRateBRL }
              : {}),
        },
      });
      return null;
    }

    const resolvedDate = p.isDividendType
      ? resolveDividendDate(p.dividendEntryMode, p.dividendEntryMode === "monthly" ? p.month : p.date)
      : p.date;
    const resolvedNotes = p.isDividendType
      ? resolveDividendNote(p.dividendEntryMode, "", p.type)
      : p.type === "sell" && p.isTotalValue && p.fiSellResult
        ? buildFixedIncomeSellNotes({
            appliedCost: p.fiSellResult.appliedCostBasis,
            realizedProfit: p.fiSellResult.realizedProfit,
            taxAmount: p.fiSellResult.taxAmount,
            taxRatePct: p.fiSellResult.taxRatePct,
            netCredit: p.fiSellResult.netCredit,
          })
        : undefined;
    const buyFlags = flagsFromFundingSource(p.buyFundingSource);
    const effectiveRate = p.fxRateBRL && p.fxRateBRL > 0
      ? p.fxRateBRL
      : p.targetAsset.currency !== "BRL"
        ? (p.usdRate > 1 ? p.usdRate : 5.25)
        : p.usdRate;

    const proportionalRedeemedCost =
      p.type === "sell" && p.isTotalValue && p.fiSellResult
        ? p.fiSellResult.appliedCostBasis
        : undefined;
    const preRedemptionCost =
      p.type === "sell" && p.isTotalValue && p.appliedCostCents > 0
        ? p.appliedCostCents / 100
        : undefined;

    await p.recordOrder({
      asset: p.targetAsset,
      type: p.type,
      date: resolvedDate,
      quantity: p.isTotalValue ? 1 : p.isCorporateEvent ? Math.round(p.computedEventFactor * 1000000) / 1000000 : p.parsedQty,
      price: p.isTotalValue ? total : p.isCorporateEvent ? 0 : price,
      total: p.isCorporateEvent ? 0 : total,
      syncCash: p.type === "buy" || p.type === "subscription" ? buyFlags.syncCash : p.isCorporateEvent ? false : p.creditCash,
      cashAsset: p.cashAsset,
      recordContribution: p.type === "buy" || p.type === "subscription" ? buyFlags.recordContribution : false,
      recordWithdrawal: p.type === "sell" ? Boolean(p.recordWithdrawal) : false,
      notes: resolvedNotes,
      usdRate: effectiveRate,
      fxRateBRL: p.fxRateBRL && p.fxRateBRL > 0 ? p.fxRateBRL : undefined,
      appliedCostBasis: proportionalRedeemedCost,
      preRedemptionHoldingCost: preRedemptionCost,
      customTaxAmount: p.isTotalValue && p.fiSellResult ? p.fiSellResult.taxAmount : undefined,
      customTaxRatePct: p.isTotalValue && p.fiSellResult ? p.fiSellResult.taxRatePct : undefined,
      netCreditAmount: p.isTotalValue && p.fiSellResult ? p.fiSellResult.netCredit : undefined,
      customInitialInvestmentDate: p.customInitialDate,
    });

    const label = p.type === "buy" || p.type === "subscription"
      ? "Compra / Aporte registrado"
      : p.type === "sell" ? "Venda / Resgate registrado" : p.isDividendType ? "Provento registrado" : "Evento corporativo registrado";
    const profitSign = p.fiSellResult && p.fiSellResult.realizedProfit >= 0 ? "+" : "";
    const description =
      p.type === "sell" && p.isTotalValue && p.fiSellResult
        ? `Resgate de ${formatCentsAsBRL(numberToCents(total))} em ${p.targetAsset.ticker}. Lucro realizado: ${profitSign}${formatCentsAsBRL(numberToCents(p.fiSellResult.realizedProfit))} (IRRF: -${formatCentsAsBRL(numberToCents(p.fiSellResult.taxAmount))}).`
        : `${p.targetAsset.ticker} atualizado na carteira com sucesso.`;
    pushToast({ title: label, description, variant: "success" });
    return null;
  } catch (err) {
    return getErrorMessage(err);
  }
}

export function resolveQuickTransactionModalCopy(params: {
  isEditingDividend: boolean;
  isEditingTransaction: boolean;
  targetAsset: PortfolioAsset | null;
}) {
  const { isEditingDividend, isEditingTransaction, targetAsset } = params;
  const isEditMode = isEditingDividend || isEditingTransaction;
  const title = isEditingDividend
    ? `Editar Provento${targetAsset ? ` · ${targetAsset.ticker}` : ""}`
    : isEditingTransaction
      ? `Editar Movimentação${targetAsset ? ` · ${targetAsset.ticker}` : ""}`
      : targetAsset
        ? `Movimentar ${targetAsset.ticker}`
        : "Nova Operação na Carteira";
  const description = isEditMode
    ? "Ajuste valor, cotas ou data com recálculo automático da posição em custódia."
    : "Registre compras, vendas, proventos ou eventos corporativos em tempo real.";
  return { title, description };
}

