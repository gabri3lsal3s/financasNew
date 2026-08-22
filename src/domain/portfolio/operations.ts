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
  taxInfo: {
    isStock: boolean;
    isFii: boolean;
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
  }

  return {
    remainingQuantity,
    remainingAveragePrice,
    remainingTotalCost,
    grossAmount,
    costOfSoldQuantity,
    realizedPnl,
    realizedPnlPct: Math.round(realizedPnlPct * 100) / 100,
    isFullyExited: remainingQuantity === 0,
    taxInfo: {
      isStock,
      isFii,
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
