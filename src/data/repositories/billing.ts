import { z } from "zod";
import { getSupabase } from "@/data/client";
import { getMyBillingContact as getMyBillingContactRpc } from "@/data/rpc";
import { AppError } from "@/services/errors";
import type {
  BillingContactInfo,
  BillingInvoiceItem,
  BillingProviderAdapter,
  BillingProviderName,
  CancelSubscriptionParams,
  CheckoutSessionResult,
  CreateCheckoutParams,
  CreateCumulativeCheckoutParams,
  CreditCardPayload,
  CustomerBillingDetails,
  DirectCreditCardResult,
  HostedSessionResult,
  PixCheckoutResult,
  UpdatePaymentParams,
} from "@/types/billing";

const ProviderSchema = z.enum(["asaas", "stripe", "manual"]).default("asaas");

const PixCheckoutSchema = z.object({
  ok: z.literal(true),
  method: z.literal("pix"),
  provider: ProviderSchema,
  paymentId: z.string().min(1),
  qrCodeBase64: z.string().min(1),
  copyPasteKey: z.string().min(1),
  expirationDate: z.string().min(1),
  needsEmailConfirmation: z.boolean().optional(),
  email: z.string().optional(),
});

const DirectCreditCardSchema = z.object({
  ok: z.literal(true),
  method: z.literal("credit_card"),
  provider: ProviderSchema,
  subscriptionId: z.string().optional(),
  paymentId: z.string().optional(),
  tier: z.enum(["free", "pro_monthly", "pro_annual", "lifetime"]).optional(),
  status: z.enum(["active", "trialing", "pending", "incomplete"]).optional(),
  phase: z.enum(["trial_scheduled", "immediate"]).optional(),
  firstChargeAt: z.string().optional(),
  needsEmailConfirmation: z.boolean().optional(),
  email: z.string().optional(),
  cardLast4: z.string().optional(),
});

const HostedSessionSchema = z.object({
  ok: z.literal(true),
  method: z.literal("hosted_session"),
  provider: ProviderSchema,
  checkoutUrl: z.string().url(),
  sessionId: z.string().min(1),
});

const CheckoutSessionResultSchema = z.discriminatedUnion("method", [
  PixCheckoutSchema,
  DirectCreditCardSchema,
  HostedSessionSchema,
]);

const BillingInvoiceItemSchema = z.object({
  id: z.string(),
  status: z.string(),
  value: z.number(),
  dueDate: z.string(),
  paymentDate: z.string().nullable().optional(),
  invoiceUrl: z.string().nullable().optional(),
  billingType: z.string(),
  description: z.string().nullable().optional(),
});

const BillingInvoicesResponseSchema = z.object({
  invoices: z.array(BillingInvoiceItemSchema).optional(),
  error: z.string().optional(),
});

function parseCheckoutSessionResult(raw: unknown): CheckoutSessionResult {
  const candidate =
    raw && typeof raw === "object"
      ? { ...(raw as Record<string, unknown>), provider: (raw as Record<string, unknown>).provider ?? "asaas" }
      : raw;
  const parsed = CheckoutSessionResultSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AppError("network", "Resposta inválida do gateway de pagamento.", parsed.error);
  }
  return parsed.data as CheckoutSessionResult;
}

export type {
  BillingContactInfo,
  BillingInvoiceItem,
  BillingProviderAdapter,
  BillingProviderName,
  CancelSubscriptionParams,
  CheckoutSessionResult,
  CreateCheckoutParams,
  CreateCumulativeCheckoutParams,
  CreditCardPayload,
  CustomerBillingDetails,
  DirectCreditCardResult,
  HostedSessionResult,
  PixCheckoutResult,
  UpdatePaymentParams,
};

// ============================================================================
// Tipos de Parâmetros e Resultados Legados (Retrocompatibilidade)
// ============================================================================

export interface CheckoutCreditCardParams {
  plan: "monthly" | "annual";
  method: "credit_card";
  cpf: string;
  card: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
    phone?: string;
    postalCode?: string;
    addressNumber?: string;
  };
  phone?: string;
  trialDaysRemaining?: number;
  firstBillingDate?: string;
}

export interface CheckoutPixParams {
  plan: "annual";
  method: "pix";
  cpf: string;
  phone?: string;
}

export type CheckoutParams = CheckoutCreditCardParams | CheckoutPixParams | CreateCheckoutParams;

export type CheckoutResult = CheckoutSessionResult;

// ============================================================================
// Adaptador Asaas (Brasil - PIX Dinâmico, Cartão Transparente e Acumulativo)
// ============================================================================

/**
 * Extrai a mensagem de erro real retornada no corpo JSON de uma Edge Function
 * quando o SDK do Supabase encapsula respostas não-2xx em `FunctionsHttpError`.
 */
