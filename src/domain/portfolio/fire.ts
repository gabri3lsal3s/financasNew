/**
 * Motor puro de cálculo de Independência Financeira (FIRE - Financial Independence, Retire Early).
 *
 * ESPECIFICAÇÃO & FINANCIAL_MATH_SPEC:
 * - Toda regra financeira opera com moeda em centavos (inteiro).
 * - Sem dependência de UI nem Supabase.
 * - Suporta:
 *   1. Cálculo de Capital Crítico (Regra dos 4% / Trinity Study / Regra dos 300).
 *   2. Autonomia de Reserva Líquida (Runway em meses).
 *   3. Grau de Liberdade Financeira (FIRE Index e Estágios Cognitivos).
 */

export type FireStage =
  | "initial" // < 10%
  | "building" // 10% - 24%
  | "quarter" // 25% - 49%
  | "half" // 50% - 74%
  | "security" // 75% - 99%
  | "freedom"; // >= 100%

export interface CriticalCapitalInput {
  /** Custo de vida mensal em centavos. */
  monthlyLivingCostCents: number;
  /** Taxa de retirada segura anual estimada (% a.a.), padrão 4.0 (Regra dos 4% / Trinity). */
  safeWithdrawalRatePct?: number;
}

export interface FireMetricsInput {
  /** Patrimônio líquido total em centavos. */
  currentNetWorthCents: number;
  /** Proventos mensais médios da carteira em centavos. */
  monthlyDividendsCents: number;
  /** Custo de vida mensal médio em centavos. */
  monthlyExpensesCents: number;
  /** Reservas líquidas de alta disponibilidade em centavos. */
  liquidReservesCents: number;
  /** Taxa segura de retirada anual (% a.a.), padrão 4.0%. */
  safeWithdrawalRatePct?: number;
}

export interface FireMetricsResult {
  /** Capital crítico necessário para a independência financeira plena em centavos. */
  criticalCapitalCents: number;
  /** Percentual do capital crítico já acumulado (0 a 100%+). */
  fireProgressPct: number;
  /** Grau de cobertura das despesas por proventos passivos (0 a 100%+). */
  freedomPct: number;
  /** Estágio cognitivo da jornada FIRE. */
  stage: FireStage;
  /** Rótulo descritivo do estágio em pt-BR. */
  stageLabel: string;
  /** Meses de sobrevivência com base nas reservas líquidas atuais (Runway). */
  runwayMonths: number;
  /** Déficit mensal de proventos para cobrir 100% do custo de vida em centavos. */
  monthlyPassiveShortfallCents: number;
  /** Distância patrimonial em centavos para atingir o Capital Crítico. */
  gapToFireCents: number;
}

export const DEFAULT_SAFE_WITHDRAWAL_RATE_PCT = 4.0;

/**
 * Calcula o Capital Crítico necessário para sustentar o custo de vida
 * perpétuo baseado na Taxa de Retirada Segura (SWR - Safe Withdrawal Rate).
 *
 * Fórmula canônica:
 * Capital Crítico = (Custo Mensal × 12) ÷ (SWR / 100) = Custo Mensal × (1200 / SWR)
 * Na regra clássica dos 4%: Custo Mensal × 300.
 */
export function calculateCriticalCapital(input: CriticalCapitalInput): number {
  const cost = Math.max(0, Math.round(input.monthlyLivingCostCents));
  if (cost === 0) return 0;

  const swr =
    input.safeWithdrawalRatePct !== undefined && input.safeWithdrawalRatePct > 0
      ? input.safeWithdrawalRatePct
      : DEFAULT_SAFE_WITHDRAWAL_RATE_PCT;

  // Multiplicador = 1200 / swr (com swr=4 => 300)
  const multiplier = 1200 / swr;
  return Math.round(cost * multiplier);
}

/**
 * Calcula a autonomia financeira das reservas líquidas em meses (Runway).
 *
 * Fórmula:
 * Runway = Reservas Líquidas ÷ Despesas Mensais
 */
export function calculateRunwayMonths(liquidReservesCents: number, monthlyExpensesCents: number): number {
  const safeReserves = Math.max(0, Math.round(liquidReservesCents));
  const safeExpenses = Math.max(0, Math.round(monthlyExpensesCents));

  if (safeExpenses <= 0) return 0;
  if (safeReserves <= 0) return 0;

  const months = safeReserves / safeExpenses;
  // Arredonda para 1 casa decimal
  return Math.round(months * 10) / 10;
}

/**
 * Retorna o estágio FIRE correspondente ao percentual de cobertura das despesas por proventos.
 */
export function getFireStage(freedomPct: number): { stage: FireStage; stageLabel: string } {
  if (freedomPct >= 100) return { stage: "freedom", stageLabel: "Independência Financeira Plena (100%+)" };
  if (freedomPct >= 75) return { stage: "security", stageLabel: "Alta Segurança Financeira (75% a 99%)" };
  if (freedomPct >= 50) return { stage: "half", stageLabel: "Meio Caminho da Liberdade (50% a 74%)" };
  if (freedomPct >= 25) return { stage: "quarter", stageLabel: "Primeiro Quarto Conquistado (25% a 49%)" };
  if (freedomPct >= 10) return { stage: "building", stageLabel: "Fase de Construção (10% a 24%)" };
  return { stage: "initial", stageLabel: "Fase Inicial (< 10%)" };
}

/**
 * Motor central de cálculo consolidado da métrica FIRE.
 */
export function calculateFireMetrics(input: FireMetricsInput): FireMetricsResult {
  const netWorth = Math.max(0, Math.round(input.currentNetWorthCents));
  const dividends = Math.max(0, Math.round(input.monthlyDividendsCents));
  const expenses = Math.max(0, Math.round(input.monthlyExpensesCents));
  const reserves = Math.max(0, Math.round(input.liquidReservesCents));
  const swr = input.safeWithdrawalRatePct ?? DEFAULT_SAFE_WITHDRAWAL_RATE_PCT;

  const criticalCapitalCents = calculateCriticalCapital({
    monthlyLivingCostCents: expenses,
    safeWithdrawalRatePct: swr,
  });

  const runwayMonths = calculateRunwayMonths(reserves, expenses);

  const freedomPct = expenses > 0 ? Math.round((dividends / expenses) * 1000) / 10 : 0;
  const fireProgressPct = criticalCapitalCents > 0 ? Math.round((netWorth / criticalCapitalCents) * 1000) / 10 : 0;

  const { stage, stageLabel } = getFireStage(freedomPct);

  const monthlyPassiveShortfallCents = Math.max(0, expenses - dividends);
  const gapToFireCents = Math.max(0, criticalCapitalCents - netWorth);

  return {
    criticalCapitalCents,
    fireProgressPct,
    freedomPct,
    stage,
    stageLabel,
    runwayMonths,
    monthlyPassiveShortfallCents,
    gapToFireCents,
  };
}
