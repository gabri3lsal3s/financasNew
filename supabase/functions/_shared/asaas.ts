/**
 * Cliente e utilitários para integração com a API v3 do Asaas.
 * Suporta ambiente Sandbox (testes) e Produção.
 */

import { ASAAS_PLAN_CATALOG } from "./asaas-plans.ts";
import { maskEmailForLog, sanitizeLogString } from "./http.ts";

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
 * Formata uma data no padrão civil ISO (YYYY-MM-DD) no fuso oficial do Asaas (America/Sao_Paulo).
 */
export function formatBrtIsoDate(date: Date | string = new Date()): string {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data inválida fornecida a formatBrtIsoDate.");
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

/**
 * Formata uma data no padrão brasileiro dd/MM/yyyy em America/Sao_Paulo.
 */
export function formatBrtDisplayDate(date: Date | string): string {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const [y, m, d] = date.trim().split("-");
    return `${d}/${m}/${y}`;
  }
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

/**
 * Validação pura de data de expiração de cartão (mês 1-12 e não expirado em BRT).
 */
export function isValidCardExpiry(monthStr: string, yearStr: string, referenceDate: Date = new Date()): boolean {
  const month = parseInt(monthStr, 10);
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;

  let year = parseInt(yearStr, 10);
  if (!Number.isInteger(year)) return false;
  if (yearStr.length === 2) {
    year += 2000;
  }

  const brtDate = formatBrtIsoDate(referenceDate);
  const currentYear = parseInt(brtDate.slice(0, 4), 10);
  const currentMonth = parseInt(brtDate.slice(5, 7), 10);

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  if (year > currentYear + 25) return false;

  return true;
}

/**
 * Sanitizador de payload e strings para prevenção de vazamento de PAN, CVV e PII em logs (PCI-DSS / LGPD).
 */
export function sanitizePaymentLog<T>(data: T): T {
  if (typeof data === "string") {
    return sanitizeLogString(data) as unknown as T;
  }
  if (data instanceof Error) {
    return sanitizeLogString(data.message) as unknown as T;
  }
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizePaymentLog(item)) as unknown as T;
  }

  const copy: Record<string, unknown> = { ...(data as Record<string, unknown>) };

  for (const key of Object.keys(copy)) {
    const lower = key.toLowerCase();
    const val = copy[key];

    if (lower === "ccv" || lower === "cvv" || lower === "cvc" || lower === "securitycode") {
      copy[key] = "***";
    } else if (
      (lower === "number" || lower === "cardnumber" || lower === "pan") &&
      typeof val === "string"
    ) {
      const clean = val.replace(/\D/g, "");
      if (clean.length >= 8) {
        copy[key] = `**** **** **** ${clean.slice(-4)}`;
      } else {
        copy[key] = "***";
      }
    } else if (lower === "cpf" || lower === "cpfcnpj") {
      copy[key] = "***.***.***-**";
    } else if (lower === "email" && typeof val === "string") {
      copy[key] = maskEmailForLog(val);
    } else if (lower === "phone" || lower === "mobilephone") {
      copy[key] = "(XX) *****-****";
    } else if (
      lower === "postalcode" ||
      lower === "addressnumber" ||
      lower === "address" ||
      lower === "complement" ||
      lower === "creditcardtoken" ||
      lower === "remoteip"
    ) {
      copy[key] = "***";
    } else if (typeof val === "string") {
      copy[key] = sanitizeLogString(val);
    } else if (typeof val === "object" && val !== null) {
      copy[key] = sanitizePaymentLog(val);
    }
  }

  return copy as T;
}

/**
 * Identifica se um erro do Asaas indica que o recurso já não existe ou já foi cancelado/removido.
 */
export function isAsaasAlreadyCanceledError(err: unknown): boolean {
  if (!err) return false;
  const status = (err as { status?: number }).status;
  if (status === 404) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("404") ||
    msg.includes("not found") ||
    msg.includes("não encontrad") ||
    msg.includes("nao encontrad") ||
    msg.includes("já removid") ||
    msg.includes("ja removid") ||
    msg.includes("already removed") ||
    msg.includes("already deleted") ||
    msg.includes("já cancelad") ||
    msg.includes("ja cancelad")
  );
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

