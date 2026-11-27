/**
 * Regras puras e orquestração compartilhada de unicidade e ciclo de vida
 * para cobranças PIX avulsas (Plano Anual e Antecipação Acumulativa).
 */

import {
  deleteAsaasPayment,
  getAsaasPayment,
  isAsaasAlreadyCanceledError,
  sanitizePaymentLog,
  shouldReusePendingPixCharge,
} from "./asaas.ts";

export interface PendingPixIntentRow {
  id: string;
  user_id: string;
  kind: "subscription_start" | "plan_change" | "cumulative_renewal" | "reactivation";
  plan_id?: string | null;
  months_count?: number | null;
  amount_cents: number;
  method: string;
  status: string;
  provider_payment_id: string | null;
  expires_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface DesiredPixMatch {
  kind: "cumulative_renewal" | "plan_change" | "subscription_start" | "reactivation";
  monthsCount?: number | null;
  expectedValue: number;
}

export interface AsaasPixPaymentSnapshot {
  id: string;
  status: string;
  value: number;
}

export type PendingPixClassification =
  | { action: "block_already_paid" }
  | { action: "wait_in_flight" }
  | { action: "reuse" }
  | { action: "cancel_and_delete" }
  | { action: "mark_closed_only" };

const CONFIRMED_PIX_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);
const CLOSED_PIX_STATUSES = new Set(["DELETED", "REFUNDED"]);
const CANCELABLE_PIX_STATUSES = new Set(["PENDING", "OVERDUE"]);
const IN_FLIGHT_WINDOW_MS = 15_000;

/**
 * Classifica de forma pura uma intent PIX pendente diante do estado atual no Asaas
 * e do novo pedido do usuário.
 */
export function classifyPendingPixIntent(params: {
  intent: PendingPixIntentRow;
  asaasPayment: AsaasPixPaymentSnapshot | null;
  desired?: DesiredPixMatch;
  nowMillis?: number;
}): PendingPixClassification {
  const { intent, asaasPayment, desired } = params;
  const nowMillis = params.nowMillis ?? Date.now();
  const statusUpper = (asaasPayment?.status || "").toUpperCase();

  if (asaasPayment && CONFIRMED_PIX_STATUSES.has(statusUpper)) {
    return { action: "block_already_paid" };
  }

  if (!intent.provider_payment_id) {
    const createdMillis = Date.parse(intent.created_at);
    const isFreshInFlight =
      Number.isFinite(createdMillis) &&
      nowMillis >= createdMillis &&
      nowMillis - createdMillis < IN_FLIGHT_WINDOW_MS;

    return isFreshInFlight ? { action: "wait_in_flight" } : { action: "mark_closed_only" };
  }

  if (!asaasPayment || CLOSED_PIX_STATUSES.has(statusUpper)) {
    return { action: "mark_closed_only" };
  }

  if (desired) {
    const sameKind = intent.kind === desired.kind;
    const sameMonths =
      desired.kind !== "cumulative_renewal" || intent.months_count === desired.monthsCount;
    const createdAtMillis = Date.parse(intent.created_at);

    if (
      sameKind &&
      sameMonths &&
      Number.isFinite(createdAtMillis) &&
      shouldReusePendingPixCharge({
        paymentStatus: asaasPayment.status,
        paymentValue: asaasPayment.value,
        expectedValue: desired.expectedValue,
        createdAtMillis,
        nowMillis,
      })
    ) {
      return { action: "reuse" };
    }
  }

  if (CANCELABLE_PIX_STATUSES.has(statusUpper)) {
    return { action: "cancel_and_delete" };
  }

  return { action: "mark_closed_only" };
}

type QueryResponse<T> = PromiseLike<{ data: T | null; error: unknown }>;

interface BillingIntentsSelectBuilder extends QueryResponse<PendingPixIntentRow[]> {
  eq(column: string, value: string): BillingIntentsSelectBuilder;
  neq(column: string, value: string): BillingIntentsSelectBuilder;
  order(column: string, options?: { ascending?: boolean }): BillingIntentsSelectBuilder;
}

interface BillingIntentsUpdateBuilder extends QueryResponse<unknown> {
  eq(column: string, value: string): BillingIntentsUpdateBuilder;
}

export interface PixIntentsSupabaseClient {
  from(table: "billing_intents"): {
    select(columns: string): BillingIntentsSelectBuilder;
    update(values: Record<string, unknown>): BillingIntentsUpdateBuilder;
  };
}

export type ReconcilePendingPixResult =
  | { outcome: "reused"; intent: PendingPixIntentRow; canceledPaymentIds: string[] }
  | { outcome: "cleared"; canceledPaymentIds: string[] }
  | { outcome: "already_paid"; paymentId: string }
  | { outcome: "in_flight" }
  | { outcome: "cancel_failed"; error: unknown };

async function markPixIntentStatus(params: {
  supabase: PixIntentsSupabaseClient;
  intent: PendingPixIntentRow;
  targetStatus: "canceled" | "expired";
  cancelReason: string;
  nowIso: string;
}): Promise<void> {
  const { error } = await params.supabase
    .from("billing_intents")
    .update({
      status: params.targetStatus,
      updated_at: params.nowIso,
      metadata: {
        ...(params.intent.metadata || {}),
        canceled_reason: params.cancelReason,
        canceled_at: params.nowIso,
      },
    })
    .eq("id", params.intent.id);

  if (error) {
    console.warn(
      `[pix-intents] Aviso ao atualizar status (${params.targetStatus}) da intent ${params.intent.id}:`,
      sanitizePaymentLog(error),
    );
  }
}

