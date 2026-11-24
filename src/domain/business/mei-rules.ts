/**
 * Motor Puro de Regras Fiscais e Teto do MEI — Fase 1 (v2.1).
 *
 * Responsável por:
 *   • Apurar o teto base anual por regime e ano fiscal (2026/2027/2028 via LC nº 238/2026);
 *   • Calcular o teto pro-rata no ano de abertura (clamp >= 1 e proteção contra data futura);
 *   • Projetar faturamento anual com base nos meses ativos decorridos;
 *   • Classificar em zonas semânticas (Segura, Tolerância até +20%, Desenquadramento retroativo > 20%).
 *
 * 100% puro — sem dependências de React ou Supabase. Moeda em centavos inteiros.
 */

export interface MeiCeilingRule {
  year: number;
  annualCeilingCents: number;
  monthlyProRataCents: number;
  isLoaConditioned: boolean;
  notes: string;
}

export const MEI_CEILING_BY_YEAR: Record<number, MeiCeilingRule> = {
  2026: {
    year: 2026,
    annualCeilingCents: 81_000_00, // R$ 81.000,00
    monthlyProRataCents: 6_750_00,  // R$ 6.750,00 / mês
    isLoaConditioned: false,
    notes: "Teto padrão anual vigente em 2026",
  },
  2027: {
    year: 2027,
    annualCeilingCents: 110_000_00, // R$ 110.000,00
    monthlyProRataCents: 9_166_67,
    isLoaConditioned: true,
    notes: "Escalonamento aprovado pela LC nº 238/2026 (Art. 3º - condicionado à LOA 2027)",
  },
  2028: {
    year: 2028,
    annualCeilingCents: 140_000_00, // R$ 140.000,00
    monthlyProRataCents: 11_666_67,
    isLoaConditioned: true,
    notes: "Escalonamento aprovado pela LC nº 238/2026 (Art. 3º - condicionado à LOA 2028)",
  },
};

export const MEI_CAMINHONEIRO_BASE_CEILING_CENTS = 251_600_00; // R$ 251.600,00

export type MeiZoneStatus = "safe" | "warning_tolerance_20" | "critical_over_20";

export interface CalculateMeiCeilingParams {
  /** Ano de referência do cálculo (ex.: 2026). */
  referenceYear: number;
  /** Mês de referência (1 a 12). */
  referenceMonth: number;
  /** Faturamento bruto fiscal acumulado no ano fiscal até o momento (em centavos). */
  accumulatedRevenueCents: number;
  /** Data de abertura do CNPJ no formato YYYY-MM ou YYYY-MM-DD (opcional). */
  openingDate?: string | null;
  /** Subcategoria do MEI: geral (padrão) ou transportador autônomo (caminhoneiro). */
  meiSubcategory?: "general" | "trucker";
  /** Override manual do teto anual em centavos (caso o usuário queira customizar). */
  customCeilingCents?: number;
}

export interface MeiCeilingEvaluationResult {
  referenceYear: number;
  referenceMonth: number;
  baseAnnualCeilingCents: number;
  applicableCeilingCents: number;
  toleranceLimitCents: number; // Teto + 20%
  accumulatedRevenueCents: number;
  remainingCeilingCents: number;
  activeMonthsInYear: number;
  activeMonthsElapsed: number;
  projectedAnnualRevenueCents: number;
  projectedCeilingUsagePct: number;
  currentCeilingUsagePct: number;
  zone: MeiZoneStatus;
  isProRata: boolean;
  isLoaConditioned: boolean;
  notes: string;
}

/**
 * Obtém a regra do teto base do MEI para o ano solicitado.
 */
export function getMeiBaseCeilingRule(year: number, isTrucker = false): MeiCeilingRule {
  if (isTrucker) {
    return {
      year,
      annualCeilingCents: MEI_CAMINHONEIRO_BASE_CEILING_CENTS,
      monthlyProRataCents: Math.round(MEI_CAMINHONEIRO_BASE_CEILING_CENTS / 12),
      isLoaConditioned: false,
      notes: "Teto especial MEI Transportador Autônomo de Cargas (Caminhoneiro)",
    };
  }

  const existing = MEI_CEILING_BY_YEAR[year];
  if (existing) return existing;

  // Anos além de 2028: projeta teto consolidado de 2028
  if (year > 2028) {
    return {
      year,
      annualCeilingCents: 140_000_00,
      monthlyProRataCents: 11_666_67,
      isLoaConditioned: true,
      notes: "Teto projetado com base na LC nº 238/2026 (Art. 3º)",
    };
  }

  // Anos anteriores a 2026: teto histórico de R$ 81.000,00
  return {
    year,
    annualCeilingCents: 81_000_00,
    monthlyProRataCents: 6_750_00,
    isLoaConditioned: false,
    notes: "Teto histórico padrão do MEI",
  };
}