/**
 * Trava anti-mismatch Sandbox vs. Produção.
 */
export function assertAsaasEnvironmentMatch(apiKey: string, baseUrl: string): void {
  const isHmlgKey = apiKey.startsWith("$aact_hmlg_");
  const isProdKey = apiKey.startsWith("$aact_prod_");
  const isSandboxUrl = baseUrl.includes("sandbox.asaas.com") || baseUrl.includes("api-sandbox.asaas.com");
  const isProdUrl = baseUrl.includes("api.asaas.com") && !baseUrl.includes("sandbox");

  if (isHmlgKey && isProdUrl) {
    throw new Error("Incompatibilidade de segurança: Chave Asaas Sandbox ($aact_hmlg_...) configurada com URL de Produção.");
  }
  if (isProdKey && isSandboxUrl) {
    throw new Error("Incompatibilidade de segurança: Chave Asaas Produção ($aact_prod_...) configurada com URL de Sandbox.");
  }
}

export function getAsaasBaseUrl(): string {
  const directUrl = getEnv("ASAAS_API_URL");
  if (directUrl && directUrl.trim().length > 0) {
    return directUrl.trim().replace(/\/+$/, "");
  }
  const env = getEnv("ASAAS_ENVIRONMENT")?.trim().toLowerCase();
  if (env === "production") return "https://api.asaas.com/v3";
  if (env === "sandbox") return "https://api-sandbox.asaas.com/v3";
  throw new Error(
    "Ambiente Asaas não configurado: defina ASAAS_ENVIRONMENT ('production' ou 'sandbox') ou ASAAS_API_URL.",
  );
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

  assertAsaasEnvironmentMatch(apiKey, baseUrl);

  const headers = new Headers(options.headers || {});
  headers.set("access_token", apiKey);
  headers.set("Content-Type", "application/json");
  headers.set("User-Agent", "AxirApp/3.29 (https://axir.com.br)");

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  const rawText = await response.text();
  let data: Record<string, unknown> = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      data = { message: rawText.slice(0, 300) };
    }
  }

  if (!response.ok) {
    const errors = data?.errors as Array<{ description?: string }> | undefined;
    const errorMsg =
      errors?.[0]?.description ||
      (typeof data?.message === "string" ? data.message : undefined) ||
      `Erro Asaas (${response.status}): ${response.statusText}`;
    const err = new Error(errorMsg) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return data as T;
}

/**
 * Localiza ou cria um cliente no Asaas a partir do e-mail ou CPF.
 * Garante sempre notificationDisabled: true (D-05).
 */
