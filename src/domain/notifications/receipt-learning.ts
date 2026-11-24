/**
 * Motor puro de memória adaptativa e aprendizado contínuo de comprovantes e estabelecimentos.
 *
 * Registra ajustes manuais do usuário ao confirmar lançamentos de comprovantes
 * (estabelecimento, categoria, meio de pagamento, cartão preferencial)
 * e unifica leitura/gravação com `merchantLearning` via ponte registrada pela camada de serviço
 * (mantendo fallback local silencioso para o dicionário legado `financas_receipt_learning_v1`).
 *
 * Função 100% pura: sem dependências de UI, React ou camada de serviços.
 */

import type { PaymentMethod } from "@/types/schema";
import { normalizeMerchantText } from "./bank-parser";
import {
  cleanTaxId,
  findLearnedMerchant,
  recordMerchantLearning,
  type MerchantLearningMemory,
  type MerchantLearningRecord,
  type RecordMerchantLearningParams,
} from "./merchant-memory";

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
 * Ponte opcional registrada por `services/merchant-learning.ts` para unificar o aprendizado
 * de comprovantes na fonte canônica `merchantLearning` sem violar o isolamento de camadas.
 */
export interface ReceiptLearningBridge {
  getMemory: () => MerchantLearningMemory;
  record: (params: RecordMerchantLearningParams) => MerchantLearningMemory;
  clear?: () => void;
}

let activeBridge: ReceiptLearningBridge | null = null;

/**
 * Registra ou remove a ponte de serviço para `merchantLearning`.
 */
export function registerReceiptLearningBridge(bridge: ReceiptLearningBridge | null): void {
  activeBridge = bridge;
}

/**
 * Converte uma correção manual de comprovante para os parâmetros canônicos de `merchantLearning`.
 */
export function receiptCorrectionToMerchantParams(
  correction: UserReceiptCorrection,
): RecordMerchantLearningParams {
  const merchantName = (correction.correctedMerchant || correction.rawMerchant || "").trim();
  const rawTrimmed = correction.rawMerchant?.trim();
  const rawAliases =
    rawTrimmed && rawTrimmed.toLowerCase() !== merchantName.toLowerCase()
      ? [rawTrimmed.toLowerCase()]
      : undefined;

  return {
    friendlyName: merchantName,
    categorySlug: correction.categorySlug ?? "",
    cnpjOrCpf: cleanTaxId(correction.cnpj),
    alias: rawTrimmed || merchantName,
    rawAliases,
    preferredPaymentMethod: correction.paymentMethod,
    preferredCardLastDigits: correction.cardLastDigits,
    preferredCardBrand: correction.cardBrand,
  };
}

/**
 * Converte um registro de `merchantLearning` de volta para a projeção `LearnedReceiptPreference`.
 */
