import { getSupabase } from "@/data/client";
import { AppError } from "@/services/errors";
import type {
  BillingProviderAdapter,
  BillingProviderName,
  CancelSubscriptionParams,
  CheckoutSessionResult,
  CreateCheckoutParams,
  CreditCardPayload,
  CustomerBillingDetails,
  DirectCreditCardResult,
  HostedSessionResult,
  PixCheckoutResult,
  UpdatePaymentParams,
} from "@/types/billing";

export type {
  BillingProviderAdapter,
  BillingProviderName,
  CancelSubscriptionParams,
  CheckoutSessionResult,
  CreateCheckoutParams,
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
// Adaptador Asaas (Brasil - PIX Dinâmico e Cartão de Crédito Transparente)
// ============================================================================

export const asaasBillingAdapter: BillingProviderAdapter = {
  providerName: "asaas",

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const payload = {
      plan: params.plan,
      method: params.method,
      cpf: params.customer.cpf,
      phone: params.customer.phone,
      card: params.card,
      trialDaysRemaining: params.trialDaysRemaining,
      firstBillingDate: params.firstBillingDate,
      name: params.customer.name,
      email: params.customer.email,
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
    const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
      body: {
        action: "update-card",
        card: params.card,
      },
    });

    if (error || !data || data.error) {
      const errorMsg = data?.error || error?.message || "Falha ao atualizar cartão de crédito.";
      throw new AppError("network", errorMsg, error);
    }
  },
};

// ============================================================================
// Adaptador Stripe (Global - Checkout Sessions e Customer Portal)
// ============================================================================

export const stripeBillingAdapter: BillingProviderAdapter = {
  providerName: "stripe",

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const payload = {
      plan: params.plan,
      method: params.method,
      customer: params.customer,
      trialDaysRemaining: params.trialDaysRemaining,
      firstBillingDate: params.firstBillingDate,
      successUrl: params.successUrl || `${window.location.origin}/assinatura/sucesso?plano=${params.plan}`,
      cancelUrl: params.cancelUrl || `${window.location.origin}/assinatura?status=cancelado`,
    };

    const { data, error } = await getSupabase().functions.invoke("stripe-checkout", {
      body: payload,
    });

    if (error || !data || data.error) {
      const errorMsg = data?.error || error?.message || "Falha ao iniciar checkout no Stripe.";
      throw new AppError("network", errorMsg, error);
    }

    if (data.checkoutUrl) {
      return {
        ok: true,
        method: "hosted_session",
        provider: "stripe",
        checkoutUrl: data.checkoutUrl,
        sessionId: data.sessionId || data.id,
      };
    }

    return {
      ...data,
      provider: "stripe",
    } as CheckoutSessionResult;
  },

  async cancelSubscription(params?: CancelSubscriptionParams): Promise<void> {
    const { data, error } = await getSupabase().functions.invoke("stripe-manage", {
      body: {
        action: "cancel",
        subscriptionId: params?.subscriptionId,
        immediate: params?.immediate ?? false,
      },
    });

    if (error || !data || data.error) {
      const errorMsg = data?.error || error?.message || "Falha ao cancelar assinatura no Stripe.";
      throw new AppError("network", errorMsg, error);
    }
  },

  async updatePaymentMethod(params: UpdatePaymentParams): Promise<void> {
    const { data, error } = await getSupabase().functions.invoke("stripe-manage", {
      body: {
        action: "update-payment-method",
        subscriptionId: params.subscriptionId,
        card: params.card,
        returnUrl: params.returnUrl || `${window.location.origin}/configuracoes`,
      },
    });

    if (error || !data || data.error) {
      const errorMsg = data?.error || error?.message || "Falha ao atualizar forma de pagamento no Stripe.";
      throw new AppError("network", errorMsg, error);
    }
  },

  async getBillingPortalUrl(customerId: string, returnUrl?: string): Promise<string> {
    const { data, error } = await getSupabase().functions.invoke("stripe-manage", {
      body: {
        action: "portal",
        customerId,
        returnUrl: returnUrl || `${window.location.origin}/configuracoes`,
      },
    });

    if (error || !data || data.error || !data.portalUrl) {
      const errorMsg = data?.error || error?.message || "Falha ao obter portal de faturamento Stripe.";
      throw new AppError("network", errorMsg, error);
    }

    return data.portalUrl as string;
  },
};

// ============================================================================
// Despachante & Resolução Dinâmica de Provedor
// ============================================================================

/**
 * Retorna o adaptador de faturamento ativo baseado no provedor solicitado
 * ou na variável de ambiente de configuração padrão do app.
 */
export function getBillingAdapter(provider?: BillingProviderName): BillingProviderAdapter {
  const selectedProvider: BillingProviderName =
    provider ||
    (import.meta.env.VITE_DEFAULT_BILLING_PROVIDER as BillingProviderName) ||
    "asaas";

  switch (selectedProvider) {
    case "stripe":
      return stripeBillingAdapter;
    case "asaas":
    default:
      return asaasBillingAdapter;
  }
}

// ============================================================================
// Funções Canônicas Exportadas da Camada de Repositório
// ============================================================================

/**
 * Normaliza parâmetros de checkout de formatos legados para o contrato canônico CreateCheckoutParams.
 */
function normalizeCheckoutParams(params: CheckoutParams): CreateCheckoutParams {
  if ("customer" in params) {
    return params;
  }

  // Parâmetros legados Asaas
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
    trialDaysRemaining: (params as CheckoutCreditCardParams).trialDaysRemaining,
    firstBillingDate: (params as CheckoutCreditCardParams).firstBillingDate,
  };
}

/**
 * Inicia uma sessão de checkout com o provedor de faturamento ativo.
 */
export async function createCheckoutSession(
  params: CheckoutParams,
  provider?: BillingProviderName,
): Promise<CheckoutSessionResult> {
  const adapter = getBillingAdapter(provider);
  const canonicalParams = normalizeCheckoutParams(params);
  return adapter.createCheckoutSession(canonicalParams);
}

/**
 * Cancela a renovação da assinatura no provedor de faturamento ativo.
 */
export async function cancelSubscription(
  params?: CancelSubscriptionParams,
  provider?: BillingProviderName,
): Promise<void> {
  const adapter = getBillingAdapter(provider);
  return adapter.cancelSubscription(params);
}

/**
 * Atualiza a forma de pagamento cadastrada no provedor ativo.
 */
export async function updatePaymentMethod(
  params: UpdatePaymentParams,
  provider?: BillingProviderName,
): Promise<void> {
  const adapter = getBillingAdapter(provider);
  return adapter.updatePaymentMethod(params);
}

/**
 * Atualiza o cartão de crédito da assinatura ativa (compatibilidade direta).
 */
export async function updateSubscriptionCreditCard(
  card: CreditCardPayload,
  provider?: BillingProviderName,
): Promise<void> {
  return updatePaymentMethod({ subscriptionId: "", card }, provider);
}

/**
 * Obtém a URL do portal de autoatendimento do cliente (quando suportado pelo gateway).
 */
export async function getBillingPortalUrl(
  customerId: string,
  returnUrl?: string,
  provider?: BillingProviderName,
): Promise<string> {
  const adapter = getBillingAdapter(provider);
  if (!adapter.getBillingPortalUrl) {
    throw new AppError("validation", "O provedor atual não possui portal de autoatendimento hospedado.");
  }
  return adapter.getBillingPortalUrl(customerId, returnUrl);
}
