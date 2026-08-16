/**
 * Planejamento Financeiro — F24 (Simulador FIRE + Fundo de Emergência).
 *
 * Modelo determinístico e conservador, 100% puro (sem DOM/Supabase):
 *   • **Regra dos 4% (FIRE):** meta de independência = despesas anuais × 25
 *     (retirada anual de 4% do patrimônio cobre as despesas sem corroer);
 *   • **Projeção anual:** capital = (capital + aporte mensal × 12) × (1 +
 *     retorno real anual). Retorno real = acima da inflação (premissa
 *     editável; padrão 5% a.a.).
 *   • **Fundo de emergência:** meses de despesa cobertos pelo saldo líquido
 *     (proxy do caixa disponível), com faixas de saúde (crítico / baixo /
 *     adequado / saudável).
 *
 * Premissas transparentes (expostas na UI) e sem simulação Monte Carlo —
 * o objetivo é um norte simples e auditável, alinhado à filosofia do app.
 */

// ---------------------------------------------------------------------------
// Regra dos 4% (FIRE)
// ---------------------------------------------------------------------------

/** Múltiplo das despesas anuais para a meta de independência (1 ÷ 4%). */
const FIRE_TARGET_MULTIPLE = 25;

/** Retorno real anual padrão (acima da inflação) — premissa editável. */
export const DEFAULT_REAL_RETURN_RATE = 0.05;

/** Horizonte máximo da simulação (anos). */
const FIRE_MAX_YEARS = 40;

/** Meta de independência financeira = despesas anuais × 25 (regra dos 4%). */
export function fireTargetCents(annualExpensesCents: number): number {
  return Math.round(annualExpensesCents * FIRE_TARGET_MULTIPLE);
}

export interface FireProjectionInput {
  /** Despesas anuais (centavos) — base da meta e do custeio. */
  annualExpensesCents: number;
  /** Capital inicial acumulado (centavos) — ex.: patrimônio da carteira. */
  initialCapitalCents: number;
  /** Aporte mensal (centavos) — cresce o capital todo ano. */
  monthlyContributionCents: number;
  /** Retorno real anual (decimal, ex.: 0.05 = 5% a.a. acima da inflação). */
  realReturnRate?: number;
  /** Horizonte máximo em anos (padrão 40). */
  maxYears?: number;
}

export interface FireProjectionPoint {
  /** Ano da simulação (0 = hoje). */
  year: number;
  /** Patrimônio projetado em centavos. */
  capitalCents: number;
  /** true quando a meta FIRE já foi atingida neste ano. */
  reached: boolean;
}

export interface FireProjection {
  /** Meta FIRE em centavos (despesas anuais × 25). */
  targetCents: number;
  /** Anos até atingir a meta (null se não atingiu no horizonte). */
  yearsToFire: number | null;
  /** Patrimônio ao final do horizonte (centavos). */
  finalCapitalCents: number;
  /** Série anual (inclui o ano 0 = capital inicial). */
  series: FireProjectionPoint[];
}

/** Projeção FIRE anual determinística (capital composto + aportes). */
export function fireProjection(input: FireProjectionInput): FireProjection {
  const maxYears = Math.max(1, Math.min(FIRE_MAX_YEARS, input.maxYears ?? FIRE_MAX_YEARS));
  const rate = input.realReturnRate ?? DEFAULT_REAL_RETURN_RATE;
  const target = fireTargetCents(Math.max(0, input.annualExpensesCents));
  const yearlyContribution = Math.max(0, input.monthlyContributionCents) * 12;

  const series: FireProjectionPoint[] = [];
  let capital = Math.max(0, input.initialCapitalCents);
  let yearsToFire: number | null = null;

  series.push({ year: 0, capitalCents: capital, reached: capital >= target });

  for (let year = 1; year <= maxYears; year += 1) {
    capital = Math.round((capital + yearlyContribution) * (1 + rate));
    const reached = capital >= target;
    series.push({ year, capitalCents: capital, reached });
    if (reached && yearsToFire === null) {
      yearsToFire = year;
    }
  }

  return {
    targetCents: target,
    yearsToFire,
    finalCapitalCents: capital,
    series,
  };
}

// ---------------------------------------------------------------------------
// Fundo de emergência
// ---------------------------------------------------------------------------

export type EmergencyHealth = "critico" | "baixo" | "adequado" | "saudavel";

export const EMERGENCY_HEALTH_LABELS: Record<EmergencyHealth, string> = {
  critico: "Crítico",
  baixo: "Baixo",
  adequado: "Adequado",
  saudavel: "Saudável",
};

export interface EmergencyFund {
  /** Meses de despesa cobertos (null quando não há despesa de referência). */
  months: number | null;
  /** Faixa de saúde do fundo. */
  health: EmergencyHealth;
}

/**
 * Meses de reserva = saldo líquido ÷ despesa mensal.
 * Faixas: < 3 crítico · 3–5 baixo · 6–11 adequado · ≥ 12 saudável.
 * Sem despesa de referência (≤ 0), não há métrica — tratado como saudável.
 */
export function emergencyFundMonths(liquidCents: number, monthlyExpensesCents: number): EmergencyFund {
  if (monthlyExpensesCents <= 0) {
    return { months: null, health: "saudavel" };
  }
  const months = liquidCents / monthlyExpensesCents;
  const health: EmergencyHealth =
    months < 3 ? "critico" : months < 6 ? "baixo" : months < 12 ? "adequado" : "saudavel";
  return { months, health };
}
