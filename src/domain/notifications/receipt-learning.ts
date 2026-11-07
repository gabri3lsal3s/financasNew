/**
 * Motor puro de memória adaptativa e aprendizado contínuo de comprovantes e estabelecimentos.
 *
 * Registra ajustes manuais do usuário ao confirmar lançamentos de comprovantes
 * (estabelecimento, categoria, meio de pagamento, cartão preferencial)
 * e reutiliza essas preferências automaticamente em transações futuras.
 *
 * Persistência:
 * - Cache local síncrono e resiliente (localStorage) indexado por CNPJ e por nome normalizado.
 *
 * Função 100% pura: sem efeitos colaterais impuros, sem dependência direta de UI ou React.
 */

import type { PaymentMethod } from "@/types/schema";
import { cleanTaxId } from "./merchant-memory";

export const RECEIPT_LEARNING_STORAGE_KEY = "financas_receipt_learning_v1";

export interface LearnedReceiptPreference {
  merchantName: string;
  categorySlug?: string;
  paymentMethod?: PaymentMethod;
  cardLastDigits?: string;
  cardBrand?: string;
  cnpj?: string;
  usageCount: number;
  lastUpdated: string; // ISO
}

export interface UserReceiptCorrection {
  cnpj?: string;
  rawMerchant?: string;
  correctedMerchant: string;
  categorySlug?: string;
  paymentMethod?: PaymentMethod;
  cardLastDigits?: string;
  cardBrand?: string;
}

/**
 * Normaliza uma string de estabelecimento para chave de aprendizado (minúsculas, sem pontuação/acentos).
 */
export function normalizeMerchantKey(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Recupera o dicionário completo da memória de aprendizado.
 */
export function loadReceiptLearningDictionary(): Record<string, LearnedReceiptPreference> {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(RECEIPT_LEARNING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, LearnedReceiptPreference>;
    }
  } catch {
    // Fallback silencioso em caso de JSON corrompido
  }

  return {};
}

/**
 * Grava o dicionário completo da memória de aprendizado no cache local.
 */
export function saveReceiptLearningDictionary(
  dict: Record<string, LearnedReceiptPreference>,
): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(RECEIPT_LEARNING_STORAGE_KEY, JSON.stringify(dict));
  } catch {
    // Falha silenciosa de quota de armazenamento
  }
}

/**
 * Registra o feedback ou correção do usuário para enriquecer o aprendizado contínuo.
 */
export function learnFromReceiptCorrection(correction: UserReceiptCorrection): void {
  const merchantName = (correction.correctedMerchant || correction.rawMerchant || "").trim();
  if (!merchantName) return;

  const dict = loadReceiptLearningDictionary();
  const cleanDoc = cleanTaxId(correction.cnpj);
  const normalizedName = normalizeMerchantKey(merchantName);
  const rawNormalized = normalizeMerchantKey(correction.rawMerchant || "");

  const existing =
    (cleanDoc ? dict[`cnpj:${cleanDoc}`] : undefined) ||
    (normalizedName ? dict[`name:${normalizedName}`] : undefined) ||
    (rawNormalized ? dict[`name:${rawNormalized}`] : undefined);

  const usageCount = (existing?.usageCount ?? 0) + 1;
  const preference: LearnedReceiptPreference = {
    merchantName,
    categorySlug: correction.categorySlug ?? existing?.categorySlug,
    paymentMethod: correction.paymentMethod ?? existing?.paymentMethod,
    cardLastDigits: correction.cardLastDigits ?? existing?.cardLastDigits,
    cardBrand: correction.cardBrand ?? existing?.cardBrand,
    cnpj: cleanDoc ?? existing?.cnpj,
    usageCount,
    lastUpdated: new Date().toISOString(),
  };

  // 1. Indexação primária por CNPJ
  if (cleanDoc) {
    dict[`cnpj:${cleanDoc}`] = preference;
  }

  // 2. Indexação por nome normalizado
  if (normalizedName) {
    dict[`name:${normalizedName}`] = preference;
  }

  // 3. Se o nome bruto for diferente do corrigido, associa também o nome bruto ao perfil corrigido
  if (rawNormalized && rawNormalized !== normalizedName) {
    dict[`name:${rawNormalized}`] = preference;
  }

  saveReceiptLearningDictionary(dict);
}

/**
 * Consulta a memória adaptativa em busca de preferências aprendidas anteriormente.
 */
export function getLearnedReceiptPreferences(input: {
  cnpj?: string;
  merchantName?: string;
  rawText?: string;
}): LearnedReceiptPreference | null {
  const dict = loadReceiptLearningDictionary();

  // 1. Prioridade máxima: correspondência por CNPJ (14 dígitos)
  const cleanDoc = cleanTaxId(input.cnpj);
  if (cleanDoc && dict[`cnpj:${cleanDoc}`]) {
    return dict[`cnpj:${cleanDoc}`]!;
  }

  // 2. Correspondência por nome do estabelecimento
  if (input.merchantName) {
    const key = normalizeMerchantKey(input.merchantName);
    if (key && dict[`name:${key}`]) {
      return dict[`name:${key}`]!;
    }
  }

  // 3. Varredura no texto bruto por chaves de nomes aprendidos
  if (input.rawText) {
    const normalizedRaw = normalizeMerchantKey(input.rawText);
    for (const [key, pref] of Object.entries(dict)) {
      if (key.startsWith("name:")) {
        const namePart = key.slice(5);
        if (namePart.length >= 4 && normalizedRaw.includes(namePart)) {
          return pref;
        }
      }
    }
  }

  return null;
}

/**
 * Limpa todo o histórico de aprendizado de comprovantes (útil para testes ou reset).
 */
export function clearReceiptLearningMemory(): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(RECEIPT_LEARNING_STORAGE_KEY);
    } catch {
      // Ignora erro
    }
  }
}
