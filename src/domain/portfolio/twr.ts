/**
 * Motor Puro de Rentabilidade por Cotas / TWR (Time-Weighted Return — Padrão CVM/ANBIMA).
 *
 * Princípios de Engenharia Financeira:
 * 1. Imunidade ao Fluxo Externo: isola aportes e retiradas/resgates para que o tamanho
 *    ou momento do fluxo de caixa não distorça a taxa de rentabilidade da estratégia;
 * 2. Cotização Contínua: cada subperíodo (mês ou evento de caixa) afeta o número de cotas
 *    em circulação, mas preserva estritamente o valor unitário da cota na data do fluxo;
 * 3. Encadeamento Geométrico: a rentabilidade acumulada é o produto das variações periódicas:
 *    R_twr = ∏(1 + r_t) - 1;
 * 4. Salvaguardas de Anualização: séries com menos de 12 meses não devem ter anualização
 *    projetada de forma enganosa para evitar distorções de curto prazo;
 * 5. Modified Dietz para Fechamento Mensal Consolidado:
 *    r_t = (Saldo_Fim - Saldo_Ini - FluxoLiquido) / (Saldo_Ini + W * FluxoLiquido).
 *
 * Módulo puro — sem import de UI ou Supabase; 100% testável isoladamente.
 */

export interface TwrCashFlowItem {
  /** Data no formato ISO (YYYY-MM-DD). */
  date: string;
  /** Valor monetário do fluxo em BRL: positivo (> 0) para aporte, negativo (< 0) para resgate. */
  amount: number;
}

export interface TwrMonthlyInputPoint {
  /** Competência (YYYY-MM). */
  month: string;
  /** Saldo bruto total de fechamento do mês em BRL. */
  totalValueBRL: number;
  /** Custo total aplicado ou patrimônio de custo em BRL (opcional). */
  totalCostBRL?: number;
  /**
   * Fluxo externo líquido ocorrido durante o mês em BRL:
   * - Positivo (> 0): novo dinheiro aportado do bolso;
   * - Negativo (< 0): resgate / retirada transferida para fora da carteira.
   */
  netExternalCashFlowBRL?: number;
  /**
   * Detalhamento de fluxos de caixa do mês com data exata (ANBIMA / GIPS).
   * Se informado, permite ponderação por dias corridos no Modified Dietz.
   */
  flows?: readonly TwrCashFlowItem[];
  /**
   * Rentabilidade percentual explícita pré-calculada do mês (% ex: 1.15 para 1,15%).
   * Se fornecida pelo extrato/relatório da corretora, tem precedência sobre o cálculo derivado.
   */
  explicitRatePct?: number | null;
}

export interface TwrMonthlyPointResult {
  month: string;
  /** Rentabilidade percentual isolada do mês (% ex.: 1.15 para +1,15%). */
  monthRatePct: number;
  /** Rentabilidade percentual acumulada até este mês (% ex.: 26.92 para +26,92%). */
  accumulatedRatePct: number;
  /** Valor da cota teórica da carteira (iniciada em 100,00 na data base). */
  sharePrice: number;
  /** Total de cotas teóricas em circulação. */
  totalShares: number;
  /** Saldo bruto total na competência. */
  totalValueBRL: number;
}

export interface TwrConsolidatedResult {
  /** Rentabilidade acumulada total no período (% ex: 26.92 para +26,92%). */
  accumulatedRatePct: number;
  /** Taxa anualizada (% a.a.) calculada apenas se total de meses >= 12. Null caso contrário. */
  annualizedRatePct: number | null;
  /** Quantidade total de meses avaliados. */
  monthsElapsed: number;
  /** Valor atual da cota (base inicial 100,00). */
  currentSharePrice: number;
  /** Diagnóstico de integridade da série. */
  status: "ok" | "empty" | "insufficient_history";
  /** Série temporal detalhada mês a mês. */
  series: TwrMonthlyPointResult[];
}

const BASE_SHARE_PRICE = 100.0;
const MIN_MONTHS_FOR_ANNUALIZATION = 12;

/**
 * Encadeia uma lista de taxas mensais percentuais:
 * R_acum = ∏(1 + r_t / 100) - 1
 */