/**
 * Reconcilia todas as intents PIX pendentes de um usuário garantindo a regra
 * de unicidade: reaproveita uma cobrança compatível ainda válida OU cancela
 * no Asaas antes de permitir nova emissão/operação.
 */
export async function reconcileUserPendingPixIntents(params: {
  supabase: PixIntentsSupabaseClient;
  userId: string;
  desired?: DesiredPixMatch;
  onlyPaymentId?: string;
  excludeIntentId?: string;
  targetStatus?: "canceled" | "expired";
  failClosed: boolean;
  cancelReason: string;
  nowMillis?: number;
}): Promise<ReconcilePendingPixResult> {
  const {
    supabase,
    userId,
    desired,
    onlyPaymentId,
    excludeIntentId,
    targetStatus = "canceled",
    failClosed,
    cancelReason,
  } = params;
  const nowMillis = params.nowMillis ?? Date.now();
  const nowIso = new Date(nowMillis).toISOString();

  let query = supabase
    .from("billing_intents")
    .select(
      "id, user_id, kind, plan_id, months_count, amount_cents, method, status, provider_payment_id, expires_at, metadata, created_at",
    )
    .eq("user_id", userId)
    .eq("method", "pix")
    .eq("status", "pending");

  if (onlyPaymentId) {
    query = query.eq("provider_payment_id", onlyPaymentId);
  }

  if (excludeIntentId) {
    query = query.neq("id", excludeIntentId);
  }

  const { data: rows, error: queryErr } = await query.order("created_at", { ascending: false });

  if (queryErr) {
    if (failClosed) {
      return { outcome: "cancel_failed", error: queryErr };
    }
    console.warn("[pix-intents] Falha ao consultar intents PIX pendentes:", sanitizePaymentLog(queryErr));
    return { outcome: "cleared", canceledPaymentIds: [] };
  }

  const pendingRows = rows ?? [];
  const canceledPaymentIds: string[] = [];
  let reusableIntent: PendingPixIntentRow | null = null;

  for (const intent of pendingRows) {
    let asaasPayment: AsaasPixPaymentSnapshot | null = null;

    if (intent.provider_payment_id) {
      try {
        const fetched = await getAsaasPayment(intent.provider_payment_id);
        asaasPayment = {
          id: fetched.id,
          status: fetched.status,
          value: fetched.value,
        };
      } catch (fetchErr: unknown) {
        if (isAsaasAlreadyCanceledError(fetchErr)) {
          asaasPayment = null;
        } else if (failClosed) {
          return { outcome: "cancel_failed", error: fetchErr };
        } else {
          console.warn(
            `[pix-intents] Falha ao consultar pagamento PIX ${intent.provider_payment_id}:`,
            sanitizePaymentLog(fetchErr),
          );
          continue;
        }
      }
    }

    const classification = classifyPendingPixIntent({
      intent,
      asaasPayment,
      desired: reusableIntent ? undefined : desired,
      nowMillis,
    });

    if (classification.action === "wait_in_flight") {
      return { outcome: "in_flight" };
    }

    if (classification.action === "block_already_paid") {
      return { outcome: "already_paid", paymentId: intent.provider_payment_id || "" };
    }

    if (classification.action === "reuse" && !reusableIntent) {
      reusableIntent = intent;
      continue;
    }

    if (classification.action === "cancel_and_delete" && intent.provider_payment_id) {
      try {
        await deleteAsaasPayment(intent.provider_payment_id);
        canceledPaymentIds.push(intent.provider_payment_id);
      } catch (deleteErr: unknown) {
        if (isAsaasAlreadyCanceledError(deleteErr)) {
          canceledPaymentIds.push(intent.provider_payment_id);
        } else if (failClosed) {
          return { outcome: "cancel_failed", error: deleteErr };
        } else {
          console.warn(
            `[pix-intents] Falha ao cancelar cobrança PIX ${intent.provider_payment_id} no Asaas:`,
            sanitizePaymentLog(deleteErr),
          );
          continue;
        }
      }
    }

    await markPixIntentStatus({
      supabase,
      intent,
      targetStatus,
      cancelReason,
      nowIso,
    });
  }

  if (reusableIntent) {
    return {
      outcome: "reused",
      intent: reusableIntent,
      canceledPaymentIds,
    };
  }

  return {
    outcome: "cleared",
    canceledPaymentIds,
  };
}

/**
 * Cancela cobranças PIX pendentes em modo best-effort (não bloqueia a operação
 * principal em caso de erro transitório do gateway).
 */
export async function cleanupPendingPixBestEffort(params: {
  supabase: PixIntentsSupabaseClient;
  userId: string;
  cancelReason: string;
  excludeIntentId?: string;
  logPrefix?: string;
}): Promise<void> {
  try {
    await reconcileUserPendingPixIntents({
      supabase: params.supabase,
      userId: params.userId,
      excludeIntentId: params.excludeIntentId,
      failClosed: false,
      cancelReason: params.cancelReason,
    });
  } catch (err: unknown) {
    console.warn(
      `${params.logPrefix ?? "[pix-intents]"} Aviso na limpeza best-effort de Pix pendente:`,
      sanitizePaymentLog(err),
    );
  }
}