export function merchantRecordToReceiptPreference(
  record: MerchantLearningRecord,
): LearnedReceiptPreference {
  return {
    merchantName: record.friendlyName,
    categorySlug: record.categorySlug || undefined,
    paymentMethod: record.preferredPaymentMethod,
    cardLastDigits: record.preferredCardLastDigits,
    cardBrand: record.preferredCardBrand,
    cnpj: record.cnpjOrCpf,
    usageCount: record.usageCount,
    lastUpdated: record.lastUsedAt,
  };
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
 * Recupera o dicionário legado da memória de comprovantes.
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
 * Grava o dicionário legado de comprovantes (fallback quando sem ponte de serviço).
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
 * Migra puramente um dicionário legado (`financas_receipt_learning_v1`) para `MerchantLearningMemory`,
 * preservando aliases, CNPJ e contagem real de uso sem duplicação.
 */
export function migrateLegacyReceiptDictToMerchantMemory(
  legacyDict: Record<string, LearnedReceiptPreference>,
  existingMemory: MerchantLearningMemory = {},
): { memory: MerchantLearningMemory; migratedCount: number } {
  const entries = Object.entries(legacyDict);
  if (entries.length === 0) {
    return { memory: existingMemory, migratedCount: 0 };
  }

  interface GroupedLegacy {
    canonicalKey: string;
    pref: LearnedReceiptPreference;
    aliases: Set<string>;
  }

  const grouped = new Map<string, GroupedLegacy>();

  for (const [dictKey, pref] of entries) {
    if (!pref || typeof pref !== "object") continue;
    const merchantName = (pref.merchantName ?? "").trim();
    const cleanDoc =
      cleanTaxId(pref.cnpj) ?? (dictKey.startsWith("cnpj:") ? cleanTaxId(dictKey.slice(5)) : undefined);
    const normFriendly = normalizeMerchantText(merchantName);
    if (!normFriendly && !cleanDoc) continue;

    const canonicalKey = cleanDoc
      ? `tax_${cleanDoc}`
      : `name_${normFriendly.replace(/\s+/g, "_")}`;

    const existingGroup = grouped.get(canonicalKey);
    const aliasCandidate = dictKey.startsWith("name:") ? dictKey.slice(5).trim() : "";

    if (!existingGroup) {
      const aliases = new Set<string>();
      if (merchantName) aliases.add(merchantName.toLowerCase());
      if (aliasCandidate) aliases.add(aliasCandidate.toLowerCase());
      grouped.set(canonicalKey, { canonicalKey, pref, aliases });
    } else {
      if (aliasCandidate) existingGroup.aliases.add(aliasCandidate.toLowerCase());
      if (merchantName) existingGroup.aliases.add(merchantName.toLowerCase());
      if ((pref.usageCount ?? 0) > (existingGroup.pref.usageCount ?? 0)) {
        existingGroup.pref = pref;
      }
    }
  }

  let nextMemory: MerchantLearningMemory = { ...existingMemory };
  let migratedCount = 0;

  for (const group of grouped.values()) {
    const { pref, aliases } = group;
    const prevRecord = nextMemory[group.canonicalKey];
    const nowIso = pref.lastUpdated || new Date().toISOString();

    nextMemory = recordMerchantLearning(
      {
        friendlyName: pref.merchantName,
        categorySlug: pref.categorySlug ?? "",
        cnpjOrCpf: cleanTaxId(pref.cnpj),
        rawAliases: Array.from(aliases),
        preferredPaymentMethod: pref.paymentMethod,
        preferredCardLastDigits: pref.cardLastDigits,
        preferredCardBrand: pref.cardBrand,
      },
      nextMemory,
      nowIso,
    );

    // Preserva contagem histórica real de uso caso seja maior que o incremento unitário
    const saved = nextMemory[group.canonicalKey];
    if (saved) {
      const preservedUsage = Math.max(prevRecord?.usageCount ?? 0, pref.usageCount ?? 1, saved.usageCount);
      nextMemory = {
        ...nextMemory,
        [group.canonicalKey]: {
          ...saved,
          usageCount: preservedUsage,
        },
      };
    }

    migratedCount += 1;
  }

  return { memory: nextMemory, migratedCount };
}

/**
 * Consulta preferências de comprovante diretamente sobre um objeto `MerchantLearningMemory`.
 */
export function lookupReceiptPreferenceInMerchantMemory(
  input: { cnpj?: string; merchantName?: string; rawText?: string },
  memory: MerchantLearningMemory,
): LearnedReceiptPreference | null {
  const records = Object.values(memory);
  if (records.length === 0) return null;

  const direct = findLearnedMerchant(
    {
      taxId: input.cnpj,
      merchant: input.merchantName,
      rawText: input.rawText,
    },
    memory,
  );
  if (direct) {
    return merchantRecordToReceiptPreference(direct);
  }

  if (input.merchantName) {
    const normKey = normalizeMerchantKey(input.merchantName);
    if (normKey) {
      const match = records.find(
        (rec) =>
          normalizeMerchantKey(rec.friendlyName) === normKey ||
          (rec.rawAliases || []).some((alias) => normalizeMerchantKey(alias) === normKey),
      );
      if (match) {
        return merchantRecordToReceiptPreference(match);
      }
    }
  }

  if (input.rawText) {
    const normRaw = normalizeMerchantKey(input.rawText);
    if (normRaw) {
      const match = records.find((rec) => {
        const candidates = [rec.friendlyName, ...(rec.rawAliases || [])];
        return candidates.some((c) => {
          const part = normalizeMerchantKey(c);
          return part.length >= 4 && normRaw.includes(part);
        });
      });
      if (match) {
        return merchantRecordToReceiptPreference(match);
      }
    }
  }

  return null;
}

/**
 * Registra o feedback ou correção do usuário para enriquecer o aprendizado contínuo.
 * Quando a ponte `merchantLearning` está registrada, grava na fonte canônica unificada.
 */
export function learnFromReceiptCorrection(correction: UserReceiptCorrection): void {
  const merchantName = (correction.correctedMerchant || correction.rawMerchant || "").trim();
  if (!merchantName) return;

  if (activeBridge) {
    activeBridge.record(receiptCorrectionToMerchantParams(correction));
    return;
  }

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

  if (cleanDoc) {
    dict[`cnpj:${cleanDoc}`] = preference;
  }

  if (normalizedName) {
    dict[`name:${normalizedName}`] = preference;
  }

  if (rawNormalized && rawNormalized !== normalizedName) {
    dict[`name:${rawNormalized}`] = preference;
  }

  saveReceiptLearningDictionary(dict);
}

/**
 * Consulta a memória adaptativa em busca de preferências aprendidas anteriormente.
 * Prioriza `merchantLearning` (via parâmetro explícito ou ponte de serviço), com fallback
 * silencioso para o dicionário legado `financas_receipt_learning_v1`.
 */
export function getLearnedReceiptPreferences(input: {
  cnpj?: string;
  merchantName?: string;
  rawText?: string;
  userMemory?: MerchantLearningMemory;
}): LearnedReceiptPreference | null {
  const memory = input.userMemory ?? activeBridge?.getMemory();
  if (memory) {
    const fromUnified = lookupReceiptPreferenceInMerchantMemory(input, memory);
    if (fromUnified) {
      return fromUnified;
    }
  }

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
  if (activeBridge?.clear) {
    activeBridge.clear();
  }
}
