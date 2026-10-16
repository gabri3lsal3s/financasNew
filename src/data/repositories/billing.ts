import { getSupabase } from "@/data/client";
import { AppError } from "@/services/errors";

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
  /** Dias residuais de trial gratuitos a postergar antes do primeiro débito (0 para cobrança imediata). */
  trialDaysRemaining?: number;
  /** Data prevista da primeira cobrança calculada no cliente (ISO string). */
  firstBillingDate?: string;
}

export interface CheckoutPixParams {
  plan: "annual";
  method: "pix";
  cpf: string;
  phone?: string;
}

export type CheckoutParams = CheckoutCreditCardParams | CheckoutPixParams;

export interface PixCheckoutResult {
  ok: true;
  method: "pix";
  paymentId: string;
  qrCodeBase64: string;
  copyPasteKey: string;
  expirationDate: string;
}

export interface CreditCardCheckoutResult {
  ok: true;
  method: "credit_card";
  subscriptionId: string;
  tier: "pro_annual" | "pro_monthly";
}

export type CheckoutResult = PixCheckoutResult | CreditCardCheckoutResult;

/**
 * Inicia uma sessão de checkout com o Asaas via Edge Function.
 */
export async function createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
  const { data, error } = await getSupabase().functions.invoke("asaas-checkout", {
    body: params,
  });

  if (error || !data || data.error) {
    const errorMsg = data?.error || error?.message || "Falha ao processar pagamento com o gateway.";
    throw new AppError("network", errorMsg, error);
  }

  return data as CheckoutResult;
}

/**
 * Cancela a renovação da assinatura Pro no Asaas via Edge Function.
 */
export async function cancelSubscription(): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
    body: { action: "cancel" },
  });

  if (error || !data || data.error) {
    const errorMsg = data?.error || error?.message || "Falha ao cancelar assinatura no gateway.";
    throw new AppError("network", errorMsg, error);
  }
}

/**
 * Atualiza o cartão de crédito da assinatura no Asaas via Edge Function.
 */
export async function updateSubscriptionCreditCard(card: {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  postalCode?: string;
  addressNumber?: string;
  phone?: string;
}): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke("asaas-manage", {
    body: { action: "update-card", card },
  });

  if (error || !data || data.error) {
    const errorMsg = data?.error || error?.message || "Falha ao atualizar cartão de crédito.";
    throw new AppError("network", errorMsg, error);
  }
}
