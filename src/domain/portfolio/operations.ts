/**
 * Domínio Financeiro de Operações de Custódia (§F38)
 *
 * Funções puras para cálculos de desinvestimento (vendas/resgates),
 * desdobramentos/grupamentos (splits) e regras fiscais de isenção (20k ações / 20% FIIs).
 *
 * Invariantes estritos:
 * - A venda de cotas NÃO altera o Preço Médio unitário das cotas remanescentes;
 * - O desdobramento/grupamento preserva rigorosamente o Custo Total da posição (Qtd × PM);
 * - Sem dependência de UI ou banco de dados.
 */

import { getFixedIncomeTaxRatePct } from "./fixed-income";

export const MONTHLY_STOCK_TAX_EXEMPTION_LIMIT_BRL = 20_000.0;
export const FII_CAPITAL_GAIN_TAX_RATE = 0.2; // 20% sobre o ganho líquido em FIIs

export interface SellAssetInput {
  currentQuantity: number;
  currentAveragePrice: number;
  sellQuantity: number;
  sellPrice: number;
  assetClass?: string | null;
  /** Volume total de vendas de ações já realizadas pelo usuário no mês corrente. */
  monthlyAccumulatedStockSales?: number;
  /** Dias corridos decorridos desde a aplicação original (para Renda Fixa). */
  calendarDays?: number;
  /** Indica se o título de Renda Fixa é isento de IR (LCI, LCA, CRI, CRA). */
  isTaxExemptFixedIncome?: boolean;
}

export interface SellAssetResult {
  remainingQuantity: number;
  remainingAveragePrice: number;
  remainingTotalCost: number;
  grossAmount: number;
  costOfSoldQuantity: number;
  realizedPnl: number;
  realizedPnlPct: number;
  isFullyExited: boolean;
  /** Valor líquido a ser creditado em Caixa (líquido de IRRF para Renda Fixa, bruto para Renda Variável). */
  netCreditAmount: number;
  taxInfo: {
    isStock: boolean;
    isFii: boolean;
    isFixedIncome: boolean;
    accumulatedSalesAfter: number;
    isTaxExempt: boolean;
    taxRate: number;
    estimatedTaxPayable: number;
  };
}

export function sellAssetPosition(input: SellAssetInput): SellAssetResult {
  const currentQuantity = Math.max(0, input.currentQuantity);
  const currentAveragePrice = Math.max(0, input.currentAveragePrice);
  const sellQuantity = Math.min(currentQuantity, Math.max(0, input.sellQuantity));
  const sellPrice = Math.max(0, input.sellPrice);

  const remainingQuantity = Math.max(0, currentQuantity - sellQuantity);
  // O Preço Médio das cotas remanescentes permanece rigorosamente inalterado
  const remainingAveragePrice = remainingQuantity > 0 ? currentAveragePrice : 0;
  const remainingTotalCost = Math.round(remainingQuantity * remainingAveragePrice * 100) / 100;

  const grossAmount = Math.round(sellQuantity * sellPrice * 100) / 100;
  const costOfSoldQuantity = Math.round(sellQuantity * currentAveragePrice * 100) / 100;
  const realizedPnl = Math.round((grossAmount - costOfSoldQuantity) * 100) / 100;
  const realizedPnlPct = costOfSoldQuantity > 0 ? (realizedPnl / costOfSoldQuantity) * 100 : 0;

  const rawClass = (input.assetClass ?? "").trim().toLowerCase();
  const isStock = rawClass === "ações" || rawClass === "acoes" || rawClass === "ação" || rawClass === "acao" || rawClass === "stock" || rawClass === "stocks";
  const isFii = rawClass === "fiis" || rawClass === "fii" || rawClass === "fundo imobiliário" || rawClass === "fundos imobiliários";
  const isFixedIncome = rawClass === "renda fixa" || rawClass === "rendafixa" || rawClass === "rf" || rawClass === "cdb" || rawClass === "lci" || rawClass === "lca" || rawClass === "cri" || rawClass === "cra" || rawClass === "tesouro";

  const monthlyAccumulatedStockSales = Math.max(0, input.monthlyAccumulatedStockSales ?? 0);
  const accumulatedSalesAfter = Math.round((monthlyAccumulatedStockSales + (isStock ? grossAmount : 0)) * 100) / 100;

  let isTaxExempt = false;
  let taxRate = 0;
  let estimatedTaxPayable = 0;

  if (isStock) {
    // Isenção para vendas de ações até R$ 20.000 no mês
    isTaxExempt = accumulatedSalesAfter <= MONTHLY_STOCK_TAX_EXEMPTION_LIMIT_BRL;
    taxRate = 0.15; // 15% sobre o ganho de capital em operações comuns de ações
    if (!isTaxExempt && realizedPnl > 0) {
      estimatedTaxPayable = Math.round(realizedPnl * taxRate * 100) / 100;
    }
  } else if (isFii) {
    // FIIs não possuem isenção de 20k no ganho de capital: 20% fixo sobre o lucro
    isTaxExempt = false;
    taxRate = FII_CAPITAL_GAIN_TAX_RATE;
    if (realizedPnl > 0) {
      estimatedTaxPayable = Math.round(realizedPnl * taxRate * 100) / 100;
    }
  } else if (isFixedIncome) {
    // Tabela regressiva de IR retido na fonte (22,5% a 15,0%)
    const calendarDays = input.calendarDays ?? 365;
    isTaxExempt = Boolean(input.isTaxExemptFixedIncome);
    const taxRatePct = getFixedIncomeTaxRatePct(calendarDays, isTaxExempt);
    taxRate = taxRatePct / 100;
    if (!isTaxExempt && realizedPnl > 0) {
      estimatedTaxPayable = Math.round(realizedPnl * taxRate * 100) / 100;
    }
  }

  // Para Renda Fixa tributada, o IR é retido na fonte no resgate e o valor líquido é creditado no caixa.
  // Para Renda Variável (Ações/FIIs), o valor bruto é creditado no caixa e o DARF é apurado no mês seguinte.
  const netCreditAmount = isFixedIncome
    ? Math.max(0, Math.round((grossAmount - estimatedTaxPayable) * 100) / 100)
    : grossAmount;

  return {
    remainingQuantity,
    remainingAveragePrice,
    remainingTotalCost,
    grossAmount,
    costOfSoldQuantity,
    realizedPnl,
    realizedPnlPct: Math.round(realizedPnlPct * 100) / 100,
    isFullyExited: remainingQuantity === 0,
    netCreditAmount,
    taxInfo: {
      isStock,
      isFii,
      isFixedIncome,
      accumulatedSalesAfter,
      isTaxExempt,
      taxRate,
      estimatedTaxPayable,
    },
  };
}

