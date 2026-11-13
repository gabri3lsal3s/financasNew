/**
 * Catálogo canônico de valores/planos Asaas (server-side Deno).
 * Usado no checkout e no webhook para evitar heurísticas inseguras.
 */

export const ASAAS_PLAN_CATALOG = {
  monthly: { planId: "pro_monthly" as const, value: 19.99, valueCents: 1999, cycle: "MONTHLY" as const },
  annual: { planId: "pro_annual" as const, value: 143.88, valueCents: 14388, cycle: "YEARLY" as const },
};

export type AsaasPlanKey = keyof typeof ASAAS_PLAN_CATALOG;
export type AsaasTierId = (typeof ASAAS_PLAN_CATALOG)[AsaasPlanKey]["planId"];

const VALUE_EPSILON = 0.05;

export function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= VALUE_EPSILON;
}

/**
 * Tabela canônica de descontos progressivos para antecipação de 2 a 11 meses (§3.1 do Plano 26).
 */
export function getCumulativeDiscountPercentage(months: number): number {
  if (months < 2) return 0;
  if (months <= 3) return 5;
  if (months <= 6) return 10;
  if (months <= 9) return 15;
  if (months <= 11) return 20;
  return 0; // 12+ meses bloqueado (dispara recomendação do Anual 40% OFF)
}

export interface CumulativePriceServerResult {
  months: number;
  discountPercentage: number;
  monthlyEquivalentCents: number;
  totalCents: number;
  totalReais: number;
  savingsCents: number;
  suggestAnnual: boolean;
}

/**
 * Calcula no servidor o preço e centavos da antecipação acumulativa.
 */
export function calculateCumulativePriceServer(months: number): CumulativePriceServerResult {
  const baseMonthlyCents = ASAAS_PLAN_CATALOG.monthly.valueCents;

  if (months >= 12) {
    return {
      months: 12,
      discountPercentage: 0,
      monthlyEquivalentCents: baseMonthlyCents,
      totalCents: baseMonthlyCents * 12,
      totalReais: Number(((baseMonthlyCents * 12) / 100).toFixed(2)),
      savingsCents: 0,
      suggestAnnual: true,
    };
  }

  const clampedMonths = Math.max(2, Math.min(11, Math.round(months)));
  const discountPercentage = getCumulativeDiscountPercentage(clampedMonths);

  const monthlyEquivalentCents = Math.round(baseMonthlyCents * (1 - discountPercentage / 100));
  const totalCents = monthlyEquivalentCents * clampedMonths;
  const fullPriceCents = baseMonthlyCents * clampedMonths;
  const savingsCents = fullPriceCents - totalCents;

  return {
    months: clampedMonths,
    discountPercentage,
    monthlyEquivalentCents,
    totalCents,
    totalReais: Number((totalCents / 100).toFixed(2)),
    savingsCents,
    suggestAnnual: false,
  };
}

/**
 * Adiciona exatamente N meses civis a uma data base preservando o dia e horário,
 * com clamping no último dia do mês de destino para evitar o bug de month overshoot em JS.
 */
export function addCivilMonthsServer(baseDate: Date | string, months: number): Date {
  const date = new Date(baseDate);
  if (isNaN(date.getTime())) {
    throw new Error("Data inválida fornecida a addCivilMonthsServer.");
  }

  const originalDay = date.getUTCDate();
  const originalHours = date.getUTCHours();
  const originalMinutes = date.getUTCMinutes();
  const originalSeconds = date.getUTCSeconds();
  const originalMs = date.getUTCMilliseconds();

  const currentYear = date.getUTCFullYear();
  const currentMonth = date.getUTCMonth();

  const totalMonths = currentMonth + months;
  const targetYear = currentYear + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(originalDay, daysInTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, clampedDay, originalHours, originalMinutes, originalSeconds, originalMs));
}

/**
 * Resolve o tier a partir do pagamento Asaas para fluxos legados de fallback.
 */
export function resolveTierFromPayment(payment: {
  value?: number | string | null;
  billingType?: string | null;
}): AsaasTierId | null {
  const billingType = (payment.billingType ?? "").toUpperCase();
  const value = Number(payment.value);

  if (billingType === "PIX") {
    if (Number.isFinite(value) && approxEqual(value, ASAAS_PLAN_CATALOG.annual.value)) {
      return ASAAS_PLAN_CATALOG.annual.planId;
    }
    return null;
  }

  if (!Number.isFinite(value)) return null;
  if (approxEqual(value, ASAAS_PLAN_CATALOG.annual.value)) {
    return ASAAS_PLAN_CATALOG.annual.planId;
  }
  if (approxEqual(value, ASAAS_PLAN_CATALOG.monthly.value)) {
    return ASAAS_PLAN_CATALOG.monthly.planId;
  }
  return null;
}
