/**
 * Motor Puro de Benchmarks Oficiais de Mercado (CDI, Poupança, IPCA e IBOVESPA).
 *
 * Princípios de Engenharia Financeira:
 * 1. CDI: Taxa livre de risco universal do mercado brasileiro (CVM / ANBIMA);
 * 2. Poupança: Regra oficial do Banco Central:
 *    - Se Selic Meta > 8,5% a.a.: 0,5% a.m. + TR (~6,17% a.a. base contínua);
 *    - Se Selic Meta <= 8,5% a.a.: 70% da taxa Selic Meta + TR;
 * 3. Inflação (IPCA): Mede a erosão do poder de compra e o Juro Real Líquido da carteira;
 *    Juro Real = ((1 + R_carteira) / (1 + IPCA)) - 1;
 * 4. IBOVESPA: Termômetro do mercado acionário brasileiro.
 *
 * Módulo 100% puro — sem dependências de UI ou Supabase.
 */

export interface BenchmarkComparisonItem {
  key: "cdi" | "poupanca" | "ipca" | "ibov";
  name: string;
  description: string;
  /** Taxa acumulada do benchmark no período (% ex: 10.5 para 10,5%). */
  benchmarkRatePct: number;
  /** Percentual da rentabilidade da carteira frente ao benchmark (ex: 124.5 para 124,5% do CDI). Null se benchmark <= 0. */
  pctOfBenchmark: number | null;
  /** Spread / Alfa em pontos percentuais (Carteira % - Benchmark %). */
  alphaPct: number;
  /** Status relativo frente ao benchmark. */
  status: "outperforming" | "matching" | "underperforming";
}

export interface ConsolidatedBenchmarksResult {
  items: BenchmarkComparisonItem[];
  /** Rendimento real líquido acima da inflação (% de ganho real de poder de compra). */
  realReturnPct: number;
}

/**
 * Calcula a taxa acumulada equivalente da Poupança de acordo com a regra oficial do Bacen.
 */
export function calculatePoupancaRate(annualSelicRate: number, months: number): number {
  if (months <= 0) return 0;

  let annualRate: number;
  if (annualSelicRate > 8.5) {
    // 0.5% ao mês capitalizado (~6.17% a.a.)
    annualRate = 6.17;
  } else {
    // 70% da Selic
    annualRate = annualSelicRate * 0.7;
  }

  const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  const accumulatedRate = (Math.pow(1 + monthlyRate, months) - 1) * 100;
  return Math.round(accumulatedRate * 100) / 100;
}

/**
 * Converte uma taxa anualizada para a taxa acumulada no período de N meses.
 */
export function compoundAnnualRateToPeriod(annualRatePct: number, months: number): number {
  if (months <= 0) return 0;
  const monthlyRate = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
  const accumulated = (Math.pow(1 + monthlyRate, months) - 1) * 100;
  return Math.round(accumulated * 100) / 100;
}

/**
 * Compara a rentabilidade da carteira contra uma taxa de benchmark.
 */
export function compareWithBenchmark(
  key: BenchmarkComparisonItem["key"],
  name: string,
  description: string,
  portfolioRatePct: number,
  benchmarkRatePct: number,
): BenchmarkComparisonItem {
  // Arredonda para 1 casa decimal (precisão visual exibida no relatório),
  // garantindo que a diferença linear (ex.: 9,4% - 4,4% = +5,0 p.p.) seja exata.
  const dispPort = Math.round(portfolioRatePct * 10) / 10;
  const dispBench = Math.round(benchmarkRatePct * 10) / 10;
  const alphaPct = Math.round((dispPort - dispBench) * 10) / 10;
  
  let pctOfBenchmark: number | null = null;
  if (benchmarkRatePct > 0) {
    pctOfBenchmark = Math.round((portfolioRatePct / benchmarkRatePct) * 1000) / 10;
  }

  let status: BenchmarkComparisonItem["status"] = "matching";
  if (alphaPct > 0.05) {
    status = "outperforming";
  } else if (alphaPct < -0.05) {
    status = "underperforming";
  }

  return {
    key,
    name,
    description,
    benchmarkRatePct,
    pctOfBenchmark,
    alphaPct,
    status,
  };
}

export interface ConsolidatedBenchmarksInput {
  portfolioRatePct: number;
  monthsCount: number;
  annualCdiRate?: number;
  annualSelicRate?: number;
  annualIpcaRate?: number;
  ibovPeriodRatePct?: number;
}

/**
 * Consolida a comparação da carteira contra os 4 benchmarks oficiais.
 */
export function calculateConsolidatedBenchmarks(
  input: ConsolidatedBenchmarksInput,
): ConsolidatedBenchmarksResult {
  const {
    portfolioRatePct,
    monthsCount,
    annualCdiRate = 10.5,
    annualSelicRate = 10.5,
    annualIpcaRate = 4.0,
    ibovPeriodRatePct,
  } = input;

  const months = Math.max(1, monthsCount);

  // 1. CDI
  const cdiPeriodRate = compoundAnnualRateToPeriod(annualCdiRate, months);
  const cdiItem = compareWithBenchmark(
    "cdi",
    "CDI",
    "Referência livre de risco CVM / ANBIMA",
    portfolioRatePct,
    cdiPeriodRate,
  );

  // 2. Poupança
  const poupancaPeriodRate = calculatePoupancaRate(annualSelicRate, months);
  const poupancaItem = compareWithBenchmark(
    "poupanca",
    "Poupança",
    "Regra oficial Bacen (TR + 0,5% a.m.)",
    portfolioRatePct,
    poupancaPeriodRate,
  );

  // 3. Inflação (IPCA)
  const ipcaPeriodRate = compoundAnnualRateToPeriod(annualIpcaRate, months);
  const ipcaItem = compareWithBenchmark(
    "ipca",
    "Inflação (IPCA)",
    "Preservação do poder de compra",
    portfolioRatePct,
    ipcaPeriodRate,
  );

  // 4. IBOVESPA
  // Se não fornecido explicitamente, projeta retorno representativo ou neutro da bolsa
  const ibovRate =
    ibovPeriodRatePct !== undefined
      ? ibovPeriodRatePct
      : compoundAnnualRateToPeriod(12.0, months); // 12% a.a. de referência histórica para a bolsa
  const ibovItem = compareWithBenchmark(
    "ibov",
    "IBOVESPA",
    "Principal índice de ações da B3",
    portfolioRatePct,
    ibovRate,
  );

  // Juro Real Líquido da Carteira: ((1 + R_carteira) / (1 + IPCA)) - 1
  const portFactor = 1 + portfolioRatePct / 100;
  const ipcaFactor = 1 + ipcaPeriodRate / 100;
  const realReturnPct = Math.round(((portFactor / ipcaFactor) - 1) * 10000) / 100;

  return {
    items: [cdiItem, poupancaItem, ipcaItem, ibovItem],
    realReturnPct,
  };
}
