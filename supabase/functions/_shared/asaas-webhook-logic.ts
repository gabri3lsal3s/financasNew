/**
 * Lógica pura de decisão e idempotência para o Webhook do Asaas.
 * Isola as regras de transição de status para permitir testes unitários determinísticos.
 */

import {
  resolveTierFromPayment,
  addCivilMonthsServer,
} from "./asaas-plans.ts";

export interface AsaasPaymentPayload {
  id: string;
  customer?: string;
  billingType?: string;
  value?: number;
  subscription?: string | null;
  externalReference?: string | null;
  dueDate?: string | null;
  confirmedDate?: string | null;
  paymentDate?: string | null;
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
  trial_ends_at?: string | null;
  cancel_at_period_end?: boolean;
}

export interface BillingIntentSnapshot {
  id: string;
  user_id: string;
  kind: "subscription_start" | "plan_change" | "cumulative_renewal" | "reactivation";
  plan_id?: string | null;
  months_count?: number | null;
  amount_cents: number;
  status: string;
  metadata?: Record<string, unknown>;
}

export type WebhookDecision =
  | {
      action: "ignore_unknown_plan";
      reason: string;
    }
  | {
      action: "ignore_duplicate";
      reason: "already_active" | "already_past_due" | "already_cancelled" | "already_refunded" | "intent_already_paid";
    }
  | {
      action: "activate";
      targetTier: "pro_monthly" | "pro_annual";
      currentPeriodEnd: string;
      isUpgradeFromMonthly?: boolean;
    }
  | {
      action: "apply_cumulative_renewal";
      intentId: string;
      monthsCount: number;
      newPeriodEnd: string;
    }
  | {
      action: "delete_pending_payment";
      paymentId: string;
    }
  | {
      action: "mark_past_due";
    }
  | {
      action: "mark_cancelled";
    }
  | {
      action: "mark_refunded";
    }
  | {
      action: "unsupported_event";
    };

export function computeNextPeriodEnd(
  targetTier: "pro_monthly" | "pro_annual",
  baseDate: Date = new Date(),
): string {
  const months = targetTier === "pro_annual" ? 12 : 1;
  return addCivilMonthsServer(baseDate, months).toISOString();
}

export function decideWebhookAction(params: {
  eventType: string;
  payment: AsaasPaymentPayload;
  currentSub: UserSubscriptionSnapshot;
  intent?: BillingIntentSnapshot | null;
  now?: Date;
  isPaymentAlreadyProcessed?: boolean;
}): WebhookDecision {
  const { eventType, payment, currentSub, intent, isPaymentAlreadyProcessed } = params;
  const now = params.now ?? new Date();

  const referenceDate = payment.confirmedDate || payment.paymentDate || payment.dueDate
    ? new Date(payment.confirmedDate || payment.paymentDate || payment.dueDate!)
    : now;

  if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(eventType)) {
    // 1. Reconciliação prioritária por Billing Intent
    if (intent) {
      if (intent.status === "paid") {
        return {
          action: "ignore_duplicate",
          reason: "intent_already_paid",
        };
      }

      if (intent.kind === "cumulative_renewal") {
        const months = intent.months_count ?? 1;
        const currentEnd = currentSub.current_period_end && new Date(currentSub.current_period_end) > now
          ? new Date(currentSub.current_period_end)
          : now;
        const newPeriodEnd = addCivilMonthsServer(currentEnd, months).toISOString();

        return {
          action: "apply_cumulative_renewal",
          intentId: intent.id,
          monthsCount: months,
          newPeriodEnd,
        };
      }
    }

    // 2. Resolução padrão por Catálogo de Valores
    const targetTier = resolveTierFromPayment(payment);
    if (!targetTier) {
      return {
        action: "ignore_unknown_plan",
        reason: `Pagamento com valor/tipo fora do catálogo (valor=${payment.value}, billingType=${payment.billingType})`,
      };
    }

    // 3. Desduplicação estrita: se este pagamento idêntico já foi processado na assinatura atual
    // Corrigido F-01: NÃO usa mais currentSub.asaas_subscription_id === payment.subscription,
    // garantindo que pagamentos de renovação subsequente (2º mês em diante) avancem a vigência normalmente.
    const isExactPaymentDuplicate =
      isPaymentAlreadyProcessed ||
      (currentSub.status === "active" && currentSub.asaas_payment_id === payment.id);

    if (isExactPaymentDuplicate) {
      return {
        action: "ignore_duplicate",
        reason: "already_active",
      };
    }

    // 4. Vigência Monotônica:
    // Se o usuário possuir período já pago vigente ou dias de trial restantes,
    // o novo período é somado à data futura mais distante, preservando 100% dos dias pagos/gratuitos.
    const baseDate = currentSub.current_period_end && new Date(currentSub.current_period_end) > now
      ? new Date(currentSub.current_period_end)
      : (currentSub.trial_ends_at && new Date(currentSub.trial_ends_at) > now)
      ? new Date(currentSub.trial_ends_at)
      : referenceDate;

    const isUpgradeFromMonthly =
      targetTier === "pro_annual" &&
      currentSub.tier === "pro_monthly" &&
      currentSub.status === "active";

    return {
      action: "activate",
      targetTier,
      currentPeriodEnd: computeNextPeriodEnd(targetTier, baseDate),
      isUpgradeFromMonthly,
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

  if (["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"].includes(eventType)) {
    if (currentSub.status === "canceled" && currentSub.tier === "read_only") {
      return {
        action: "ignore_duplicate",
        reason: "already_refunded",
      };
    }
    return {
      action: "mark_refunded",
    };
  }

  // Corrigido F-06: PAYMENT_DELETED afeta apenas faturas/intents pendentes; NUNCA cancela a assinatura inteira.
  if (eventType === "PAYMENT_DELETED") {
    return {
      action: "delete_pending_payment",
      paymentId: payment.id,
    };
  }

  if (eventType === "SUBSCRIPTION_DELETED") {
    if (currentSub.cancel_at_period_end === true) {
      return {
        action: "ignore_duplicate",
        reason: "already_cancelled",
      };
    }
    // Se a assinatura cancelada for diferente da assinatura atualmente ativa, ignora com segurança
    if (payment.subscription && currentSub.asaas_subscription_id && payment.subscription !== currentSub.asaas_subscription_id) {
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