export async function findOrCreateAsaasCustomer(
  input: AsaasCustomerInput & { existingCustomerId?: string | null },
): Promise<{ id: string }> {
  // 0. Se já possuir customerId associado, verifica se ainda existe no Asaas
  if (input.existingCustomerId && input.existingCustomerId.trim().length > 0) {
    try {
      const existing = await asaasFetch<{ id: string; deleted?: boolean }>(
        `/customers/${encodeURIComponent(input.existingCustomerId.trim())}`,
      );
      if (existing && existing.id && !existing.deleted) {
        return { id: existing.id };
      }
    } catch {
      // Se não encontrou pelo ID antigo, prossegue com busca por CPF/e-mail
    }
  }

  const cleanCpf = (input.cpfCnpj || "").replace(/\D/g, "");
  if (!isValidCPF(cleanCpf)) {
    throw new Error("CPF inválido ou não informado para cadastro do titular da assinatura.");
  }

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

  // 3. Cria novo cliente (sempre com notificationDisabled: true por decisão D-05)
  const created = await asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: cleanCpf,
      mobilePhone: input.phone?.replace(/\D/g, "") || undefined,
      notificationDisabled: true,
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
  externalReference?: string;
}): Promise<{ id: string; status: string }> {
  const planMeta = ASAAS_PLAN_CATALOG[params.plan];
  const value = planMeta.value;
  const cycle = planMeta.cycle;
  const description =
    params.plan === "annual"
      ? "Axir — Plano Pro Anual"
      : "Axir — Plano Pro Mensal";

  const todayIso = formatBrtIsoDate(new Date());
  const normalizedNextDue = params.nextDueDate ? formatBrtIsoDate(params.nextDueDate) : null;
  const nextDueDate =
    normalizedNextDue && normalizedNextDue >= todayIso
      ? normalizedNextDue
      : todayIso;

  const cleanPostalCode = (params.holderInfo.postalCode || "").replace(/\D/g, "");
  const cleanAddressNumber = (params.holderInfo.addressNumber || "").trim();
  const cleanPhone = (params.holderInfo.phone || "").replace(/\D/g, "");

  const payload: Record<string, unknown> = {
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
      postalCode: cleanPostalCode || undefined,
      addressNumber: cleanAddressNumber || undefined,
      phone: cleanPhone || undefined,
    },
    remoteIp: params.remoteIp || "127.0.0.1",
  };

  if (params.externalReference) {
    payload.externalReference = params.externalReference;
  }

  return asaasFetch<{ id: string; status: string }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Cria uma cobrança avulsa PIX para o Plano Anual ou Antecipação Acumulativa.
 */
export async function createAsaasPixCharge(params: {
  customerId: string;
  value: number;
  description: string;
  externalReference?: string;
}): Promise<{ id: string; status: string; value: number }> {
  const dueDate = formatBrtIsoDate(new Date());

  const payload: Record<string, unknown> = {
    customer: params.customerId,
    billingType: "PIX",
    value: params.value,
    dueDate,
    description: params.description,
  };

  if (params.externalReference) {
    payload.externalReference = params.externalReference;
  }

  return asaasFetch<{ id: string; status: string; value: number }>("/payments", {
    method: "POST",
    body: JSON.stringify(payload),
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
  dueDate?: string;
  externalReference?: string | null;
}> {
  return asaasFetch<{
    id: string;
    status: string;
    value: number;
    dateCreated?: string;
    dueDate?: string;
    externalReference?: string | null;
  }>(`/payments/${paymentId}`);
}

/**
 * Consulta os dados de uma assinatura recorrente pelo ID no Asaas.
 */
export async function getAsaasSubscription(subscriptionId: string): Promise<{
  id: string;
  status: string;
  nextDueDate?: string;
  value?: number;
}> {
  return asaasFetch<{
    id: string;
    status: string;
    nextDueDate?: string;
    value?: number;
  }>(`/subscriptions/${subscriptionId}`);
}

/**
 * Consulta as cobranças filhas emitidas para uma assinatura.
 */
export async function getAsaasSubscriptionPayments(
  subscriptionId: string,
  status?: string,
): Promise<Array<{ id: string; status: string; dueDate: string; value: number }>> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const result = await asaasFetch<{ data?: Array<{ id: string; status: string; dueDate: string; value: number }> }>(
    `/subscriptions/${subscriptionId}/payments${query}`,
  );
  return result.data || [];
}

/**
 * Remove/cancela uma cobrança avulsa ou parcela pendente no Asaas.
 */
export async function deleteAsaasPayment(paymentId: string): Promise<{ id: string; deleted: boolean }> {
  return asaasFetch<{ id: string; deleted: boolean }>(`/payments/${paymentId}`, {
    method: "DELETE",
  });
}

export async function updateAsaasSubscriptionNextDueDate(
  subscriptionId: string,
  nextDueDate: string,
): Promise<{ id: string; status: string }> {
  const targetDueDate = formatBrtIsoDate(nextDueDate);
  return asaasFetch<{ id: string; status: string }>(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({
      nextDueDate: targetDueDate,
      updatePendingPayments: false,
    }),
  });
}

/**
 * Atrasa o vencimento da assinatura recorrente e remove as cobranças PENDING
 * que ficariam dentro do período já antecipado via Pix (evitando cobrança dupla).
 */
