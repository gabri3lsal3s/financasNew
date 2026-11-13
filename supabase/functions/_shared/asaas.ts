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

/**
 * Validação pura de CPF por Módulo 11 da Receita Federal.
 */
export function isValidCPF(value: string): boolean {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  const remainder1 = sum1 % 11;
  const digit1 = remainder1 < 2 ? 0 : 11 - remainder1;
  if (digit1 !== parseInt(digits.charAt(9), 10)) return false;

  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  const remainder2 = sum2 % 11;
  const digit2 = remainder2 < 2 ? 0 : 11 - remainder2;
  if (digit2 !== parseInt(digits.charAt(10), 10)) return false;

  return true;
}

/**
 * Validação pura de checksum de cartão de crédito via Algoritmo de Luhn (Mod 10).
 */
export function isValidLuhn(cardNumber: string): boolean {
  const digits = (cardNumber || "").replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Validação pura de data de expiração de cartão (mês 1-12 e não expirado).
 */
export function isValidCardExpiry(monthStr: string, yearStr: string, referenceDate: Date = new Date()): boolean {
  const month = parseInt(monthStr, 10);
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;

  let year = parseInt(yearStr, 10);
  if (!Number.isInteger(year)) return false;
  if (yearStr.length === 2) {
    year += 2000;
  }

  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  if (year > currentYear + 25) return false;

  return true;
}

/**
 * Sanitizador de payload para prevenção de vazamento de PAN e CCV em logs (PCI-DSS).
 */
export function sanitizePaymentLog<T>(data: T): T {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizePaymentLog(item)) as unknown as T;
  }

  const copy: Record<string, unknown> = { ...(data as Record<string, unknown>) };

  for (const key of Object.keys(copy)) {
    const lower = key.toLowerCase();
    const val = copy[key];

    if (lower === "ccv" || lower === "cvv") {
      copy[key] = "***";
    } else if (lower === "number" && typeof val === "string") {
      const clean = val.replace(/\D/g, "");
      if (clean.length >= 8) {
        copy[key] = `**** **** **** ${clean.slice(-4)}`;
      } else {
        copy[key] = "***";
      }
    } else if (lower === "creditcard" && val && typeof val === "object") {
      copy[key] = sanitizePaymentLog(val);
    } else if (typeof val === "object" && val !== null) {
      copy[key] = sanitizePaymentLog(val);
    }
  }

  return copy as T;
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
  nextDueDate?: string;
  remoteIp?: string;
}): Promise<{ id: string; status: string }> {
  const planMeta = ASAAS_PLAN_CATALOG[params.plan];
  const value = planMeta.value;
  const cycle = planMeta.cycle;
  const description =
    params.plan === "annual"
      ? "Axir — Plano Pro Anual"
      : "Axir — Plano Pro Mensal";

  // Data de vencimento inicial: se fornecida data futura válida (formato YYYY-MM-DD), respeita o período de teste; senão, hoje
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextDueDate =
    params.nextDueDate && params.nextDueDate >= todayIso
      ? params.nextDueDate.slice(0, 10)
      : todayIso;

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

/**
 * Realiza o estorno/reembolso integral ou parcial de uma cobrança no Asaas (Pix ou Cartão).
 */
export async function refundAsaasPayment(
  paymentId: string,
  description?: string,
): Promise<{ id: string; status: string; value?: number }> {
  return asaasFetch<{ id: string; status: string; value?: number }>(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({
      description: description || "Cancelamento dentro do prazo legal de 7 dias (CDC)",
    }),
  });
}

export interface AsaasPaymentListItem {
  id: string;
  dateCreated: string;
  value: number;
  netValue?: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  transactionReceiptUrl?: string | null;
  invoiceNumber?: string | null;
  description?: string | null;
}

/**
 * Consulta a lista de cobranças e faturas de um cliente no Asaas.
 */
export async function listAsaasCustomerPayments(
  customerId: string,
  limit = 20,
): Promise<AsaasPaymentListItem[]> {
  const result = await asaasFetch<{
    data?: AsaasPaymentListItem[];
  }>(`/payments?customer=${encodeURIComponent(customerId)}&limit=${limit}&order=desc`);

  return result.data || [];
}

/**
 * Atualiza o ciclo e valor de uma assinatura recorrente no Asaas (ex: migração Mensal -> Anual).
 */
export async function updateAsaasSubscriptionCycle(
  subscriptionId: string,
  params: {
    value: number;
    cycle: "MONTHLY" | "YEARLY";
  },
): Promise<{ id: string; status: string }> {
  return asaasFetch<{ id: string; status: string }>(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({
      value: params.value,
      cycle: params.cycle,
      updatePendingPayments: true,
    }),
  });
}

/**
 * Traduz e sanitiza mensagens de recusa da adquirente / Asaas em mensagens
 * claras e acionáveis para o usuário, sem expor rastros internos de infraestrutura.
 */
export function mapAsaasCardErrorMessage(errorMsg: string): string | null {
  if (!errorMsg || typeof errorMsg !== "string") return null;

  const lower = errorMsg.toLowerCase();

  if (lower.includes("não autorizado") || lower.includes("nao autorizado") || lower.includes("recusad") || lower.includes("negad") || lower.includes("declined")) {
    return "Transação não autorizada pela emissora do seu cartão. Verifique com seu banco ou tente outro cartão.";
  }
  if (lower.includes("saldo insuficiente") || lower.includes("limite insuficiente") || lower.includes("sem limite") || lower.includes("insufficient funds")) {
    return "Limite de crédito insuficiente no cartão para concluir a assinatura.";
  }
  if (lower.includes("código de segurança") || lower.includes("cvv") || lower.includes("ccv") || lower.includes("security code")) {
    return "Código de segurança (CVV) incorreto ou inválido.";
  }
  if (lower.includes("expirado") || lower.includes("vencido") || lower.includes("validade") || lower.includes("expired")) {
    return "Data de validade do cartão incorreta ou cartão vencido.";
  }
  if (lower.includes("bloqueado") || lower.includes("blocked") || lower.includes("cartão inválido") || lower.includes("cartao invalido")) {
    return "Cartão de crédito bloqueado ou inválido. Utilize outro cartão.";
  }
  if (lower.includes("cpf") || lower.includes("cnpj")) {
    return "CPF/CNPJ do titular inválido ou inconsistente junto à Receita Federal.";
  }

  return null;
}


