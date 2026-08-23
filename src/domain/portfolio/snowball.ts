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
 */
export function calculateYieldOnCost(totalDividends: number, totalCost: number): number {
  if (totalCost <= 0 || totalDividends <= 0) return 0;
  const raw = (totalDividends / totalCost) * 100;
  return Math.round(raw * 100) / 100;
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
