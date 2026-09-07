/**
 * Motor Puro de Métricas Avançadas de Risco & Consistência de Portfólio.
 *
 * Princípios Quantitativos (Padrão ANBIMA / CFA Institute):
 * 1. Max Drawdown: Maior queda percentual acumulada de um pico (High-Water Mark)
 *    até o fundo mais baixo antes de uma nova máxima histórica;
 * 2. Volatilidade Amostral Anualizada (σ): Desvio-padrão amostral dos retornos
 *    mensais escalonado para a base anual pela raiz do tempo (σ_mensal * √12);
 * 3. Consistência / Win Rate: Frequência de meses positivos frente ao total avaliado,
 *    incluindo dispersão entre o melhor e pior mês da série;
 * 4. Índice de Sharpe Anualizado: Retorno excedente anualizado sobre a taxa livre de risco
 *    (CDI) ponderado pela volatilidade anualizada da carteira.
 *
 * Módulo 100% puro — sem dependências de UI ou Supabase.
 */

export interface MaxDrawdownResult {
  /** Maior retração percentual sofrida pela carteira (% ex: -5.4 para -5,4%). Sempre <= 0. */
  maxDrawdownPct: number;
  /** Índice do pico no vetor de entrada. */
  peakIndex: number;
  /** Índice do fundo (vale de maior queda) no vetor de entrada. */
  troughIndex: number;
}

export interface VolatilityResult {
  /** Desvio padrão amostral mensal (% ao mês). */
  monthlyStdDevPct: number;
  /** Desvio padrão amostral anualizado (% a.a. = mensal * √12). */
  annualizedStdDevPct: number;
}

export interface ConsistencyMetricsResult {
  /** Total de meses computados com dados válidos. */
  totalMonths: number;
  /** Quantidade de meses com retorno positivo (>= 0). */
  positiveMonths: number;
  /** Quantidade de meses com retorno negativo (< 0). */
  negativeMonths: number;
  /** Taxa de acerto (% de meses com retorno >= 0). */
  winRatePct: number;
  /** Rentabilidade percentual do melhor mês da série. */
  bestMonthPct: number;
  /** Rentabilidade percentual do pior mês da série. */
  worstMonthPct: number;
}

export interface PortfolioRiskSummary {
  maxDrawdown: MaxDrawdownResult;
  volatility: VolatilityResult;
  consistency: ConsistencyMetricsResult;
  /**
   * Índice de Sharpe Anualizado.
   * Null caso o histórico seja menor que 4 meses ou a volatilidade seja insignificante (<= 0.05%).
   */
  sharpeRatio: number | null;
  /** Rótulo qualitativo do Sharpe (ex: "Excelente Eficiência", "Boa Compensação", "Abaixo do CDI", "Histórico Curto"). */
  sharpeLabel: string;
}

/**
 * Calcula o Max Drawdown a partir de uma série temporal de patrimônio ou cota teórica.
 */
export function calculateMaxDrawdown(values: readonly number[]): MaxDrawdownResult {
  if (!values || values.length < 2) {
    return { maxDrawdownPct: 0, peakIndex: 0, troughIndex: 0 };
  }

  let peak = values[0] ?? 0;
  let peakIdx = 0;
  let maxDd = 0;
  let bestPeakIdx = 0;
  let bestTroughIdx = 0;

  for (let i = 0; i < values.length; i++) {
    const val = values[i] ?? 0;
    if (val > peak) {
      peak = val;
      peakIdx = i;
    } else if (peak > 0) {
      const dd = ((val - peak) / peak) * 100;
      if (dd < maxDd) {
        maxDd = dd;
        bestPeakIdx = peakIdx;
        bestTroughIdx = i;
      }
    }
  }

  return {
    maxDrawdownPct: Math.round(maxDd * 100) / 100,
    peakIndex: bestPeakIdx,
    troughIndex: bestTroughIdx,
  };
}

/**
 * Calcula a volatilidade amostral (desvio padrão) mensal e anualizada.
 */
export function calculateSampleVolatility(ratesPct: readonly number[]): VolatilityResult {
  const validRates = ratesPct.filter((r) => Number.isFinite(r));
  const n = validRates.length;

  if (n < 2) {
    return { monthlyStdDevPct: 0, annualizedStdDevPct: 0 };
  }

  const mean = validRates.reduce((acc, r) => acc + r, 0) / n;
  const variance = validRates.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (n - 1);
  const monthlyStdDev = Math.sqrt(variance);
  const annualizedStdDev = monthlyStdDev * Math.sqrt(12);

  return {
    monthlyStdDevPct: Math.round(monthlyStdDev * 100) / 100,
    annualizedStdDevPct: Math.round(annualizedStdDev * 100) / 100,
  };
}