/**
 * Avalia o enquadramento fiscal e teto do MEI com suporte a pro-rata, projeção linear e zonas de tolerância.
 */
export function evaluateMeiCeiling(params: CalculateMeiCeilingParams): MeiCeilingEvaluationResult {
  const {
    referenceYear,
    referenceMonth,
    accumulatedRevenueCents,
    openingDate,
    meiSubcategory = "general",
    customCeilingCents,
  } = params;

  const isTrucker = meiSubcategory === "trucker";
  const rule = getMeiBaseCeilingRule(referenceYear, isTrucker);
  const baseAnnualCeilingCents = customCeilingCents ?? rule.annualCeilingCents;

  const currentMonthClamped = Math.max(1, Math.min(12, referenceMonth));

  // Parse da data de abertura
  let isProRata = false;
  let activeMonthsInYear = 12;
  let activeMonthsElapsed = currentMonthClamped;

  if (openingDate) {
    const openingYear = Number(openingDate.slice(0, 4));
    const openingMonthRaw = Number(openingDate.slice(5, 7));

    if (openingYear === referenceYear && Number.isFinite(openingMonthRaw)) {
      isProRata = true;
      const clampedOpeningMonth = Math.max(1, Math.min(12, openingMonthRaw));
      // Meses ativos no ano de abertura: (12 - mesAbertura + 1), com clamp >= 1
      activeMonthsInYear = Math.max(1, 12 - clampedOpeningMonth + 1);

      // Meses decorridos desde a abertura:
      // Se mesReferencia < mesAbertura (guarda de data futura no mesmo ano), retorna 1
      if (currentMonthClamped < clampedOpeningMonth) {
        activeMonthsElapsed = 1;
      } else {
        activeMonthsElapsed = Math.max(1, Math.min(activeMonthsInYear, currentMonthClamped - clampedOpeningMonth + 1));
      }
    } else if (openingYear < referenceYear) {
      // Aberto em anos anteriores: teto cheio e meses decorridos = mes corrente
      activeMonthsInYear = 12;
      activeMonthsElapsed = currentMonthClamped;
    } else {
      // Aberto em ano futuro: proteção conservadora
      isProRata = true;
      activeMonthsInYear = 1;
      activeMonthsElapsed = 1;
    }
  }

  const applicableCeilingCents = isProRata
    ? Math.round((baseAnnualCeilingCents / 12) * activeMonthsInYear)
    : baseAnnualCeilingCents;

  const toleranceLimitCents = Math.round(applicableCeilingCents * 1.20);
  const revenue = Math.max(0, accumulatedRevenueCents);
  const remainingCeilingCents = Math.max(0, applicableCeilingCents - revenue);

  // Projeção linear com clamp contra divisão por zero
  const safeMonthsElapsed = Math.max(1, activeMonthsElapsed);
  const projectedAnnualRevenueCents = Math.round((revenue / safeMonthsElapsed) * activeMonthsInYear);

  const currentCeilingUsagePct = applicableCeilingCents > 0
    ? Number(((revenue / applicableCeilingCents) * 100).toFixed(1))
    : 100;

  const projectedCeilingUsagePct = applicableCeilingCents > 0
    ? Number(((projectedAnnualRevenueCents / applicableCeilingCents) * 100).toFixed(1))
    : 100;

  // Zonas de Semáforo Legal (Lei Complementar nº 123/2006):
  // 1. safe: <= 100%
  // 2. warning_tolerance_20: > 100% e <= 120% (migração no ano seguinte + DAS complementar)
  // 3. critical_over_20: > 120% (desenquadramento retroativo a 1º de janeiro)
  let zone: MeiZoneStatus = "safe";
  if (revenue > toleranceLimitCents) {
    zone = "critical_over_20";
  } else if (revenue > applicableCeilingCents) {
    zone = "warning_tolerance_20";
  }

  return {
    referenceYear,
    referenceMonth: currentMonthClamped,
    baseAnnualCeilingCents,
    applicableCeilingCents,
    toleranceLimitCents,
    accumulatedRevenueCents: revenue,
    remainingCeilingCents,
    activeMonthsInYear,
    activeMonthsElapsed,
    projectedAnnualRevenueCents,
    projectedCeilingUsagePct,
    currentCeilingUsagePct,
    zone,
    isProRata,
    isLoaConditioned: rule.isLoaConditioned,
    notes: rule.notes,
  };
}
