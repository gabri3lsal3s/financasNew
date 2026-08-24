/**
 * Funções puras para Inteligência de Proventos, Efeito Bola de Neve,
 * Preço Teto Bazin, Yield on Cost e Normalização de Metas (§F39).
 */

export interface SnowballProgressInput {
  /** Quantidade de cotas atual em carteira. */
  quantity: number;
  /** Preço de mercado atual da cota em BRL. */
  currentPrice: number;
  /** Provento mensal estimado por cota em BRL (ex: último rendimento ou média). */
  monthlyDividendPerShare: number;
}

export interface SnowballProgressResult {
  monthlyDividendPerShare: number;
  currentMonthlyIncome: number;
  sharesNeededForOneShare: number;
  remainingShares: number;
  progressPct: number;
  isSnowballActive: boolean;
}

/**
 * Calcula o progresso do "Efeito Bola de Neve" para um ativo:
 * Quantas cotas são necessárias para que a renda passiva mensal do ativo
 * compre 1 cota inteira nova todo mês sem aportes externos.
 */
export function calculateSnowballProgress(input: SnowballProgressInput): SnowballProgressResult {
  const { quantity, currentPrice, monthlyDividendPerShare } = input;

  if (currentPrice <= 0 || monthlyDividendPerShare <= 0 || quantity < 0) {
    return {
      monthlyDividendPerShare: Math.max(0, monthlyDividendPerShare),
      currentMonthlyIncome: 0,
      sharesNeededForOneShare: 0,
      remainingShares: 0,
      progressPct: 0,
      isSnowballActive: false,
    };
  }

  const currentMonthlyIncome = Math.round(quantity * monthlyDividendPerShare * 100) / 100;
  const sharesNeededForOneShare = Math.ceil(currentPrice / monthlyDividendPerShare);
  const remainingShares = Math.max(0, sharesNeededForOneShare - quantity);
  const rawProgress = (currentMonthlyIncome / currentPrice) * 100;
  const progressPct = Math.min(100, Math.round(rawProgress * 10) / 10);
  const isSnowballActive = quantity >= sharesNeededForOneShare && sharesNeededForOneShare > 0;

  return {
    monthlyDividendPerShare,
    currentMonthlyIncome,
    sharesNeededForOneShare,
    remainingShares,
    progressPct,
    isSnowballActive,
  };
}

/**
 * Calcula o Yield on Cost (YoC) histórico acumulado:
 * Percentual que o total de proventos recebidos representa sobre o custo total investido.
 * @deprecated Prefira `calculateYieldOnCostTotal` que incorpora proventos acumulados históricos.
 */
export function calculateYieldOnCost(totalDividends: number, totalCost: number): number {
  if (totalCost <= 0 || totalDividends <= 0) return 0;
  const raw = (totalDividends / totalCost) * 100;
  return Math.round(raw * 100) / 100;
}

/**
 * YoC total: soma dos proventos acumulados históricos (`accumulated_dividends` do ativo)
 * com os proventos do extrato periódico (`portfolio_dividends`).
 * Usa essa função em vez de `calculateYieldOnCost` quando o ativo possui acumulados históricos.
 */
export function calculateYieldOnCostTotal(
  accumulatedDividends: number,
  periodicDividends: number,
  totalCost: number,
): number {
  const total = Math.max(0, accumulatedDividends) + Math.max(0, periodicDividends);
  if (totalCost <= 0 || total <= 0) return 0;
  return Math.round((total / totalCost) * 10000) / 100;
}

// ---------------------------------------------------------------------------
// Resolução de Estimativa de Dividendo/Cota para a Bola de Neve
// ---------------------------------------------------------------------------

/**
 * Resultado da resolução da estimativa de dividendo/cota mensal para a Bola de Neve.
 */
export interface ResolvedDividendPerShare {
  /** Provento/cota mensal estimado a ser usado no cálculo da Bola de Neve. */
  perShare: number;
  /**
   * Origem da estimativa:
   * - "latest_tx"       : último lançamento periódico em `portfolio_dividends` (mais preciso).
   * - "manual_estimate" : campo `estimated_monthly_dividend_per_share` do ativo (fallback manual).
   * - "none"            : sem dados — ativo oculto da Bola de Neve.
   */
  source: "latest_tx" | "manual_estimate" | "none";
}