async function extractEdgeFunctionError(
  data: { error?: string } | null | undefined,
  error: unknown,
  fallback: string,
): Promise<string> {
  if (typeof data?.error === "string" && data.error.trim().length > 0) {
    return data.error;
  }

  const errObj = error as { message?: string; context?: unknown } | null | undefined;
  const ctx = errObj?.context;
  if (ctx && typeof ctx === "object") {
    try {
      const responseLike = ctx as { clone?: () => { json?: () => Promise<unknown> }; json?: () => Promise<unknown> };
      const target = typeof responseLike.clone === "function" ? responseLike.clone() : responseLike;
      if (typeof target.json === "function") {
        const body = (await target.json()) as { error?: unknown; message?: unknown } | null;
        if (typeof body?.error === "string" && body.error.trim().length > 0) {
          return body.error;
        }
        if (typeof body?.message === "string" && body.message.trim().length > 0) {
          return body.message;
        }
      }
    } catch {
      // Ignora corpo não-JSON e segue para o fallback abaixo.
    }
  }

  if (
    typeof errObj?.message === "string" &&
    errObj.message.trim().length > 0 &&
    !/edge function returned a non-2xx status code/i.test(errObj.message)
  ) {
    return errObj.message;
  }

  return fallback;
}

export const asaasBillingAdapter: BillingProviderAdapter = {
  providerName: "asaas",

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const cleanPhone =
      (params.customer.phone || params.card?.phone || "").replace(/\D/g, "") || undefined;
    const cleanPostalCode =
      (params.customer.postalCode || params.card?.postalCode || "").replace(/\D/g, "") ||
      undefined;
    const cleanAddressNumber =
      (params.customer.addressNumber || params.card?.addressNumber || "").trim() || undefined;

    const normalizedCard = params.card
      ? {
          ...params.card,
          ...(cleanPhone ? { phone: cleanPhone } : {}),
          ...(cleanPostalCode ? { postalCode: cleanPostalCode } : {}),
          ...(cleanAddressNumber ? { addressNumber: cleanAddressNumber } : {}),
        }
      : undefined;

    const payload = {
      plan: params.plan,
      method: params.method,
      cpf: params.customer.cpf,
      phone: cleanPhone,
      postalCode: cleanPostalCode,
      addressNumber: cleanAddressNumber,
      card: normalizedCard,
      name: params.customer.name,
      email: params.customer.email,
      registration: params.registration,
    };

    const { data, error } = await getSupabase().functions.invoke("asaas-checkout", {
      body: payload,
    });

    if (error || !data || data.error) {
      const errorMsg = await extractEdgeFunctionError(
        data,
        error,
        "Falha ao processar pagamento com o gateway.",
      );
      throw new AppError("network", errorMsg, error);
    }

    return parseCheckoutSessionResult(data);
  },

  async createCumulativeCheckoutSession(params: CreateCumulativeCheckoutParams): Promise<CheckoutSessionResult> {
    const payload = {
      kind: "cumulative_months",
      months: params.months,
      method: params.method,
      card: params.card,
      phone: params.phone,
    };

    const { data, error } = await getSupabase().functions.invoke("asaas-checkout", {
      body: payload,
    });

    if (error || !data || data.error) {
      const errorMsg = await extractEdgeFunctionError(
        data,
        error,
        "Falha ao gerar pagamento acumulativo com o gateway.",
      );
      throw new AppError("network", errorMsg, error);
    }

    return parseCheckoutSessionResult(data);
  },

  async cancelSubscription(): Promise<void> {
    const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
      body: { action: "cancel" },
    });

    if (error || !data || data.error) {
      const errorMsg = await extractEdgeFunctionError(
        data,
        error,
        "Falha ao cancelar assinatura no gateway.",
      );
      throw new AppError("network", errorMsg, error);
    }
  },

  async updatePaymentMethod(params: UpdatePaymentParams): Promise<void> {
    const cleanPhone = params.card?.phone ? params.card.phone.replace(/\D/g, "") : undefined;
    const cleanPostalCode = params.card?.postalCode
      ? params.card.postalCode.replace(/\D/g, "")
      : undefined;
    const cleanAddressNumber = params.card?.addressNumber
      ? params.card.addressNumber.trim()
      : undefined;

    const normalizedCard = params.card
      ? {
          ...params.card,
          ...(cleanPhone ? { phone: cleanPhone } : {}),
          ...(cleanPostalCode ? { postalCode: cleanPostalCode } : {}),
          ...(cleanAddressNumber ? { addressNumber: cleanAddressNumber } : {}),
        }
      : undefined;

    const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
      body: {
        action: "update-card",
        card: normalizedCard,
      },
    });

    if (error || !data || data.error) {
      const errorMsg = await extractEdgeFunctionError(
        data,
        error,
        "Falha ao atualizar cartão de crédito.",
      );
      throw new AppError("network", errorMsg, error);
    }
  },

  async listInvoices(): Promise<BillingInvoiceItem[]> {
    const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
      body: { action: "list-invoices" },
    });

    if (error || !data) {
      const errorMsg = await extractEdgeFunctionError(
        data,
        error,
        "Não foi possível carregar as faturas no momento.",
      );
      throw new AppError("network", errorMsg, error);
    }

    const parsed = BillingInvoicesResponseSchema.safeParse(data);
    if (!parsed.success || parsed.data.error) {
      throw new AppError(
        "network",
        (parsed.success ? parsed.data.error : undefined) ||
          "Resposta inválida ao carregar faturas.",
        parsed.success ? null : parsed.error,
      );
    }

    return (parsed.data.invoices ?? []) as BillingInvoiceItem[];
  },

  async schedulePlanChange(targetPlan: "monthly" | "annual"): Promise<{ ok: boolean; message: string }> {
    const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
      body: { action: "schedule-plan-change", targetPlan },
    });

    if (error || !data || data.error) {
      const errorMsg = await extractEdgeFunctionError(
        data,
        error,
        "Falha ao agendar mudança de plano.",
      );
      throw new AppError("network", errorMsg, error);
    }

    return { ok: true, message: data.message || "Mudança agendada com sucesso." };
  },

  async cancelScheduledPlanChange(): Promise<{ ok: boolean; message: string }> {
    const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
      body: { action: "cancel-scheduled-plan-change" },
    });

    if (error || !data || data.error) {
      const errorMsg = await extractEdgeFunctionError(
        data,
        error,
        "Falha ao cancelar mudança de plano agendada.",
      );
      throw new AppError("network", errorMsg, error);
    }

    return { ok: true, message: data.message || "Agendamento cancelado com sucesso." };
  },
};

