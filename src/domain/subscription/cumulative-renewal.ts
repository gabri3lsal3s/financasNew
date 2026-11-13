import { PLAN_CONFIGS } from "./plans";

/** Limites canônicos de meses para antecipação acumulativa no Plano Pro Mensal. */
export const CUMULATIVE_RENEWAL_MIN_MONTHS = 2;
export const CUMULATIVE_RENEWAL_MAX_MONTHS = 11;

export interface CumulativePriceBreakdown {
  months: number;
  discountPercentage: number;
  monthlyEquivalentCents: number;
  totalCents: number;
  fullPriceCents: number;
  savingsCents: number;
  suggestAnnual: boolean;
}

/**
 * Retorna o percentual de desconto progressivo para a quantidade de meses antecipados.
 *
 * Tabela Canônica (§3.1 do Plano 26):
 * - 2 a 3 meses: 5% OFF
 * - 4 a 6 meses: 10% OFF
 * - 7 a 9 meses: 15% OFF
 * - 10 a 11 meses: 20% OFF
 */
export function getCumulativeDiscountPercentage(months: number): number {
  if (months < 2) return 0;
  if (months <= 3) return 5;
  if (months <= 6) return 10;
  if (months <= 9) return 15;
  if (months <= 11) return 20;
  return 0; // 12+ meses dispara recomendação do Anual (40% OFF)
}

/**
 * Calcula o preço exato em centavos e a decomposição financeira da antecipação acumulativa.
 */
export function calculateCumulativePrice(months: number): CumulativePriceBreakdown {
  const baseMonthlyCents = PLAN_CONFIGS.monthly.priceCents; // 1999 centavos (R$ 19,99)

  if (months >= 12) {
    return {
      months: 12,
      discountPercentage: 0,
      monthlyEquivalentCents: baseMonthlyCents,
      totalCents: baseMonthlyCents * 12,
      fullPriceCents: baseMonthlyCents * 12,
      savingsCents: 0,
      suggestAnnual: true,
    };
  }

  const clampedMonths = Math.max(CUMULATIVE_RENEWAL_MIN_MONTHS, Math.min(CUMULATIVE_RENEWAL_MAX_MONTHS, Math.round(months)));
  const discountPercentage = getCumulativeDiscountPercentage(clampedMonths);

  // Preço com desconto por mês arredondado para centavos inteiros
  const monthlyEquivalentCents = Math.round(baseMonthlyCents * (1 - discountPercentage / 100));
  const totalCents = monthlyEquivalentCents * clampedMonths;
  const fullPriceCents = baseMonthlyCents * clampedMonths;
  const savingsCents = fullPriceCents - totalCents;

  return {
    months: clampedMonths,
    discountPercentage,
    monthlyEquivalentCents,
    totalCents,
    fullPriceCents,
    savingsCents,
    suggestAnnual: false,
  };
}

/**
 * Adiciona exatamente N meses civis a uma data base preservando o dia de competência,
 * com clamping estrito no último dia do mês de destino para evitar o clássico bug
 * de month overshoot do JavaScript (ex: 31 de janeiro + 1 mês = 28/29 de fevereiro).
 */
export function addCivilMonths(baseDate: Date | string, months: number): Date {
  const date = new Date(baseDate);
  if (isNaN(date.getTime())) {
    throw new Error("Data inválida fornecida a addCivilMonths.");
  }

  const originalDay = date.getUTCDate();
  const originalHours = date.getUTCHours();
  const originalMinutes = date.getUTCMinutes();
  const originalSeconds = date.getUTCSeconds();
  const originalMs = date.getUTCMilliseconds();

  const currentYear = date.getUTCFullYear();
  const currentMonth = date.getUTCMonth(); // 0 a 11

  // Calcula novo ano e mês em aritmética modular
  const totalMonths = currentMonth + months;
  const targetYear = currentYear + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  // Descobre a quantidade máxima de dias no mês de destino (dia 0 do mês seguinte)
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  // Aplica o clamp no último dia válido do mês de destino se o dia original exceder
  const clampedDay = Math.min(originalDay, daysInTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, clampedDay, originalHours, originalMinutes, originalSeconds, originalMs));
}

export interface CumulativeEligibilityInput {
  tier?: string | null;
  status?: string | null;
  currentPeriodEnd?: string | Date | null;
  pendingPlanId?: string | null;
  now?: Date;
}

/**
 * Avalia se o usuário está elegível para realizar antecipação acumulativa de mensalidades.
 *
 * Regras Estritas (§3.1 do Plano 26):
 * 1. Apenas Plano Pro Mensal ativo (tier = 'pro_monthly' e status = 'active').
 * 2. Bloqueado para trial, anual, lifetime, past_due e read_only.
 * 3. Bloqueado se houver migração de plano pendente (pendingPlanId).
 * 4. Bloqueado se a vigência atual já ultrapassar 11 meses a partir de hoje (limite máximo de acúmulo).
 */
export function isCumulativeRenewalEligible(input: CumulativeEligibilityInput): boolean {
  if (input.tier !== "pro_monthly" || input.status !== "active") {
    return false;
  }

  if (input.pendingPlanId) {
    return false;
  }

  const now = input.now ?? new Date();

  if (input.currentPeriodEnd) {
    const periodEnd = new Date(input.currentPeriodEnd);
    if (!isNaN(periodEnd.getTime())) {
      const maxFutureDate = addCivilMonths(now, CUMULATIVE_RENEWAL_MAX_MONTHS);
      // Se já tem mais de 11 meses acumulados a partir de hoje, bloqueia nova compra
      if (periodEnd.getTime() > maxFutureDate.getTime()) {
        return false;
      }
    }
  }

  return true;
}