export async function postponeAsaasSubscriptionAfterPrepayment(
  subscriptionId: string,
  nextDueDate: string,
): Promise<{ success: boolean; deletedPendingPaymentsCount: number; failedPendingPaymentsCount: number }> {
  const targetDueDate = formatBrtIsoDate(nextDueDate);

  // 1. Atualiza nextDueDate na assinatura do Asaas (updatePendingPayments: false)
  await updateAsaasSubscriptionNextDueDate(subscriptionId, targetDueDate);

  // 2. Localiza e exclui cobranças PENDING com vencimento anterior ao novo vencimento
  let deletedCount = 0;
  let failedDeletes = 0;
  let listFailed = false;
  try {
    const pendingPayments = await getAsaasSubscriptionPayments(subscriptionId, "PENDING");
    for (const payment of pendingPayments) {
      if (payment.dueDate < targetDueDate) {
        try {
          await deleteAsaasPayment(payment.id);
          deletedCount++;
        } catch (delErr) {
          if (isAsaasAlreadyCanceledError(delErr)) {
            deletedCount++;
          } else {
            failedDeletes++;
            console.warn(
              `[asaas] Falha ao remover cobrança PENDING ${payment.id} da assinatura ${subscriptionId}:`,
              sanitizePaymentLog(delErr),
            );
          }
        }
      }
    }
  } catch (listErr) {
    listFailed = true;
    console.warn(
      `[asaas] Falha ao listar cobranças PENDING da assinatura ${subscriptionId}:`,
      sanitizePaymentLog(listErr),
    );
  }

  return {
    success: !listFailed && failedDeletes === 0,
    deletedPendingPaymentsCount: deletedCount,
    failedPendingPaymentsCount: failedDeletes,
  };
}

/**
 * Cancela com tolerância a erro uma assinatura prévia no Asaas.
 */
export async function ensurePreviousSubscriptionCanceled(subscriptionId?: string | null): Promise<boolean> {
  if (!subscriptionId || subscriptionId.trim().length === 0) return false;
  try {
    await cancelAsaasSubscription(subscriptionId.trim());
    return true;
  } catch {
    return false;
  }
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
  const cleanPostalCode = (params.holderInfo.postalCode || "").replace(/\D/g, "");
  const cleanAddressNumber = (params.holderInfo.addressNumber || "").trim();
  const cleanPhone = (params.holderInfo.phone || "").replace(/\D/g, "");

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
      postalCode: cleanPostalCode || undefined,
      addressNumber: cleanAddressNumber || undefined,
      phone: cleanPhone || undefined,
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
      updatePendingPayments: false,
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
  if (lower.includes("bloqueado") || lower.includes("blocked") || lower.includes("cartão inválido") || lower.includes("cartao invalido") || lower.includes("número do cartão") || lower.includes("numero do cartao")) {
    return "Cartão de crédito bloqueado ou com número inválido. Verifique os dados ou utilize outro cartão.";
  }
  if (lower.includes("cpf") || lower.includes("cnpj")) {
    return "CPF/CNPJ do titular inválido ou inconsistente junto à Receita Federal.";
  }
  if (lower.includes("cep") || lower.includes("postalcode") || lower.includes("endereço") || lower.includes("endereco")) {
    return "CEP ou número do endereço do titular inválido. Verifique os dados de cobrança.";
  }
  if (lower.includes("telefone") || lower.includes("celular") || lower.includes("phone")) {
    return "Telefone do titular inválido. Informe um número com DDD válido.";
  }
  if (lower.includes("risco") || lower.includes("antifraude") || lower.includes("suspeita") || lower.includes("fraud")) {
    return "Transação bloqueada pela análise de segurança do emissor. Tente outro cartão ou utilize PIX.";
  }
  if (lower.includes("muitas tentativas") || lower.includes("too many") || lower.includes("aguarde")) {
    return "Muitas tentativas em sequência no gateway. Aguarde alguns minutos e tente novamente.";
  }

  return null;
}
