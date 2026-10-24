/**
 * Lógica pura de decisão e idempotência para o Webhook do Asaas.
 * Isola as regras de transição de status para permitir testes unitários determinísticos.
 */

import { resolveTierFromPayment } from "./asaas-plans.ts";

export interface AsaasPaymentPayload {
  id: string;
  customer?: string;
  billingType?: string;
  value?: number;
  subscription?: string | null;
}

export interface UserSubscriptionSnapshot {
  id: string;
  user_id: string;
  tier: string;
  plan_id: string;
  status: string;
  asaas_customer_id?: string | null;
  asaas_payment_id?: string | null;
  asaas_subscription_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
}

export type WebhookDecision =
  | {
      action: "ignore_unknown_plan";
      reason: string;
    }
  | {
      action: "ignore_duplicate";
      reason: "already_active" | "already_past_due" | "already_cancelled";
    }
  | {
      action: "activate";
      targetTier: "pro_monthly" | "pro_annual";
      currentPeriodEnd: string;
    }
  | {
      action: "mark_past_due";
    }
  | {
      action: "mark_cancelled";
    }
  | {
      action: "unsupported_event";
    };

export function computeNextPeriodEnd(
  targetTier: "pro_monthly" | "pro_annual",
  baseDate: Date = new Date(),
): string {
  const next = new Date(baseDate);
  if (targetTier === "pro_annual") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString();
}

export function decideWebhookAction(params: {
  eventType: string;
  payment: AsaasPaymentPayload;
  currentSub: UserSubscriptionSnapshot;
  now?: Date;
}): WebhookDecision {
  const { eventType, payment, currentSub } = params;
  const now = params.now ?? new Date();

  if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(eventType)) {
    const targetTier = resolveTierFromPayment(payment);
    if (!targetTier) {
      return {
        action: "ignore_unknown_plan",
        reason: `Pagamento com valor/tipo fora do catálogo (valor=${payment.value}, billingType=${payment.billingType})`,
      };
    }

    // Regra de Idempotência Estrita:
    // Se a assinatura já está ativa com este tier e vinculada ao mesmo paymentId ou subscriptionId,
    // não duplicamos registros nem alteramos a data de vigência original.
    const isAlreadyActiveForThisPayment =
      currentSub.status === "active" &&
      currentSub.tier === targetTier &&
      (currentSub.asaas_payment_id === payment.id ||
        (payment.subscription && currentSub.asaas_subscription_id === payment.subscription));

    if (isAlreadyActiveForThisPayment) {
      return {
        action: "ignore_duplicate",
        reason: "already_active",
      };
    }

    return {
      action: "activate",
      targetTier,
      currentPeriodEnd: computeNextPeriodEnd(targetTier, now),
    };
  }

  if (["PAYMENT_OVERDUE"].includes(eventType)) {
    if (currentSub.status === "past_due") {
      return {
        action: "ignore_duplicate",
        reason: "already_past_due",
      };
    }
    return {
      action: "mark_past_due",
    };
  }

  if (["SUBSCRIPTION_DELETED", "PAYMENT_DELETED"].includes(eventType)) {
    if (currentSub.cancel_at_period_end === true) {
      return {
        action: "ignore_duplicate",
        reason: "already_cancelled",
      };
    }
    return {
      action: "mark_cancelled",
    };
  }

  return {
    action: "unsupported_event",
  };
}
