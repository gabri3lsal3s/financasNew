/**
 * Memória adaptativa e pura de categorização e identidade de estabelecimentos (Merchant Memory & Learning).
 * Permite ao sistema aprender com o histórico de categorização do usuário,
 * correlacionando CNPJs, CPFs, razões sociais e variações de adquirentes
 * com o nome fantasia amigável e a categoria habitual.
 *
 * Função 100% pura: sem dependências de UI, React ou banco de dados.
 */

import type { PaymentMethod } from "@/types/schema";
import { normalizeMerchantText } from "./bank-parser";
import type { CanonicalCategorySlug } from "./category-inference";
import { cleanAcquirerPrefixes } from "./merchant-catalog";

export interface MerchantCategoryMapping {
  [normalizedMerchant: string]: string; // slug ou categoryId
}

/**
 * Registro semântico aprendido de estabelecimento (§2.1).
 */
export interface MerchantLearningRecord {
  /** Nome amigável / fantasia exibido ao usuário (ex.: "McDonald's", "Padaria do Zé"). */
  friendlyName: string;
  /** Slug canônico ou ID da categoria (ex.: "alimentacao", "mercado"). */
  categorySlug: string;
  /** Dígitos limpos do CNPJ (14 dígitos) ou CPF (11 dígitos) para correspondência unívoca. */
  cnpjOrCpf?: string;
  /** Lista de variações brutas/termos de identificação (ex.: ["arcos dourados", "pag*mcdonalds", "mc donalds"]). */
  rawAliases: string[];
  /** Método de pagamento preferencial memorizado para o estabelecimento (ex.: "credit_card", "pix"). */
  preferredPaymentMethod?: PaymentMethod;
  /** ID do cartão de crédito preferencial memorizado para o estabelecimento. */
  preferredCardId?: string;
  /** Contador de vezes que esta regra foi aplicada ou confirmada pelo usuário. */
  usageCount: number;
  /** Timestamp ISO da última utilização/atualização (ex.: "2026-10-21T17:47:00.000Z"). */
  lastUsedAt: string;
}

export interface MerchantLearningMemory {
  [key: string]: MerchantLearningRecord;
}

export interface RecordMerchantLearningParams {
  friendlyName: string;
  categorySlug: string;
  cnpjOrCpf?: string;
  alias?: string;
  rawAliases?: string[];
  preferredPaymentMethod?: PaymentMethod;
  preferredCardId?: string;
}

export interface FindLearnedMerchantQuery {
  taxId?: string;
  merchant?: string;
  rawText?: string;
}

/**
 * Limpa e valida CPF (11 dígitos) ou CNPJ (14 dígitos), retornando apenas os dígitos.
 * Retorna `undefined` se a quantidade de dígitos for diferente de 11 ou 14.
 */
export function cleanTaxId(taxId?: string | null): string | undefined {
  if (!taxId) return undefined;
  const digits = taxId.replace(/\D/g, "");
  if (digits.length === 11 || digits.length === 14) {
    return digits;
  }
  return undefined;
}

/**
 * Formata um CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) limpo para exibição.
 */
export function formatTaxId(taxId?: string | null): string | undefined {
  const digits = cleanTaxId(taxId);
  if (!digits) return undefined;
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/**
 * Extrai e normaliza um CNPJ ou CPF presente em textos bancários, extratos ou comprovantes.
 * Suporta formatos pontuados e desformatados precedidos por marcadores semânticos.
 * Retorna a sequência limpa de dígitos ou `undefined`.
 */
export function extractTaxIdFromText(text?: string | null): string | undefined {
  if (!text) return undefined;

  // 1. CNPJ formatado no padrão clássico: 00.000.000/0000-00
  const formattedCnpjMatch = text.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
  if (formattedCnpjMatch?.[1]) {
    const cleaned = cleanTaxId(formattedCnpjMatch[1]);
    if (cleaned) return cleaned;
  }

  // 2. CPF formatado no padrão clássico: 000.000.000-00
  const formattedCpfMatch = text.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);
  if (formattedCpfMatch?.[1]) {
    const cleaned = cleanTaxId(formattedCpfMatch[1]);
    if (cleaned) return cleaned;
  }

  // 3. CNPJ desformatado precedido por marcador semântico
  // Ex.: "CNPJ: 12345678000190", "CNPJ/CPF 12345678000190", "Chave Pix CNPJ: 12345678000190"
  const unformattedCnpjMatch = text.match(
    /(?:cnpj|cadastro\s+nacional(?:\s+da\s+pessoa\s+jur[ií]dica)?|chave(?:\s+pix)?(?:\s*:\s*cnpj)?)[\s:.-]*(\d{14})\b/i,
  );
  if (unformattedCnpjMatch?.[1]) {
    const cleaned = cleanTaxId(unformattedCnpjMatch[1]);
    if (cleaned) return cleaned;
  }

  // 4. CPF desformatado precedido por marcador semântico
  // Ex.: "CPF: 12345678901", "Chave Pix CPF 12345678901", "Documento: 12345678901"
  const unformattedCpfMatch = text.match(
    /(?:cpf|cadastro\s+de\s+pessoas?\s+f[ií]sicas?|chave(?:\s+pix)?(?:\s*:\s*cpf)?)[\s:.-]*(\d{11})\b/i,
  );
  if (unformattedCpfMatch?.[1]) {
    const cleaned = cleanTaxId(unformattedCpfMatch[1]);
    if (cleaned) return cleaned;
  }

  // 5. Marcador genérico de documento/taxId seguido por 14 ou 11 dígitos
  const genericDocMatch = text.match(
    /(?:doc(?:umento)?|identificador|favorecido\s+doc)[\s:.-]*(\d{14}|\d{11})\b/i,
  );
  if (genericDocMatch?.[1]) {
    const cleaned = cleanTaxId(genericDocMatch[1]);
    if (cleaned) return cleaned;
  }

  return undefined;
}