export function compoundMonthlyRates(monthlyRatesPct: readonly number[]): number {
  if (monthlyRatesPct.length === 0) return 0;

  let compound = 1.0;
  for (const rate of monthlyRatesPct) {
    compound *= 1 + rate / 100;
  }

  const result = Math.round((compound - 1) * 10000) / 100;
  return Math.max(-100, result);
}

/**
 * Anualiza uma taxa acumulada dado o número de meses corridos:
 * R_anual = (1 + R_acum)^(12 / n) - 1
 */
export function annualizeRateFromMonths(
  accumulatedRatePct: number,
  monthsElapsed: number,
): number | null {
  if (monthsElapsed < MIN_MONTHS_FOR_ANNUALIZATION || accumulatedRatePct <= -100) {
    return null;
  }

  const factor = 1 + accumulatedRatePct / 100;
  if (factor <= 0) return -100;

  const annualized = Math.pow(factor, 12 / monthsElapsed) - 1;
  return Math.round(annualized * 10000) / 100;
}

/**
 * Anualiza uma taxa acumulada dado o número exato de dias corridos transcorridos (Padrão CVM / ANBIMA / CFA):
 * R_anual = (1 + R_acum / 100)^(365 / daysElapsed) - 1
 *
 * Salvaguarda CVM/ANBIMA: Se daysElapsed < 365 ou accumulatedRatePct <= -100, retorna null
 * impedindo distorções matemáticas artificiais em períodos curtos de formação da carteira.
 */
export function annualizeRateFromDays(
  accumulatedRatePct: number,
  daysElapsed: number,
): number | null {
  if (daysElapsed < 365 || accumulatedRatePct <= -100) {
    return null;
  }

  const factor = 1 + accumulatedRatePct / 100;
  if (factor <= 0) return -100;

  const annualized = Math.pow(factor, 365 / daysElapsed) - 1;
  return Math.round(annualized * 10000) / 100;
}

/**
 * Retorna o número de dias corridos em uma competência YYYY-MM.
 */
export function getDaysInMonth(monthStr: string): number {
  const parts = monthStr.split("-").map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  return new Date(year, month, 0).getDate();
}

/**
 * Calcula o fluxo de caixa ponderado no mês de acordo com a regra ANBIMA / GIPS:
 * W_i = (diasNoMês - diaDoFluxo + 1) / diasNoMês
 */
export function calculateWeightedCashFlow(
  month: string,
  flows?: readonly TwrCashFlowItem[],
  defaultNetFlow = 0,
): { totalFlow: number; weightedFlow: number } {
  if (!flows || flows.length === 0) {
    return {
      totalFlow: defaultNetFlow,
      weightedFlow: 0.5 * defaultNetFlow,
    };
  }

  const daysInMonth = getDaysInMonth(month);
  let totalFlow = 0;
  let weightedFlow = 0;

  for (const f of flows) {
    const amt = Math.round(f.amount * 100) / 100;
    totalFlow += amt;
    const dayStr = f.date ? f.date.slice(8, 10) : "";
    const day = parseInt(dayStr, 10);
    const validDay = Number.isFinite(day) && day >= 1 && day <= daysInMonth ? day : 15;
    const weight = Math.max(0, Math.min(1, (daysInMonth - validDay + 1) / daysInMonth));
    weightedFlow += amt * weight;
  }

  return {
    totalFlow: Math.round(totalFlow * 100) / 100,
    weightedFlow: Math.round(weightedFlow * 100) / 100,
  };
}

/**
 * Calcula a evolução completa do TWR por cotização a partir de uma série mensal de snapshots
 * e fluxos externos.
 *
 * Algoritmo de Cotização:
 * 1. No mês inicial (m = 0), a cota nasce em R$ 100,00.
 *    Cotas iniciais = Saldo_0 / 100,00.
 * 2. Para cada mês subsequente (m > 0):
 *    a) Se houver explicitRatePct informado (ex.: extrato oficial da corretora),
 *       a cota sobe/desce diretamente: Cota_m = Cota_(m-1) * (1 + explicitRatePct / 100).
 *       As novas cotas geradas pelo fluxo são: NovasCotas = Fluxo / Cota_m.
 *    b) Se não houver explicitRatePct, aplica-se o método canônico de subperíodo:
 *       SaldoPréFluxo = Saldo_m - Fluxo_m
 *       r_m = (SaldoPréFluxo - Saldo_(m-1)) / Saldo_(m-1)
 *       Cota_m = Cota_(m-1) * (1 + r_m)
 *       TotalCotas_m = Saldo_m / Cota_m
 */
