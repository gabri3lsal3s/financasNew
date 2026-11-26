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

export interface AsaasSubscriptionPayload {
  id: string;
  customer?: string;
  status?: string;
  nextDueDate?: string | null;
  value?: number;
  cycle?: string;
  externalReference?: string | null;
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
  chargeback_flagged_at?: string | null;
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
      action: "ignore_unrelated_payment";
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
      action: "refund_cumulative_renewal";
      intentId: string | null;
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
      action: "mark_chargeback";
    }
  | {
      action: "record_chargeback_dispute";
      eventType: "PAYMENT_CHARGEBACK_DISPUTE" | "PAYMENT_AWAITING_CHARGEBACK_REVERSAL";
    }
  | {
      action: "record_partial_refund";
      paymentId: string;
      value: number;
    }
  | {
      action: "sync_subscription_updated";
      subscriptionId: string;
      status?: string;
      nextDueDate?: string | null;
    }
  | {
      action: "unsupported_event";
    };

/**
 * Converte datas de referência do Asaas preservando o fim do dia em BRT (America/Sao_Paulo)
 * quando vierem no formato date-only (YYYY-MM-DD), evitando corte de até 24h por parse UTC 00:00Z.
 */
export function parseAsaasReferenceDate(
  rawDate: string | null | undefined,
  fallback: Date = new Date(),
): Date {
  const trimmed = (rawDate ?? "").trim();
  if (!trimmed) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const anchored = new Date(`${trimmed}T23:59:59-03:00`);
    return Number.isNaN(anchored.getTime()) ? fallback : anchored;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function computeNextPeriodEnd(
  targetTier: "pro_monthly" | "pro_annual",
  baseDate: Date = new Date(),
): string {
  const months = targetTier === "pro_annual" ? 12 : 1;
  return addCivilMonthsServer(baseDate, months).toISOString();
}

export function decideWebhookAction(params: {
  eventType: string;
  payment?: AsaasPaymentPayload | null;
  subscription?: AsaasSubscriptionPayload | null;
  currentSub: UserSubscriptionSnapshot;
  intent?: BillingIntentSnapshot | null;
  now?: Date;
  isPaymentAlreadyProcessed?: boolean;
  processedPaymentKind?: string | null;
}): WebhookDecision {
  const {
    eventType,
    payment,
    subscription,
    currentSub,
    intent,
    isPaymentAlreadyProcessed,
    processedPaymentKind,
  } = params;
  const now = params.now ?? new Date();

  const referenceDate = parseAsaasReferenceDate(
    payment?.confirmedDate || payment?.paymentDate || payment?.dueDate,
    now,
  );

  if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_DUNNING_RECEIVED"].includes(eventType)) {
    if (!payment) {
      return {
        action: "ignore_unknown_plan",
        reason: "Payload de pagamento ausente no evento de liquidação.",
      };
    }

    // 1. Reconciliação prioritária por Billing Intent + lock prévio
    if (intent?.status === "paid") {
      return {
        action: "ignore_duplicate",
        reason: "intent_already_paid",
      };
    }

    if (isPaymentAlreadyProcessed) {
      return {
        action: "ignore_duplicate",
        reason: "already_active",
      };
    }

    if (intent?.kind === "cumulative_renewal") {
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

    // 2. Resolução padrão por Catálogo de Valores
    const targetTier = resolveTierFromPayment(payment);
    if (!targetTier) {
      return {
        action: "ignore_unknown_plan",
        reason: `Pagamento com valor/tipo fora do catálogo (valor=${payment.value}, billingType=${payment.billingType})`,
      };
    }

    // 3. Desduplicação estrita: se este pagamento idêntico já foi processado na assinatura atual
    const isExactPaymentDuplicate =
      currentSub.status === "active" && currentSub.asaas_payment_id === payment.id;

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

  if (eventType === "PAYMENT_OVERDUE") {
    const billingTypeUpper = (payment?.billingType ?? "").toUpperCase();
    if (
      intent?.kind === "cumulative_renewal" ||
      billingTypeUpper === "PIX" ||
      (currentSub.status !== "active" && currentSub.status !== "past_due")
    ) {
      return {
        action: "ignore_unrelated_payment",
        reason: "one_off_or_pix_overdue",
      };
    }

    if (!currentSub.asaas_subscription_id || currentSub.asaas_subscription_id.trim() === "") {
      return {
        action: "ignore_unrelated_payment",
        reason: "no_recurring_subscription",
      };
    }

    if (!payment?.subscription || payment.subscription !== currentSub.asaas_subscription_id) {
      return {
        action: "ignore_unrelated_payment",
        reason: "subscription_mismatch",
      };
    }

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

  if (eventType === "PAYMENT_CHARGEBACK_REQUESTED") {
    const matchesCurrentPayment = Boolean(
      payment?.id &&
        currentSub.asaas_payment_id &&
        payment.id === currentSub.asaas_payment_id,
    );
    const matchesCurrentSubscription = Boolean(
      payment?.subscription &&
        currentSub.asaas_subscription_id &&
        payment.subscription === currentSub.asaas_subscription_id,
    );

    if (!matchesCurrentPayment && !matchesCurrentSubscription) {
      return {
        action: "ignore_unrelated_payment",
        reason: "chargeback_for_non_current_payment",
      };
    }

    if (
      currentSub.status === "canceled" &&
      currentSub.tier === "read_only" &&
      Boolean(currentSub.chargeback_flagged_at)
    ) {
      return {
        action: "ignore_duplicate",
        reason: "already_refunded",
      };
    }
    return {
      action: "mark_chargeback",
    };
  }

  if (
    eventType === "PAYMENT_CHARGEBACK_DISPUTE" ||
    eventType === "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
  ) {
    return {
      action: "record_chargeback_dispute",
      eventType: eventType as "PAYMENT_CHARGEBACK_DISPUTE" | "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
    };
  }

  if (eventType === "PAYMENT_PARTIALLY_REFUNDED") {
    return {
      action: "record_partial_refund",
      paymentId: payment?.id || "",
      value: Number(payment?.value || 0),
    };
  }

  if (eventType === "PAYMENT_REFUNDED") {
    const isCumulative =
      intent?.kind === "cumulative_renewal" || processedPaymentKind === "cumulative_renewal";

    if (isCumulative) {
      if (intent?.metadata && (intent.metadata as Record<string, unknown>).refunded === true) {
        return {
          action: "ignore_duplicate",
          reason: "already_refunded",
        };
      }
      const months = intent?.months_count ?? 1;
      const currentEnd = currentSub.current_period_end
        ? new Date(currentSub.current_period_end)
        : now;
      const candidate = addCivilMonthsServer(currentEnd, -months);
      const clamped = candidate > now ? candidate : now;
      return {
        action: "refund_cumulative_renewal",
        intentId: intent?.id ?? null,
        monthsCount: months,
        newPeriodEnd: clamped.toISOString(),
      };
    }

    if (currentSub.status === "canceled" && currentSub.tier === "read_only") {
      return {
        action: "ignore_duplicate",
        reason: "already_refunded",
      };
    }

    const matchesCurrentPayment = Boolean(
      payment?.id &&
        currentSub.asaas_payment_id &&
        payment.id === currentSub.asaas_payment_id,
    );
    const matchesCurrentSubscription = Boolean(
      payment?.subscription &&
        currentSub.asaas_subscription_id &&
        payment.subscription === currentSub.asaas_subscription_id,
    );

    if (!matchesCurrentPayment && !matchesCurrentSubscription) {
      return {
        action: "ignore_unrelated_payment",
        reason: "refund_for_non_current_payment",
      };
    }

    return {
      action: "mark_refunded",
    };
  }

  // PAYMENT_DELETED afeta apenas faturas/intents pendentes; NUNCA cancela a assinatura inteira.
  if (eventType === "PAYMENT_DELETED") {
    return {
      action: "delete_pending_payment",
      paymentId: payment?.id || "",
    };
  }

  if (eventType === "SUBSCRIPTION_DELETED") {
    const targetSubId = subscription?.id || payment?.subscription || null;
    if (currentSub.cancel_at_period_end === true) {
      return {
        action: "ignore_duplicate",
        reason: "already_cancelled",
      };
    }
    if (
      targetSubId &&
      currentSub.asaas_subscription_id &&
      targetSubId !== currentSub.asaas_subscription_id
    ) {
      return {
        action: "ignore_duplicate",
        reason: "already_cancelled",
      };
    }
    return {
      action: "mark_cancelled",
    };
  }

  if (eventType === "SUBSCRIPTION_UPDATED") {
    const targetSubId = subscription?.id || payment?.subscription || null;
    if (
      targetSubId &&
      currentSub.asaas_subscription_id &&
      targetSubId !== currentSub.asaas_subscription_id
    ) {
      return {
        action: "ignore_duplicate",
        reason: "already_cancelled",
      };
    }
    return {
      action: "sync_subscription_updated",
      subscriptionId: targetSubId || "",
      status: subscription?.status,
      nextDueDate: subscription?.nextDueDate ?? null,
    };
  }

  return {
    action: "unsupported_event",
  };
}