/**
 * Normaliza o nome do estabelecimento para ser usado como chave determinística na memória.
 */
export function toMerchantMemoryKey(merchant: string): string {
  return normalizeMerchantText(merchant);
}

/**
 * Adiciona ou atualiza um registro semântico na memória de aprendizado de forma imutável.
 * Se o registro já existir por CNPJ/CPF ou nome, consolida os aliases e incrementa o uso.
 */
export function recordMerchantLearning(
  params: RecordMerchantLearningParams,
  existingMemory: MerchantLearningMemory = {},
  now = new Date().toISOString(),
): MerchantLearningMemory {
  const cleanTax = cleanTaxId(params.cnpjOrCpf);
  const normalizedFriendly = normalizeMerchantText(params.friendlyName);
  if (!normalizedFriendly && !cleanTax) return existingMemory;

  // Chave canônica primária: prioriza o taxId limpo, ou o friendlyName normalizado com underscores
  const key = cleanTax
    ? `tax_${cleanTax}`
    : `name_${normalizedFriendly.replace(/\s+/g, "_")}`;
  const existing = existingMemory[key];

  // Agrega e normaliza aliases sem duplicatas
  const aliasesSet = new Set<string>();
  if (existing?.rawAliases) {
    for (const a of existing.rawAliases) aliasesSet.add(a.toLowerCase().trim());
  }
  if (params.rawAliases) {
    for (const a of params.rawAliases) aliasesSet.add(a.toLowerCase().trim());
  }
  if (params.alias) {
    aliasesSet.add(params.alias.toLowerCase().trim());
  }
  if (params.friendlyName) {
    aliasesSet.add(params.friendlyName.toLowerCase().trim());
  }
  const cleanAliases = Array.from(aliasesSet).filter(Boolean);

  const updatedRecord: MerchantLearningRecord = {
    friendlyName: params.friendlyName.trim() || existing?.friendlyName || normalizedFriendly,
    categorySlug: params.categorySlug,
    cnpjOrCpf: cleanTax || existing?.cnpjOrCpf,
    rawAliases: cleanAliases.length > 0 ? cleanAliases : [params.friendlyName.toLowerCase().trim()],
    preferredPaymentMethod: params.preferredPaymentMethod ?? existing?.preferredPaymentMethod,
    preferredCardId: params.preferredCardId ?? existing?.preferredCardId,
    usageCount: (existing?.usageCount ?? 0) + 1,
    lastUsedAt: now,
  };

  return {
    ...existingMemory,
    [key]: updatedRecord,
  };
}

/**
 * Busca um estabelecimento na memória aprendida por CNPJ/CPF (1ª camada) ou aliases/nome (2ª camada).
 */
export function findLearnedMerchant(
  query: FindLearnedMerchantQuery,
  memory: MerchantLearningMemory = {},
): MerchantLearningRecord | undefined {
  const records = Object.values(memory);
  if (records.length === 0) return undefined;

  // 1. Chave de Ouro: Busca por CNPJ / CPF (precisão 100%)
  const cleanTax = cleanTaxId(query.taxId) || extractTaxIdFromText(query.rawText);
  if (cleanTax) {
    const matchByTax = records.find((r) => r.cnpjOrCpf && r.cnpjOrCpf === cleanTax);
    if (matchByTax) return matchByTax;
  }

  // 2. Busca por nome amigável idêntico ou em aliases cadastrados
  const targetMerchant = normalizeMerchantText(query.merchant);
  const cleanTarget = normalizeMerchantText(cleanAcquirerPrefixes(query.merchant || ""));
  if (targetMerchant) {
    const matchByMerchant = records.find((r) => {
      const normFriendly = normalizeMerchantText(r.friendlyName);
      if (normFriendly === targetMerchant) return true;
      if (cleanTarget && normFriendly === cleanTarget) return true;

      return (r.rawAliases || []).some((alias) => {
        const normAlias = normalizeMerchantText(alias);
        if (normAlias === targetMerchant) return true;
        const cleanAlias = normalizeMerchantText(cleanAcquirerPrefixes(alias));
        return Boolean(cleanAlias && cleanTarget && cleanAlias === cleanTarget);
      });
    });
    if (matchByMerchant) return matchByMerchant;
  }

  // 3. Busca por contenção de alias dentro do texto bruto da notificação/comprovante
  if (query.rawText) {
    const normRaw = query.rawText.toLowerCase();
    const cleanRaw = normalizeMerchantText(query.rawText);
    const matchByRaw = records.find((r) => {
      return (r.rawAliases || []).some((alias) => {
        const normAlias = alias.toLowerCase().trim();
        const cleanAlias = normalizeMerchantText(cleanAcquirerPrefixes(alias));
        if (normAlias.length >= 3 && normRaw.includes(normAlias)) return true;
        if (cleanAlias.length >= 3 && cleanRaw.includes(cleanAlias)) return true;
        return false;
      });
    });
    if (matchByRaw) return matchByRaw;
  }

  return undefined;
}