/**
 * Resolve a estimativa de dividendo/cota mensal para o cálculo da Bola de Neve.
 *
 * Prioridade:
 *  1. Último lançamento periódico em `portfolio_dividends` (mais recente e preciso).
 *  2. Campo `estimated_monthly_dividend_per_share` do ativo (fallback manual — Cenário B).
 *  3. Nenhum dado disponível → `source: "none"` (ativo não aparece na Bola de Neve).
 *
 * Cenários:
 *  A — Ativo com lançamentos periódicos: usa latestTxAmount ÷ quantity.
 *  B — Ativo só com acumulados (sem lançamentos): usa estimatedPerShare do campo do ativo.
 *  C — Ativo com ambos: usa latestTxAmount (maior prioridade, mais recente).
 */
export function resolveMonthlyDividendPerShare(
  /** Valor do último lançamento periódico em `portfolio_dividends` (null se não houver). */
  latestTxAmount: number | null,
  /** Quantidade atual de cotas em carteira. */
  quantity: number,
  /** Valor de `estimated_monthly_dividend_per_share` do ativo (0 se não configurado). */
  estimatedPerShare: number,
): ResolvedDividendPerShare {
  if (latestTxAmount !== null && latestTxAmount > 0 && quantity > 0) {
    return { perShare: Math.round((latestTxAmount / quantity) * 1000000) / 1000000, source: "latest_tx" };
  }
  if (estimatedPerShare > 0) {
    return { perShare: estimatedPerShare, source: "manual_estimate" };
  }
  return { perShare: 0, source: "none" };
}


export interface BazinTargetPriceInput {
  /** Proventos anuais pagos por cota (últimos 12 meses ou média dos últimos 3 anos). */
  annualDividendPerShare: number;
  /** Taxa de retorno esperada (default: 0.06 para 6% a.a. Método Décio Bazin). */
  expectedYieldRate?: number;
  /** Preço de mercado atual da cota para cálculo da margem de segurança (opcional). */
  currentPrice?: number;
}

export interface BazinTargetPriceResult {
  targetPrice: number;
  marginOfSafetyPct: number | null;
  isBelowTarget: boolean;
}

/**
 * Calcula o Preço Teto pelo Método Décio Bazin (Margem de Segurança):
 * Preço Máximo = Proventos Anuais por Cota / Taxa Mínima Esperada (default 6% a.a.).
 */
export function calculateBazinTargetPrice(input: BazinTargetPriceInput): BazinTargetPriceResult {
  const { annualDividendPerShare, expectedYieldRate = 0.06, currentPrice } = input;

  if (annualDividendPerShare <= 0 || expectedYieldRate <= 0) {
    return {
      targetPrice: 0,
      marginOfSafetyPct: null,
      isBelowTarget: false,
    };
  }

  const targetPrice = Math.round((annualDividendPerShare / expectedYieldRate) * 100) / 100;

  if (currentPrice === undefined || currentPrice <= 0) {
    return {
      targetPrice,
      marginOfSafetyPct: null,
      isBelowTarget: false,
    };
  }

  const marginRaw = ((targetPrice - currentPrice) / currentPrice) * 100;
  const marginOfSafetyPct = Math.round(marginRaw * 10) / 10;
  const isBelowTarget = currentPrice <= targetPrice;

  return {
    targetPrice,
    marginOfSafetyPct,
    isBelowTarget,
  };
}

export interface ConcentrationItem {
  assetId: string;
  ticker: string;
  valueBRL: number;
  pct: number;
}

export interface PortfolioConcentrationResult {
  totalValueBRL: number;
  concentratedAssets: ConcentrationItem[];
  isConcentrated: boolean;
  maxConcentrationPct: number;
}

/**
 * Avalia o termômetro de concentração da carteira:
 * Identifica ativos cujo valor de mercado ultrapassa o limiar estipulado (padrão: 25% do patrimônio).
 */
