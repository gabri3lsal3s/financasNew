/**
 * Catálogo canônico de valores/planos Asaas (server-side).
 * Usado no checkout e no webhook para evitar heurísticas inseguras (ex.: value > 50).
 */

export const ASAAS_PLAN_CATALOG = {
  monthly: { planId: "pro_monthly" as const, value: 19.9, cycle: "MONTHLY" as const },
  annual: { planId: "pro_annual" as const, value: 178.8, cycle: "YEARLY" as const },
};

export type AsaasPlanKey = keyof typeof ASAAS_PLAN_CATALOG;
export type AsaasTierId = (typeof ASAAS_PLAN_CATALOG)[AsaasPlanKey]["planId"];

const VALUE_EPSILON = 0.05;

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= VALUE_EPSILON;
}

/**
 * Resolve o tier a partir do pagamento Asaas de forma determinística.
 * Retorna null se o valor/tipo não casar com o catálogo (não promover assinatura).
 */
export function resolveTierFromPayment(payment: {
  value?: number | string | null;
  billingType?: string | null;
}): AsaasTierId | null {
  const billingType = (payment.billingType ?? "").toUpperCase();
  const value = Number(payment.value);

  // PIX no produto é exclusivo do plano anual
  if (billingType === "PIX") {
    if (!Number.isFinite(value) || approxEqual(value, ASAAS_PLAN_CATALOG.annual.value)) {
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