/**
 * Remove um registro semântico da memória aprendida de forma imutável.
 */
export function forgetMerchantLearning(
  identifier: string,
  existingMemory: MerchantLearningMemory = {},
): MerchantLearningMemory {
  const cleanTax = cleanTaxId(identifier);
  const normalized = normalizeMerchantText(identifier).replace(/\s+/g, "_");
  const primaryKey = cleanTax ? `tax_${cleanTax}` : `name_${normalized}`;

  if (primaryKey in existingMemory) {
    const next = { ...existingMemory };
    delete next[primaryKey];
    return next;
  }

  // Busca secundária por CNPJ ou nome em todo o dicionário
  const foundKey = Object.keys(existingMemory).find((k) => {
    const rec = existingMemory[k];
    if (!rec) return false;
    return (
      rec.cnpjOrCpf === cleanTax ||
      normalizeMerchantText(rec.friendlyName) === normalizeMerchantText(identifier)
    );
  });

  if (foundKey) {
    const next = { ...existingMemory };
    delete next[foundKey];
    return next;
  }

  return existingMemory;
}

/**
 * Tenta resolver a categoria de um estabelecimento a partir do dicionário simples de memória do usuário.
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
 * Adiciona ou atualiza uma associação simples estabelecimento -> categoria de forma imutável.
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
 * Remove uma associação simples da memória de forma imutável.
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

// =========================================================================
// MEMÓRIA E MAPEAMENTO DE DÍGITOS DE CARTÕES (Card Digits Mapping)
// =========================================================================

/**
 * Dicionário associativo entre 4 últimos dígitos de cartão e o ID do cartão no app.
 * Exemplo: { "4821": "card-itau-uuid", "3341": "card-stone-uuid" }
 */
export type CardDigitsMapping = Record<string, string>;

/**
 * Normaliza os dígitos de um cartão para chave limpa de 2 a 4 dígitos.
 * Extrai os últimos dígitos caso uma string com máscara (ex.: "**** 4821", "final 4821") seja informada.
 */
export function normalizeCardDigits(digits: string | undefined | null): string | undefined {
  if (!digits) return undefined;
  const cleaned = digits.replace(/\D/g, "");
  if (cleaned.length >= 4) {
    return cleaned.slice(-4);
  }
  if (cleaned.length >= 2) {
    return cleaned;
  }
  return undefined;
}

/**
 * Associa de forma pura e imutável os dígitos finais ao ID do cartão.
 */
export function recordCardDigitsLearning(
  digits: string,
  cardId: string,
  current: CardDigitsMapping = {},
): CardDigitsMapping {
  const normDigits = normalizeCardDigits(digits);
  if (!normDigits || !cardId) return current;

  return {
    ...current,
    [normDigits]: cardId,
  };
}

/**
 * Consulta o ID do cartão associado aos dígitos finais informados.
 */
export function lookupCardByDigits(
  digits: string | undefined | null,
  mapping: CardDigitsMapping = {},
): string | undefined {
  const normDigits = normalizeCardDigits(digits);
  if (!normDigits || !mapping) return undefined;

  return mapping[normDigits];
}

/**
 * Remove associações de dígitos da memória de forma imutável, seja pelo ID do cartão ou pelos dígitos.
 */
export function forgetCardDigitsLearning(
  cardIdOrDigits: string,
  current: CardDigitsMapping = {},
): CardDigitsMapping {
  if (!cardIdOrDigits || !current) return current;

  const next: CardDigitsMapping = {};
  const normDigits = normalizeCardDigits(cardIdOrDigits);

  for (const [dig, id] of Object.entries(current)) {
    if (id === cardIdOrDigits) continue;
    if (normDigits && dig === normDigits) continue;
    next[dig] = id;
  }

  return next;
}
