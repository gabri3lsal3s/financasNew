/**
 * Ledger de carteira — ESPECIFICAÇÃO §3.11.2.
 *
 * Posição derivada exclusivamente das transações (nunca armazenada):
 *   • Custo médio = custoTotal ÷ quantidade (atualizado a cada compra;
 *     vendas reduzem proporcionalmente);
 *   • Proventos acumulam separadamente e NÃO alteram custo nem posição;
 *   • Split soma cotas; reverse split subtrai (custo total preservado);
 *   • Tickers de caixa com valor 1:1 (quantidade = valor);
 *   • Caixa DERIVADO do ledger (nunca armazenado): compras/subscrições
 *     debitam; vendas e proventos creditam.
 *
 * Motor puro — testável isoladamente (reconciliação com exemplos manuais).
 */

import type { PortfolioTransactionType } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface LedgerTransaction {
  id: string;
  type: PortfolioTransactionType;
  /** Data da transação (YYYY-MM-DD). */
  date: string;
  /** Quantidade (numeric 18,8). */
  quantity: number;
  /** Preço unitário (numeric 18,8). */
  price: number;
  /** Valor total da operação (numeric 18,2 — BRL/USD). */
  total: number;
}

export interface AssetPosition {
  /** Quantidade atual (cotas/unidades). */
  quantity: number;
  /** Custo médio por unidade (custoTotal ÷ quantidade). */
  averageCost: number;
  /** Custo total do que permanece na posição. */
  totalCost: number;
  /** Proventos acumulados (dividend/jcp/fii_yield) — não alteram custo/posição. */
  dividends: number;
}

export interface LedgerResult extends AssetPosition {
  /** Caixa derivado (nunca armazenado): compras/subscrições debitam; vendas/proventos creditam. */
  cash: number;
}

/** Aplica uma operação (compras → custo médio, vendas → redução proporcional). */
export function applyOperation(
  position: AssetPosition,
  tx: Pick<LedgerTransaction, "type" | "quantity" | "price" | "total">,
): AssetPosition {
  switch (tx.type) {
    case "buy":
    case "subscription": {
      const newQuantity = position.quantity + tx.quantity;
      const newTotalCost = position.totalCost + tx.total;
      return {
        quantity: newQuantity,
        averageCost: newQuantity > 0 ? newTotalCost / newQuantity : 0,
        totalCost: newTotalCost,
        dividends: position.dividends,
      };
    }
    case "sell": {
      // Venda reduz proporcionalmente o custo: usa o custo médio atual.
      const newQuantity = Math.max(0, position.quantity - tx.quantity);
      const costSold = position.averageCost * tx.quantity;
      const newTotalCost = Math.max(0, position.totalCost - costSold);
      return {
        quantity: newQuantity,
        averageCost: newQuantity > 0 ? newTotalCost / newQuantity : 0,
        totalCost: newTotalCost,
        dividends: position.dividends,
      };
    }
    case "dividend":
    case "jcp":
    case "fii_yield":
      // Proventos NÃO alteram custo nem posição — acumulam separadamente.
      return { ...position, dividends: position.dividends + tx.total };
    case "split": {
      // Split soma cotas: quantidade × fator; custo total preservado.
      const factor = tx.quantity > 0 ? tx.quantity : 1;
      const newQuantity = position.quantity * factor;
      return {
        quantity: newQuantity,
        averageCost: newQuantity > 0 ? position.totalCost / newQuantity : 0,
        totalCost: position.totalCost,
        dividends: position.dividends,
      };
    }
    case "reverse_split": {
      // Reverse split subtrai cotas: quantidade ÷ fator; custo total preservado.
      const factor = tx.quantity > 0 ? tx.quantity : 1;
      const newQuantity = position.quantity / factor;
      return {
        quantity: newQuantity,
        averageCost: newQuantity > 0 ? position.totalCost / newQuantity : 0,
        totalCost: position.totalCost,
        dividends: position.dividends,
      };
    }
  }
}

/** Converte centavos de moeda monetária para número (total numeric 18,2). */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Ledger completo de um ativo: aplica todas as transações em ordem
 * cronológica e deriva o caixa. A posição inicial é zerada.
 */
export function computeLedger(transactions: readonly LedgerTransaction[]): LedgerResult {
  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let position: AssetPosition = { quantity: 0, averageCost: 0, totalCost: 0, dividends: 0 };
  let cash = 0;

  for (const tx of sorted) {
    position = applyOperation(position, tx);
    switch (tx.type) {
      case "buy":
      case "subscription":
        cash -= tx.total;
        break;
      case "sell":
        cash += tx.total;
        break;
      case "dividend":
      case "jcp":
      case "fii_yield":
        cash += tx.total;
        break;
      case "split":
      case "reverse_split":
        break; // não movimentam caixa
    }
  }

  return { ...position, cash: roundMoney(cash) };
}

/** Posição com valor de mercado (cotação) e peso no patrimônio. */
export function valuePosition(
  position: Pick<AssetPosition, "quantity">,
  price: number,
): number {
  return position.quantity * price;
}

/**
 * Gap de alocação (§3.11.2):
 *   pctAtual = valorAtual ÷ patrimônioTotal × 100;
 *   gapPct = target − pctAtual;
 *   gapFinanceiro = gapPct% × patrimônioTotal.
 */
export function allocationGap(
  currentValueCents: number,
  targetPercent: number,
  totalPortfolioValueCents: number,
): { pctAtual: number; gapPct: number; gapFinanceiroCents: number } {
  const pctAtual = totalPortfolioValueCents > 0 ? (currentValueCents / totalPortfolioValueCents) * 100 : 0;
  const gapPct = targetPercent - pctAtual;
  const gapFinanceiroCents = (gapPct / 100) * totalPortfolioValueCents;
  return { pctAtual, gapPct, gapFinanceiroCents };
}

/** Converte valor em USD para BRL (cotação; fallback fixo 5,25 — §4.2). */
export function convertToBRL(valueCents: number, currency: "BRL" | "USD", usdRate: number = 5.25): number {
  return currency === "USD" ? Math.round(valueCents * usdRate) : valueCents;
}

export {
  FALLBACK_USD_RATE,
  applySpikeGuardrail,
  fallbackPriceFor,
  inferCurrencyFromTicker,
  resolvePrice,
  valueAssetPosition,
} from "./valuation";
export type { AssetValuation, PriceCandidate, PriceSource, ResolvedPrice } from "./valuation";
