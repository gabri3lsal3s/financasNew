/**
 * Cliente e utilitários para integração com a API v3 do Asaas.
 * Suporta ambiente Sandbox (testes) e Produção.
 */

import { ASAAS_PLAN_CATALOG } from "./asaas-plans.ts";

declare const Deno: {
  env?: {
    get(key: string): string | undefined;
  };
} | undefined;

export interface AsaasCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
}

export interface AsaasCreditCardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasHolderInfoInput {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode?: string;
  addressNumber?: string;
  phone?: string;
}

function getEnv(key: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno.env?.get) {
    return Deno.env.get(key);
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}

export function getAsaasBaseUrl(): string {
  const directUrl = getEnv("ASAAS_API_URL");
  if (directUrl && directUrl.trim().length > 0) {
    return directUrl.trim().replace(/\/+$/, "");
  }
  const env = getEnv("ASAAS_ENVIRONMENT");
  return env === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

export function getAsaasApiKey(): string {
  const key = getEnv("ASAAS_API_KEY");
  if (!key || key.trim().length === 0) {
    throw new Error("Chave ASAAS_API_KEY não configurada no ambiente.");
  }
  return key.trim();
}

async function asaasFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getAsaasBaseUrl();
  const apiKey = getAsaasApiKey();

  const headers = new Headers(options.headers || {});
  headers.set("access_token", apiKey);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg =
      data?.errors?.[0]?.description ||
      data?.message ||
      `Erro Asaas (${response.status}): ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

/**
 * Localiza ou cria um cliente no Asaas a partir do e-mail ou CPF.
 */
export async function findOrCreateAsaasCustomer(input: AsaasCustomerInput): Promise<{ id: string }> {
  const cleanCpf = input.cpfCnpj.replace(/\D/g, "");

  // 1. Tenta buscar por CPF
  if (cleanCpf) {
    const searchByCpf = await asaasFetch<{ data: Array<{ id: string }> }>(
      `/customers?cpfCnpj=${encodeURIComponent(cleanCpf)}`,
    );
    if (searchByCpf.data && searchByCpf.data.length > 0) {
      return { id: searchByCpf.data[0]!.id };
    }
  }

  // 2. Tenta buscar por e-mail
  if (input.email) {
    const searchByEmail = await asaasFetch<{ data: Array<{ id: string }> }>(
      `/customers?email=${encodeURIComponent(input.email)}`,
    );
    if (searchByEmail.data && searchByEmail.data.length > 0) {
      return { id: searchByEmail.data[0]!.id };
    }
  }

  // 3. Cria novo cliente
  const created = await asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: cleanCpf,
      mobilePhone: input.phone?.replace(/\D/g, "") || undefined,
      notificationDisabled: false,
    }),
  });

  return { id: created.id };
}

/**
 * Cria uma assinatura recorrente de Cartão de Crédito (Mensal ou Anual).
 */
export async function createAsaasCreditCardSubscription(params: {
  customerId: string;
  plan: "monthly" | "annual";
  creditCard: AsaasCreditCardInput;
  holderInfo: AsaasHolderInfoInput;
  remoteIp?: string;
}): Promise<{ id: string; status: string }> {
  const planMeta = ASAAS_PLAN_CATALOG[params.plan];
  const value = planMeta.value;
  const cycle = planMeta.cycle;
  const description =
    params.plan === "annual"
      ? "Áxis Finance — Plano Pro Anual"
      : "Áxis Finance — Plano Pro Mensal";

  // Data de vencimento inicial: hoje (formato YYYY-MM-DD)
  const nextDueDate = new Date().toISOString().slice(0, 10);

  const payload = {
    customer: params.customerId,
    billingType: "CREDIT_CARD",
    value,
    nextDueDate,
    cycle,
    description,
    creditCard: {
      holderName: params.creditCard.holderName,
      number: params.creditCard.number.replace(/\D/g, ""),
      expiryMonth: params.creditCard.expiryMonth.padStart(2, "0"),
      expiryYear: params.creditCard.expiryYear.length === 2 ? `20${params.creditCard.expiryYear}` : params.creditCard.expiryYear,
      ccv: params.creditCard.ccv,
    },
    creditCardHolderInfo: {
      name: params.holderInfo.name,
      email: params.holderInfo.email,
      cpfCnpj: params.holderInfo.cpfCnpj.replace(/\D/g, ""),
      postalCode: params.holderInfo.postalCode?.replace(/\D/g, "") || "01310100",
      addressNumber: params.holderInfo.addressNumber || "1",
      phone: params.holderInfo.phone?.replace(/\D/g, "") || "11999999999",
    },
    remoteIp: params.remoteIp || "127.0.0.1",
  };

  return asaasFetch<{ id: string; status: string }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Cria uma cobrança avulsa PIX para o Plano Anual (1 ano de Pro).
 */
export async function createAsaasPixCharge(params: {
  customerId: string;
  value: number;
  description: string;
}): Promise<{ id: string; status: string; value: number }> {
  const dueDate = new Date().toISOString().slice(0, 10);

  return asaasFetch<{ id: string; status: string; value: number }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: params.customerId,
      billingType: "PIX",
      value: params.value,
      dueDate,
      description: params.description,
    }),
  });
}

/**
 * Consulta o QR Code dinâmico (base64) e Copia e Cola de um pagamento PIX.
 */
export async function getAsaasPixQrCode(paymentId: string): Promise<{
  encodedImage: string;
  payload: string;
  expirationDate: string;
}> {
  return asaasFetch<{
    encodedImage: string;
    payload: string;
    expirationDate: string;
  }>(`/payments/${paymentId}/pixQrCode`);
}

/**
 * Consulta os dados de uma cobrança existente no Asaas.
 */
export async function getAsaasPayment(paymentId: string): Promise<{
  id: string;
  status: string;
  value: number;
  dateCreated?: string;
}> {
  return asaasFetch<{
    id: string;
    status: string;
    value: number;
    dateCreated?: string;
  }>(`/payments/${paymentId}`);
}

/**
 * Regra pura para reaproveitamento de cobrança Pix pendente gerada há menos de 1 hora.
 */
export function shouldReusePendingPixCharge(params: {
  paymentStatus: string;
  paymentValue: number;
  expectedValue: number;
  createdAtMillis: number;
  nowMillis?: number;
}): boolean {
  const now = params.nowMillis ?? Date.now();
  const isPending = (params.paymentStatus || "").toUpperCase() === "PENDING";
  const isSameValue = Math.abs(params.paymentValue - params.expectedValue) < 0.01;
  const isRecent = now - params.createdAtMillis < 60 * 60 * 1000 && now >= params.createdAtMillis;
  return isPending && isSameValue && isRecent;
}

/**
 * Cancela uma assinatura recorrente no Asaas.
 */
export async function cancelAsaasSubscription(subscriptionId: string): Promise<{ id: string; deleted: boolean }> {
  return asaasFetch<{ id: string; deleted: boolean }>(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
}

/**
 * Atualiza o cartão de crédito de uma assinatura existente.
 */
export async function updateAsaasSubscriptionCreditCard(
  subscriptionId: string,
  params: {
    creditCard: AsaasCreditCardInput;
    holderInfo: AsaasHolderInfoInput;
    remoteIp?: string;
  },
): Promise<{ id: string; status: string }> {
  const payload = {
    creditCard: {
      holderName: params.creditCard.holderName,
      number: params.creditCard.number.replace(/\D/g, ""),
      expiryMonth: params.creditCard.expiryMonth.padStart(2, "0"),
      expiryYear: params.creditCard.expiryYear.length === 2 ? `20${params.creditCard.expiryYear}` : params.creditCard.expiryYear,
      ccv: params.creditCard.ccv,
    },
    creditCardHolderInfo: {
      name: params.holderInfo.name,
      email: params.holderInfo.email,
      cpfCnpj: params.holderInfo.cpfCnpj.replace(/\D/g, ""),
      postalCode: params.holderInfo.postalCode?.replace(/\D/g, "") || "01310100",
      addressNumber: params.holderInfo.addressNumber || "1",
      phone: params.holderInfo.phone?.replace(/\D/g, "") || "11999999999",
    },
    remoteIp: params.remoteIp || "127.0.0.1",
  };

  return asaasFetch<{ id: string; status: string }>(`/subscriptions/${subscriptionId}/creditCard`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
