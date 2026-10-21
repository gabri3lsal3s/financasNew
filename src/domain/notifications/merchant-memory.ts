/**
 * Memória adaptativa e pura de categorização por estabelecimento (Merchant Memory).
 * Permite ao sistema aprender com o histórico de categorização do usuário,
 * priorizando o hábito pessoal sobre palavras-chave genéricas.
 *
 * Função 100% pura: sem dependências de UI, React ou banco de dados.
 */

import { normalizeMerchantText } from "./bank-parser";
import type { CanonicalCategorySlug } from "./category-inference";

export interface MerchantCategoryMapping {
  [normalizedMerchant: string]: string; // slug ou categoryId
}

/**
 * Normaliza o nome do estabelecimento para ser usado como chave determinística na memória.
 */
export function toMerchantMemoryKey(merchant: string): string {
  return normalizeMerchantText(merchant);
}

/**
 * Tenta resolver a categoria de um estabelecimento a partir do dicionário de memória do usuário.
 * Retorna o identificador memorizado ou `undefined` se não houver registro prévio.
 */
export function lookupMerchantCategory(
  merchant: string | undefined,
  memory: MerchantCategoryMapping | undefined,
): string | undefined {
  if (!merchant || !memory) return undefined;
  const key = toMerchantMemoryKey(merchant);
  if (!key) return undefined;

  return memory[key];
}

/**
 * Adiciona ou atualiza uma associação estabelecimento -> categoria de forma imutável.
 */
export function recordMerchantCategoryMemory(
  merchant: string,
  categoryIdentifier: string,
  existingMemory: MerchantCategoryMapping = {},
): MerchantCategoryMapping {
  const key = toMerchantMemoryKey(merchant);
  if (!key || !categoryIdentifier) return existingMemory;

  return {
    ...existingMemory,
    [key]: categoryIdentifier,
  };
}

/**
 * Remove uma associação da memória de forma imutável.
 */
export function forgetMerchantCategoryMemory(
  merchant: string,
  existingMemory: MerchantCategoryMapping = {},
): MerchantCategoryMapping {
  const key = toMerchantMemoryKey(merchant);
  if (!key || !(key in existingMemory)) return existingMemory;

  const next = { ...existingMemory };
  delete next[key];
  return next;
}

/**
 * Resolve a categoria priorizando a memória do usuário, com fallback para inferência por palavras-chave.
 */
export function resolveCategoryWithPriority(
  merchant: string | undefined,
  description: string,
  memory: MerchantCategoryMapping | undefined,
  keywordFallback: (desc: string) => CanonicalCategorySlug | undefined,
): string | undefined {
  // 1. Prioridade máxima: memória personalizada do usuário
  const memorized = lookupMerchantCategory(merchant, memory);
  if (memorized) {
    return memorized;
  }

  // 2. Fallback: inferência geral de palavras-chave
  return keywordFallback(description);
}
