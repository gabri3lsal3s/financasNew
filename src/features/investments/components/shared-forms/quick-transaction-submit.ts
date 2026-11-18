import { numberToCents } from "@/domain/money";
import { resolveDividendDate, resolveDividendNote, type DividendEntryMode } from "@/domain/portfolio/dividends";
import type { FixedIncomeRedemptionPreviewResult } from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsBRL } from "@/services/masks";
import { pushToast } from "@/services/toast";
import type { PortfolioAsset, PortfolioDividend, PortfolioTransaction, PortfolioTransactionType } from "@/types";
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
  usdRate: number;
  appliedCostCents: number;
  fiSellResult: FixedIncomeRedemptionPreviewResult | null;
  editDividend: PortfolioDividend | null;
  editTransaction: PortfolioTransaction | null;
  recordOrder: (payload: RecordOrderMutationArg) => Promise<unknown>;
  updateTx: (payload: { id: string; patch: Partial<PortfolioTransaction> }) => Promise<unknown>;
  updateDividend: (payload: {
    id: string;
    patch: Partial<PortfolioDividend>;
    syncCash: boolean;
    previousSyncCash: boolean;
    previousCashAmount: number;
  }) => Promise<unknown>;
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
  notes?: string;
  usdRate: number;
  appliedCostBasis?: number;
  customTaxAmount?: number;
  customTaxRatePct?: number;
  netCreditAmount?: number;
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
      await p.updateTx({
        id: p.editTransaction.id,
        patch: {
          type: p.type,
          date: p.date,
          quantity: resolvedQty,
          price: p.isCorporateEvent ? 0 : p.isTotalValue ? total : price,
          total: p.isCorporateEvent ? 0 : total,
        },
      });
      return null;
    }

    const resolvedDate = p.isDividendType
      ? resolveDividendDate(p.dividendEntryMode, p.dividendEntryMode === "monthly" ? p.month : p.date)
      : p.date;
    const resolvedNotes = p.isDividendType ? resolveDividendNote(p.dividendEntryMode, "", p.type) : undefined;
    const buyFlags = flagsFromFundingSource(p.buyFundingSource);

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
      notes: resolvedNotes,
      usdRate: p.usdRate,
      appliedCostBasis: p.isTotalValue && p.appliedCostCents > 0 ? p.appliedCostCents / 100 : undefined,
      customTaxAmount: p.isTotalValue && p.fiSellResult ? p.fiSellResult.taxAmount : undefined,
      customTaxRatePct: p.isTotalValue && p.fiSellResult ? p.fiSellResult.taxRatePct : undefined,
      netCreditAmount: p.isTotalValue && p.fiSellResult ? p.fiSellResult.netCredit : undefined,
    });

    const label = p.type === "buy" || p.type === "subscription"
      ? "Compra / Aporte registrado"
      : p.type === "sell" ? "Venda / Resgate registrado" : p.isDividendType ? "Provento registrado" : "Evento corporativo registrado";
    pushToast({ title: label, description: `${p.targetAsset.ticker} atualizado na carteira com sucesso.`, variant: "success" });
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