export interface SplitAssetInput {
  currentQuantity: number;
  currentAveragePrice: number;
  /** Proporção original (ex: 1 para 10 desdobramento -> ratioFrom = 1). */
  ratioFrom: number;
  /** Proporção resultante (ex: 1 para 10 desdobramento -> ratioTo = 10; grupamento 10 para 1 -> ratioTo = 1). */
  ratioTo: number;
}

export interface SplitAssetResult {
  newQuantity: number;
  newAveragePrice: number;
  totalCostBefore: number;
  totalCostAfter: number;
  factor: number;
}

export function splitAssetPosition(input: SplitAssetInput): SplitAssetResult {
  const currentQuantity = Math.max(0, input.currentQuantity);
  const currentAveragePrice = Math.max(0, input.currentAveragePrice);
  const ratioFrom = Math.max(0.0001, input.ratioFrom);
  const ratioTo = Math.max(0.0001, input.ratioTo);

  const factor = ratioTo / ratioFrom;
  const newQuantity = Math.round(currentQuantity * factor * 10000) / 10000;
  const newAveragePrice = factor > 0 ? currentAveragePrice / factor : 0;

  const totalCostBefore = Math.round(currentQuantity * currentAveragePrice * 100) / 100;
  const totalCostAfter = Math.round(newQuantity * newAveragePrice * 100) / 100;

  return {
    newQuantity,
    newAveragePrice: Math.round(newAveragePrice * 10000) / 10000,
    totalCostBefore,
    totalCostAfter,
    factor,
  };
}

// ---------------------------------------------------------------------------
// Sincronização e Reconciliação do Ledger com Custódia de Ativos (§F38 / F73)
// ---------------------------------------------------------------------------

import { todayISO } from "@/domain/debts";
import type { AssetCurrency, FixedIncomeMetadata } from "@/types";
import { computeLedger, type LedgerTransaction } from "./index";

export const APP_MIN_DATE = "2026-01-01";

/**
 * Garante que nenhuma data seja anterior ao marco zero do banco de dados (2026-01-01).
 */
export function clampAppDate(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== "string") return todayISO();
  const cleaned = dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return todayISO();
  return cleaned < APP_MIN_DATE ? APP_MIN_DATE : cleaned;
}