export function calculateTwrSeries(
  points: readonly TwrMonthlyInputPoint[],
  daysElapsed?: number,
): TwrConsolidatedResult {
  if (!points || points.length === 0) {
    return {
      accumulatedRatePct: 0,
      annualizedRatePct: null,
      monthsElapsed: 0,
      currentSharePrice: BASE_SHARE_PRICE,
      status: "empty",
      series: [],
    };
  }

  // Ordena cronologicamente por mês
  const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month));
  const series: TwrMonthlyPointResult[] = [];

  let currentSharePrice = BASE_SHARE_PRICE;
  let prevBalance = 0;

  for (let i = 0; i < sorted.length; i++) {
    const pt = sorted[i];
    if (!pt) continue;

    const balance = Math.max(0, Math.round(pt.totalValueBRL * 100) / 100);
    const { totalFlow, weightedFlow } = calculateWeightedCashFlow(
      pt.month,
      pt.flows,
      pt.netExternalCashFlowBRL ?? 0,
    );

    let monthRatePct: number;
    let totalShares: number;

    if (i === 0) {
      // Mês inicial:
      if (pt.explicitRatePct !== undefined && pt.explicitRatePct !== null) {
        monthRatePct = pt.explicitRatePct;
        currentSharePrice = Math.max(0.0001, Math.round(BASE_SHARE_PRICE * (1 + monthRatePct / 100) * 10000) / 10000);
      } else {
        monthRatePct = 0;
        currentSharePrice = BASE_SHARE_PRICE;
      }

      totalShares = balance > 0 && currentSharePrice > 0 ? balance / currentSharePrice : 0;
    } else {
      // Meses subsequentes:
      if (pt.explicitRatePct !== undefined && pt.explicitRatePct !== null) {
        monthRatePct = pt.explicitRatePct;
        currentSharePrice = Math.max(0.0001, Math.round(currentSharePrice * (1 + monthRatePct / 100) * 10000) / 10000);
        totalShares = balance > 0 && currentSharePrice > 0 ? balance / currentSharePrice : 0;
      } else {
        // Cálculo via saldo e fluxo externo (Modified Dietz com dias corridos exatos ANBIMA ou peso médio W = 0.5):
        if (prevBalance > 0) {
          const gain = balance - prevBalance - totalFlow;
          const capitalBase = prevBalance + weightedFlow;
          if (capitalBase > 0) {
            const rawRate = gain / capitalBase;
            const clampedRate = Math.max(-1.0, Math.min(10.0, rawRate));
            monthRatePct = Math.round(clampedRate * 10000) / 100;
          } else {
            monthRatePct = 0;
          }
        } else if (balance > 0) {
          // Carteira estava zerada e recebeu aporte inicial ou retorno de capital neste mês
          monthRatePct = 0;
        } else {
          monthRatePct = 0;
        }

        currentSharePrice = Math.max(0.0001, Math.round(currentSharePrice * (1 + monthRatePct / 100) * 10000) / 10000);
        totalShares = balance > 0 && currentSharePrice > 0 ? balance / currentSharePrice : 0;
      }
    }

    prevBalance = balance;

    const accumulatedRatePct =
      Math.round(((currentSharePrice - BASE_SHARE_PRICE) / BASE_SHARE_PRICE) * 10000) / 100;

    series.push({
      month: pt.month,
      monthRatePct: Math.round(monthRatePct * 100) / 100,
      accumulatedRatePct,
      sharePrice: Math.round(currentSharePrice * 100) / 100,
      totalShares: Math.round(totalShares * 10000) / 10000,
      totalValueBRL: balance,
    });
  }

  const monthsElapsed = series.length;
  const accumulatedRatePct =
    series.length > 0
      ? (series[series.length - 1]?.accumulatedRatePct ?? 0)
      : 0;

  const annualizedRatePct =
    daysElapsed !== undefined && daysElapsed >= 365
      ? annualizeRateFromDays(accumulatedRatePct, daysElapsed)
      : annualizeRateFromMonths(accumulatedRatePct, monthsElapsed);

  return {
    accumulatedRatePct,
    annualizedRatePct,
    monthsElapsed,
    currentSharePrice: Math.round(currentSharePrice * 100) / 100,
    status: monthsElapsed < 2 ? "insufficient_history" : "ok",
    series,
  };
}