export function calculatePortfolioConcentration(
  rows: { assetId: string; ticker: string; valueBRL: number; isCash?: boolean }[],
  thresholdPct = 25,
): PortfolioConcentrationResult {
  const nonCashRows = rows.filter((r) => !r.isCash && r.valueBRL > 0);
  const totalValueBRL = nonCashRows.reduce((acc, r) => acc + r.valueBRL, 0);

  if (totalValueBRL <= 0 || nonCashRows.length <= 1) {
    return {
      totalValueBRL,
      concentratedAssets: [],
      isConcentrated: false,
      maxConcentrationPct: 0,
    };
  }

  const items: ConcentrationItem[] = nonCashRows.map((r) => ({
    assetId: r.assetId,
    ticker: r.ticker,
    valueBRL: r.valueBRL,
    pct: Math.round((r.valueBRL / totalValueBRL) * 1000) / 10,
  }));

  const concentratedAssets = items
    .filter((i) => i.pct > thresholdPct)
    .sort((a, b) => b.pct - a.pct);

  const maxConcentrationPct = items.length > 0 ? Math.max(...items.map((i) => i.pct)) : 0;

  return {
    totalValueBRL,
    concentratedAssets,
    isConcentrated: concentratedAssets.length > 0,
    maxConcentrationPct,
  };
}

export interface TargetPercentageItem {
  id: string;
  targetPercentage: number;
}

/**
 * Normaliza uma lista de metas percentuais para que a soma seja rigorosamente o total especificado (targetTotal, padrão 100%):
 * Se todas forem 0, distribui de forma uniforme; caso contrário, ajusta proporcionalmente.
 */
export function normalizeAllocationTargets<T extends TargetPercentageItem>(items: readonly T[], targetTotal = 100): T[] {
  if (items.length === 0) return [];
  const clampedTotal = Math.min(100, Math.max(0, targetTotal));
  if (clampedTotal === 0) {
    return items.map((item) => ({ ...item, targetPercentage: 0 }));
  }

  const currentSum = items.reduce((acc, item) => acc + Math.max(0, item.targetPercentage), 0);

  if (currentSum === 0) {
    const equalShare = Math.floor((clampedTotal / items.length) * 100) / 100;
    let accumulated = 0;

    return items.map((item, index) => {
      if (index === items.length - 1) {
        return {
          ...item,
          targetPercentage: Math.max(0, Math.round((clampedTotal - accumulated) * 100) / 100),
        };
      }
      accumulated = Math.round((accumulated + equalShare) * 100) / 100;
      return {
        ...item,
        targetPercentage: equalShare,
      };
    });
  }

  let accumulated = 0;
  const count = items.length;
  const normalized = items.map((item, index) => {
    if (index === count - 1) {
      // O último item recebe o complemento exato para fechar targetTotal
      const finalVal = Math.max(0, Math.round((clampedTotal - accumulated) * 100) / 100);
      return {
        ...item,
        targetPercentage: finalVal,
      };
    }
    const ratio = Math.max(0, item.targetPercentage) / currentSum;
    const val = Math.round(ratio * clampedTotal * 100) / 100;
    accumulated = Math.round((accumulated + val) * 100) / 100;
    return {
      ...item,
      targetPercentage: val,
    };
  });

  return normalized;
}

export interface ReinvestmentAssetInput {
  assetId: string;
  ticker: string;
  currentPrice: number;
  quantity: number;
  monthDividends: number;
}

export interface ReinvestmentOpportunity {
  assetId: string;
  ticker: string;
  currentPrice: number;
  monthDividends: number;
  purchasableShares: number;
  totalReinvestmentValue: number;
  leftoverDividends: number;
}

/**
 * Identifica oportunidades imediatas de reinvestimento da Bola de Neve:
 * Ativos cujos proventos recebidos no mês já compram 1 ou mais cotas completas (F50).
 */
export function detectReinvestmentOpportunities(
  assets: readonly ReinvestmentAssetInput[],
): ReinvestmentOpportunity[] {
  const opportunities: ReinvestmentOpportunity[] = [];

  for (const asset of assets) {
    if (asset.currentPrice <= 0 || asset.monthDividends <= 0) continue;

    const purchasableShares = Math.floor(asset.monthDividends / asset.currentPrice);
    if (purchasableShares >= 1) {
      const totalReinvestmentValue = Math.round(purchasableShares * asset.currentPrice * 100) / 100;
      const leftoverDividends = Math.round((asset.monthDividends - totalReinvestmentValue) * 100) / 100;

      opportunities.push({
        assetId: asset.assetId,
        ticker: asset.ticker,
        currentPrice: asset.currentPrice,
        monthDividends: asset.monthDividends,
        purchasableShares,
        totalReinvestmentValue,
        leftoverDividends,
      });
    }
  }

  return opportunities.sort((a, b) => b.purchasableShares - a.purchasableShares);
}