export interface BuildInitialPositionInput {
  assetId: string;
  ticker: string;
  assetClass?: string | null;
  currency?: AssetCurrency;
  quantity: number;
  averagePrice: number;
  initialDate?: string | null;
  usdRate?: number;
  isTotalValue?: boolean;
  isCash?: boolean;
  notes?: string | null;
}

export interface InitialPositionOperationsResult {
  transaction: {
    asset_id: string;
    type: "buy";
    date: string;
    quantity: number;
    price: number;
    total: number;
  } | null;
  contribution: {
    asset_id: string;
    date: string;
    amount: number;
    notes: string;
  } | null;
}

/**
 * Cria os payloads consistentes de transação (portfolio_transactions) e aporte (portfolio_contributions)
 * para a adição inicial de um ativo ou saldo em caixa.
 */
export function buildInitialPositionOperations(
  input: BuildInitialPositionInput,
): InitialPositionOperationsResult {
  const quantity = Math.max(0, input.quantity);
  const averagePrice = Math.max(0, input.averagePrice);
  if (quantity <= 0 && averagePrice <= 0) {
    return { transaction: null, contribution: null };
  }

  const date = clampAppDate(input.initialDate);
  const currency: AssetCurrency = input.currency === "USD" ? "USD" : "BRL";
  const rate = currency === "USD" ? Math.max(0.01, input.usdRate ?? 5.25) : 1;

  if (input.isCash) {
    const total = quantity;
    if (total <= 0) return { transaction: null, contribution: null };
    return {
      transaction: {
        asset_id: input.assetId,
        type: "buy",
        date,
        quantity: total,
        price: 1,
        total,
      },
      contribution: {
        asset_id: input.assetId,
        date,
        amount: total,
        notes: "Aporte inicial · Saldo em Caixa",
      },
    };
  }

  if (input.isTotalValue) {
    const total = averagePrice > 0 ? averagePrice : quantity;
    if (total <= 0) return { transaction: null, contribution: null };
    const amountBRL = Math.round(total * rate * 100) / 100;
    return {
      transaction: {
        asset_id: input.assetId,
        type: "buy",
        date,
        quantity: 1,
        price: total,
        total,
      },
      contribution: {
        asset_id: input.assetId,
        date,
        amount: amountBRL,
        notes: `Aporte inicial · Aplicação em ${input.ticker}`,
      },
    };
  }

  const total = Math.round(quantity * averagePrice * 100) / 100;
  if (total <= 0) return { transaction: null, contribution: null };
  const amountBRL = Math.round(total * rate * 100) / 100;
  const notes =
    currency === "USD"
      ? `Aporte inicial · Compra de ${input.ticker} ($${total.toFixed(2)})`
      : `Aporte inicial · Compra de ${input.ticker}`;

  return {
    transaction: {
      asset_id: input.assetId,
      type: "buy",
      date,
      quantity,
      price: averagePrice,
      total,
    },
    contribution: {
      asset_id: input.assetId,
      date,
      amount: amountBRL,
      notes,
    },
  };
}

export interface ReconcileAssetInput {
  currentQuantity: number;
  currentAveragePrice: number;
  assetClass?: string | null;
  currency?: AssetCurrency;
  isCash?: boolean;
  isTotalValue?: boolean;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
  removedTransaction: {
    type: string;
    quantity: number;
    price: number;
    total: number;
  };
  remainingTransactions: readonly Pick<LedgerTransaction, "type" | "quantity" | "price" | "total" | "date">[];
}

export interface ReconciledAssetPositionResult {
  newQuantity: number;
  newAveragePrice: number;
  newTotalCost: number;
  updatedFixedIncomeMetadata: FixedIncomeMetadata | null;
}

/**
 * Recalcula a custódia do ativo (quantidade, preço médio e metadados) após a exclusão de uma movimentação,
 * aplicando estorno cronológico seguro e preservando dados legados.
 */
