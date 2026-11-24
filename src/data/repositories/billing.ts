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
      const errorMsg = data?.error || error?.message || "Falha ao processar pagamento com o gateway.";
      throw new AppError("network", errorMsg, error);
    }

    return {
      ...data,
      provider: "asaas",
    } as CheckoutSessionResult;
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
      const errorMsg = data?.error || error?.message || "Falha ao gerar pagamento acumulativo com o gateway.";
      throw new AppError("network", errorMsg, error);
    }

    return {
      ...data,
      provider: "asaas",
    } as CheckoutSessionResult;
  },

  async cancelSubscription(): Promise<void> {
    const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
      body: { action: "cancel" },
    });

    if (error || !data || data.error) {
      const errorMsg = data?.error || error?.message || "Falha ao cancelar assinatura no gateway.";
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
      const errorMsg = data?.error || error?.message || "Falha ao atualizar cartão de crédito.";
      throw new AppError("network", errorMsg, error);
    }
  },

  async listInvoices(): Promise<BillingInvoiceItem[]> {
    const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
      body: { action: "list-invoices" },
    });

    if (error || !data) {
      return [];
    }

    return (data.invoices || []) as BillingInvoiceItem[];
  },

  async schedulePlanChange(targetPlan: "monthly" | "annual"): Promise<{ ok: boolean; message: string }> {
    const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
      body: { action: "schedule-plan-change", targetPlan },
    });

    if (error || !data || data.error) {
      const errorMsg = data?.error || error?.message || "Falha ao agendar mudança de plano.";
      throw new AppError("network", errorMsg, error);
    }

    return { ok: true, message: data.message || "Mudança agendada com sucesso." };
  },

  async cancelScheduledPlanChange(): Promise<{ ok: boolean; message: string }> {
    const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
      body: { action: "cancel-scheduled-plan-change" },
    });

    if (error || !data || data.error) {
      const errorMsg = data?.error || error?.message || "Falha ao cancelar mudança de plano agendada.";
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