// ============================================================================
// Despachante & Resolução Canônica do Provedor Oficial (Asaas)
// ============================================================================

export function getBillingAdapter(): BillingProviderAdapter {
  return asaasBillingAdapter;
}

// ============================================================================
// Funções Canônicas Exportadas da Camada de Repositório
// ============================================================================

function normalizeCheckoutParams(params: CheckoutParams): CreateCheckoutParams {
  if ("customer" in params) {
    return params;
  }

  return {
    plan: params.plan,
    method: params.method,
    customer: {
      name: (params as CheckoutCreditCardParams).card?.holderName || "",
      email: "",
      cpf: params.cpf,
      phone: params.phone,
      postalCode: (params as CheckoutCreditCardParams).card?.postalCode,
      addressNumber: (params as CheckoutCreditCardParams).card?.addressNumber,
    },
    card: (params as CheckoutCreditCardParams).card,
  };
}

export async function createCheckoutSession(params: CheckoutParams): Promise<CheckoutSessionResult> {
  const adapter = getBillingAdapter();
  const canonicalParams = normalizeCheckoutParams(params);
  return adapter.createCheckoutSession(canonicalParams);
}

export async function createCumulativeCheckoutSession(
  params: CreateCumulativeCheckoutParams,
): Promise<CheckoutSessionResult> {
  const adapter = getBillingAdapter();
  if (adapter.createCumulativeCheckoutSession) {
    return adapter.createCumulativeCheckoutSession(params);
  }
  throw new AppError("validation", "Provedor atual não suporta pagamento acumulativo.");
}

export async function cancelSubscription(params?: CancelSubscriptionParams): Promise<void> {
  const adapter = getBillingAdapter();
  return adapter.cancelSubscription(params);
}

export async function updatePaymentMethod(params: UpdatePaymentParams): Promise<void> {
  const adapter = getBillingAdapter();
  return adapter.updatePaymentMethod(params);
}

export async function updateSubscriptionCreditCard(card: CreditCardPayload): Promise<void> {
  return updatePaymentMethod({ subscriptionId: "", card });
}

/**
 * Busca os dados de contato de cobrança do usuário autenticado via RPC SECURITY DEFINER (D-02),
 * evitando SELECT direto nas colunas PII de `profiles`.
 */
export async function getMyBillingContact(): Promise<BillingContactInfo | null> {
  const raw = await getMyBillingContactRpc();
  if (!raw) return null;

  return {
    name: raw.name ?? null,
    email: raw.email ?? null,
    cpf: raw.cpf ?? null,
    maskedCpf: raw.masked_cpf ?? null,
    phone: raw.phone ?? null,
    postalCode: raw.postal_code ?? null,
    addressNumber: raw.address_number ?? null,
  };
}

export async function listInvoices(): Promise<BillingInvoiceItem[]> {
  const adapter = getBillingAdapter();
  if (adapter.listInvoices) {
    return adapter.listInvoices();
  }
  return [];
}

export async function schedulePlanChange(targetPlan: "monthly" | "annual"): Promise<{ ok: boolean; message: string }> {
  const adapter = getBillingAdapter();
  if (adapter.schedulePlanChange) {
    return adapter.schedulePlanChange(targetPlan);
  }
  throw new AppError("validation", "Provedor atual não suporta agendamento de troca de plano.");
}

export async function cancelScheduledPlanChange(): Promise<{ ok: boolean; message: string }> {
  const adapter = getBillingAdapter();
  if (adapter.cancelScheduledPlanChange) {
    return adapter.cancelScheduledPlanChange();
  }
  throw new AppError("validation", "Provedor atual não possui cancelamento de troca agendada.");
}