export function calculateReconciledAssetPosition(
  input: ReconcileAssetInput,
): ReconciledAssetPositionResult {
  const { currentQuantity, currentAveragePrice, isCash, isTotalValue, removedTransaction, remainingTransactions } = input;

  // 1. Caso Caixa
  if (isCash) {
    if (removedTransaction.type === "buy") {
      const newQuantity = Math.max(0, currentQuantity - (removedTransaction.total > 0 ? removedTransaction.total : removedTransaction.quantity));
      return {
        newQuantity,
        newAveragePrice: 1,
        newTotalCost: newQuantity,
        updatedFixedIncomeMetadata: null,
      };
    }
    if (removedTransaction.type === "sell") {
      const newQuantity = currentQuantity + (removedTransaction.total > 0 ? removedTransaction.total : removedTransaction.quantity);
      return {
        newQuantity,
        newAveragePrice: 1,
        newTotalCost: newQuantity,
        updatedFixedIncomeMetadata: null,
      };
    }
  }

  // 2. Caso Renda Fixa (modo total_value)
  if (isTotalValue) {
    const totalAppliedRemaining = remainingTransactions.reduce((acc, t) => {
      if (t.type === "buy" || t.type === "subscription") return acc + t.total;
      if (t.type === "sell") return Math.max(0, acc - t.total);
      return acc;
    }, 0);

    // Se restaram transações registradas no ledger, utiliza a soma delas
    let finalCost = totalAppliedRemaining;
    if (remainingTransactions.length === 0) {
      if (removedTransaction.type === "buy") {
        finalCost = Math.max(0, currentAveragePrice - removedTransaction.total);
      } else if (removedTransaction.type === "sell") {
        finalCost = currentAveragePrice + removedTransaction.total;
      }
    }

    finalCost = Math.round(finalCost * 100) / 100;
    const finalQuantity = finalCost > 0 ? 1 : 0;

    let updatedFi: FixedIncomeMetadata | null = null;
    if (input.fixedIncomeMetadata) {
      updatedFi = {
        ...input.fixedIncomeMetadata,
        base_value: finalCost > 0 ? finalCost : null,
        initial_investment_value:
          input.fixedIncomeMetadata.initial_investment_value !== null &&
          input.fixedIncomeMetadata.initial_investment_value !== undefined
            ? Math.min(input.fixedIncomeMetadata.initial_investment_value, finalCost)
            : finalCost,
      };
    }

    return {
      newQuantity: finalQuantity,
      newAveragePrice: finalCost,
      newTotalCost: finalCost,
      updatedFixedIncomeMetadata: updatedFi,
    };
  }

  // 3. Caso Renda Variável / Ações / FIIs / Internacional
  if (removedTransaction.type === "sell") {
    // Excluir venda -> restaura as cotas vendidas sem alterar o PM atual
    const newQuantity = currentQuantity + removedTransaction.quantity;
    const newTotalCost = Math.round(newQuantity * currentAveragePrice * 100) / 100;
    return {
      newQuantity,
      newAveragePrice: currentAveragePrice,
      newTotalCost,
      updatedFixedIncomeMetadata: null,
    };
  }

  const normalizedRemaining: LedgerTransaction[] = remainingTransactions.map((t, i) => ({
    id: (t as { id?: string }).id ?? `tx-${i}`,
    date: t.date,
    type: t.type,
    quantity: t.quantity,
    price: t.price,
    total: t.total,
  }));

  if (removedTransaction.type === "buy" || removedTransaction.type === "subscription") {
    // Se ainda restam transações no ledger, reprocessa o ledger completo
    if (normalizedRemaining.length > 0) {
      const ledger = computeLedger(normalizedRemaining);
      return {
        newQuantity: ledger.quantity,
        newAveragePrice: Math.round(ledger.averageCost * 10000) / 10000,
        newTotalCost: ledger.totalCost,
        updatedFixedIncomeMetadata: null,
      };
    }

    // Se não restam transações no ledger:
    // Se a quantidade for debitada até <= 0 -> zera tudo
    const remQuantity = Math.max(0, currentQuantity - removedTransaction.quantity);
    if (remQuantity <= 0) {
      return {
        newQuantity: 0,
        newAveragePrice: 0,
        newTotalCost: 0,
        updatedFixedIncomeMetadata: null,
      };
    }

    // Se o ativo ainda tinha cotas anteriores não registradas no ledger (salvaguarda de dados legados),
    // preserva o PM original do cadastro
    const newTotalCost = Math.round(remQuantity * currentAveragePrice * 100) / 100;
    return {
      newQuantity: remQuantity,
      newAveragePrice: currentAveragePrice,
      newTotalCost,
      updatedFixedIncomeMetadata: null,
    };
  }

  // Se foi split ou provento excluído
  if (normalizedRemaining.length > 0) {
    const ledger = computeLedger(normalizedRemaining);
    return {
      newQuantity: ledger.quantity,
      newAveragePrice: Math.round(ledger.averageCost * 10000) / 10000,
      newTotalCost: ledger.totalCost,
      updatedFixedIncomeMetadata: null,
    };
  }

  return {
    newQuantity: currentQuantity,
    newAveragePrice: currentAveragePrice,
    newTotalCost: Math.round(currentQuantity * currentAveragePrice * 100) / 100,
    updatedFixedIncomeMetadata: input.fixedIncomeMetadata ?? null,
  };
}