/**
 * Calcula métricas de consistência mensal (Win Rate, Melhor e Pior Mês).
 */
export function calculateConsistencyMetrics(ratesPct: readonly number[]): ConsistencyMetricsResult {
  const validRates = ratesPct.filter((r) => Number.isFinite(r));
  const totalMonths = validRates.length;

  if (totalMonths === 0) {
    return {
      totalMonths: 0,
      positiveMonths: 0,
      negativeMonths: 0,
      winRatePct: 0,
      bestMonthPct: 0,
      worstMonthPct: 0,
    };
  }

  let positiveMonths = 0;
  let bestMonthPct = validRates[0] ?? 0;
  let worstMonthPct = validRates[0] ?? 0;

  for (const rate of validRates) {
    if (rate >= 0) positiveMonths++;
    if (rate > bestMonthPct) bestMonthPct = rate;
    if (rate < worstMonthPct) worstMonthPct = rate;
  }

  const negativeMonths = totalMonths - positiveMonths;
  const winRatePct = Math.round((positiveMonths / totalMonths) * 1000) / 10;

  return {
    totalMonths,
    positiveMonths,
    negativeMonths,
    winRatePct,
    bestMonthPct: Math.round(bestMonthPct * 100) / 100,
    worstMonthPct: Math.round(worstMonthPct * 100) / 100,
  };
}

/**
 * Calcula o Índice de Sharpe Anualizado.
 * Sharpe = (Retorno Anualizado da Carteira - Taxa Livre de Risco CDI) / Volatilidade Anualizada
 */
export function calculateSharpeRatio(input: {
  annualizedReturnPct: number;
  riskFreeRatePct: number;
  annualizedStdDevPct: number;
  monthsCount: number;
}): { sharpeRatio: number | null; sharpeLabel: string } {
  const { annualizedReturnPct, riskFreeRatePct, annualizedStdDevPct, monthsCount } = input;

  // Salvaguarda: períodos inferiores a 4 meses ou volatilidade nula não suportam Sharpe consistente
  if (monthsCount < 4) {
    return { sharpeRatio: null, sharpeLabel: "Histórico Curto (< 4m)" };
  }

  if (!Number.isFinite(annualizedStdDevPct) || annualizedStdDevPct <= 0.05) {
    return { sharpeRatio: null, sharpeLabel: "Baixa Volatilidade" };
  }

  const excessReturn = annualizedReturnPct - riskFreeRatePct;
  const rawSharpe = excessReturn / annualizedStdDevPct;
  const sharpeRatio = Math.round(rawSharpe * 100) / 100;

  const getSharpeLabel = (val: number): string => {
    if (val >= 1.5) return "Excepcional";
    if (val >= 1.0) return "Excelente Eficiência";
    if (val >= 0.5) return "Boa Compensação";
    if (val >= 0) return "Neutro vs. CDI";
    return "Abaixo do CDI";
  };

  return { sharpeRatio, sharpeLabel: getSharpeLabel(sharpeRatio) };
}

/**
 * Consolidador Geral de Risco e Consistência da Carteira.
 */
export function calculatePortfolioRiskSummary(
  points: readonly { patrimonyBRL: number; ratePct: number | null }[],
  riskFreeRatePct = 10.5,
): PortfolioRiskSummary {
  const patrimonies = points.map((p) => p.patrimonyBRL);
  const rates = points.map((p) => p.ratePct ?? 0);
  const monthsCount = points.length;

  const maxDrawdown = calculateMaxDrawdown(patrimonies);
  const volatility = calculateSampleVolatility(rates);
  const consistency = calculateConsistencyMetrics(rates);

  // Retorno geométrico acumulado no período
  const compoundFactor = rates.reduce((acc, r) => acc * (1 + r / 100), 1);
  const totalReturnPct = (compoundFactor - 1) * 100;

  // Anualização da rentabilidade
  const annualizedReturnPct =
    monthsCount >= 12
      ? (Math.pow(compoundFactor, 12 / monthsCount) - 1) * 100
      : monthsCount > 0
        ? (Math.pow(compoundFactor, 12 / monthsCount) - 1) * 100
        : totalReturnPct;

  const { sharpeRatio, sharpeLabel } = calculateSharpeRatio({
    annualizedReturnPct,
    riskFreeRatePct,
    annualizedStdDevPct: volatility.annualizedStdDevPct,
    monthsCount,
  });

  return {
    maxDrawdown,
    volatility,
    consistency,
    sharpeRatio,
    sharpeLabel,
  };
}
