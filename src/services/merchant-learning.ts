/**
 * Serviço e Hook Global de Aprendizado Semântico de Estabelecimentos (§2.4).
 *
 * Conecta a memória rápida no cliente (tempo de resposta < 2 ms via cache em memória e localStorage isolado)
 * com sincronização em nuvem multi-dispositivo no Supabase (`user_preferences.custom_settings.merchantLearning`).
 *
 * Proporciona auto-atualização do aprendizado quando o usuário salva ou edita transações.
 */

import { useCallback, useEffect, useState } from "react";
import { updateCustomSettings } from "@/data/repositories/user-preferences";
import { type CardDigitsMapping, type LearnedCutTier, type LearnedIncomeProfile, type LearnedServiceSegment, LEARNED_CUT_TIERS, LEARNED_SERVICE_SEGMENTS, type MerchantLearningMemory, type MerchantLearningRecord, type RecordMerchantLearningParams, findLearnedMerchant, normalizeSemanticTag, recordCardDigitsLearning, forgetCardDigitsLearning, lookupCardByDigits, recordMerchantLearning, forgetMerchantLearning } from "@/domain/notifications/merchant-memory";
import { type LearnedReceiptPreference, RECEIPT_LEARNING_STORAGE_KEY, migrateLegacyReceiptDictToMerchantMemory, registerReceiptLearningBridge } from "@/domain/notifications/receipt-learning";
import { type ResolveMerchantIdentityParams, type ResolvedMerchantIdentity, resolveMerchantIdentity } from "@/domain/notifications/merchant-resolver";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";
import type { PaymentMethod } from "@/types/schema";

const STORAGE_KEY = "merchant_learning_memory";
const listeners = new Set<(memory: MerchantLearningMemory) => void>();

// Cache volátil síncrono em memória (< 1 ms)
let memoryCache: MerchantLearningMemory | null = null;
let syncTimeout: NodeJS.Timeout | null = null;
let isSyncingToCloud = false;
const syncStatusListeners = new Set<(syncing: boolean) => void>();

const VALID_SEGMENTS_SET = new Set<string>(LEARNED_SERVICE_SEGMENTS);
const VALID_CUT_TIERS_SET = new Set<string>(LEARNED_CUT_TIERS);

/**
 * Normaliza e sanitiza o payload da memória de aprendizado.
 */
function sanitizeLearningMemory(raw: unknown): MerchantLearningMemory {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: MerchantLearningMemory = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (
      value &&
      typeof value === "object" &&
      "friendlyName" in value &&
      "categorySlug" in value
    ) {
      const rec = value as Partial<MerchantLearningRecord>;
      const rawSeg = typeof rec.serviceSegment === "string" ? rec.serviceSegment : "";
      const rawTier = typeof rec.cutTier === "string" ? rec.cutTier : "";
      const rawIncome = typeof rec.incomeProfile === "string" ? rec.incomeProfile : "";
      const cleanTags = Array.isArray(rec.semanticTags)
        ? Array.from(
            new Set(
              rec.semanticTags
                .map((t) => normalizeSemanticTag(String(t || "")))
                .filter(Boolean),
            ),
          ).slice(0, 12)
        : undefined;
      const validWeight =
        typeof rec.preferredReportWeight === "number" &&
        Number.isFinite(rec.preferredReportWeight) &&
        rec.preferredReportWeight >= 0 &&
        rec.preferredReportWeight <= 1
          ? rec.preferredReportWeight
          : undefined;

      result[key] = {
        friendlyName: String(rec.friendlyName || "").trim(),
        categorySlug: String(rec.categorySlug || "").trim(),
        cnpjOrCpf: rec.cnpjOrCpf ? String(rec.cnpjOrCpf).replace(/\D/g, "") : undefined,
        pixKeys: Array.isArray(rec.pixKeys)
          ? rec.pixKeys.map((k) => String(k).trim()).filter(Boolean)
          : undefined,
        defaultNature: rec.defaultNature === "expense" || rec.defaultNature === "income" ? rec.defaultNature : undefined,
        rawAliases: Array.isArray(rec.rawAliases)
          ? rec.rawAliases.map((a) => String(a).toLowerCase().trim()).filter(Boolean)
          : [],
        preferredPaymentMethod: rec.preferredPaymentMethod,
        preferredCardId: rec.preferredCardId ? String(rec.preferredCardId) : undefined,
        preferredCardLastDigits: rec.preferredCardLastDigits
          ? String(rec.preferredCardLastDigits).replace(/\D/g, "").slice(-4) || undefined
          : undefined,
        preferredCardBrand: rec.preferredCardBrand ? String(rec.preferredCardBrand).trim() : undefined,
        ...(VALID_SEGMENTS_SET.has(rawSeg)
          ? { serviceSegment: rawSeg as LearnedServiceSegment }
          : {}),
        ...(VALID_CUT_TIERS_SET.has(rawTier)
          ? { cutTier: rawTier as LearnedCutTier }
          : {}),
        ...(typeof rec.isLearnedSubscription === "boolean"
          ? { isLearnedSubscription: rec.isLearnedSubscription }
          : {}),
        ...(rawIncome === "fixed" || rawIncome === "frequent_client"
          ? { incomeProfile: rawIncome as LearnedIncomeProfile }
          : {}),
        ...(cleanTags && cleanTags.length > 0 ? { semanticTags: cleanTags } : {}),
        ...(validWeight !== undefined
          ? {
              preferredReportWeight: validWeight,
              consistentWeightCount:
                typeof rec.consistentWeightCount === "number" && rec.consistentWeightCount >= 1
                  ? Math.round(rec.consistentWeightCount)
                  : 1,
            }
          : {}),
        ...(typeof rec.preferredIsFamily === "boolean"
          ? {
              preferredIsFamily: rec.preferredIsFamily,
              consistentFamilyCount:
                typeof rec.consistentFamilyCount === "number" && rec.consistentFamilyCount >= 1
                  ? Math.round(rec.consistentFamilyCount)
                  : 1,
            }
          : {}),
        usageCount: Number(rec.usageCount) || 1,
        lastUsedAt: String(rec.lastUsedAt || new Date().toISOString()),
      };
    }
  }
  return result;
}

function readStoredMerchantLearningMemory(): MerchantLearningMemory {
  try {
    const raw = getUserStorageItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeLearningMemory(JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * Reseta o cache em memória de estabelecimentos (útil para testes de cold load e alternância de conta).
 */
export function resetMerchantLearningCache(): void {
  memoryCache = null;
}

/**
 * Migra silenciosamente registros legados de comprovantes (`financas_receipt_learning_v1`)
 * para a memória unificada `merchantLearning` e remove a chave legada após persistência.
 */
export function migrateLegacyReceiptLearningIfNeeded(
  baseMemory?: MerchantLearningMemory,
  scheduleCloud = true,
): { memory: MerchantLearningMemory; migratedCount: number } {
  const base =
    baseMemory ?? (memoryCache !== null ? memoryCache : readStoredMerchantLearningMemory());

  if (typeof window === "undefined" || !window.localStorage) {
    return { memory: base, migratedCount: 0 };
  }

  try {
    const rawLegacy = window.localStorage.getItem(RECEIPT_LEARNING_STORAGE_KEY);
    if (!rawLegacy) {
      return { memory: base, migratedCount: 0 };
    }
    const parsedLegacy = JSON.parse(rawLegacy);
    if (!parsedLegacy || typeof parsedLegacy !== "object" || Array.isArray(parsedLegacy)) {
      return { memory: base, migratedCount: 0 };
    }

    const migrated = migrateLegacyReceiptDictToMerchantMemory(
      parsedLegacy as Record<string, LearnedReceiptPreference>,
      base,
    );

    if (migrated.migratedCount > 0) {
      setMerchantLearningMemory(migrated.memory, scheduleCloud);
      try {
        window.localStorage.removeItem(RECEIPT_LEARNING_STORAGE_KEY);
      } catch {
        // Ignora falha de remoção
      }
    }

    return migrated;
  } catch {
    return { memory: base, migratedCount: 0 };
  }
}

/**
 * Lê a memória de aprendizado do cache em memória ou localStorage isolado (< 2 ms).
 * No carregamento inicial (cold load), executa migração silenciosa do legado `financas_receipt_learning_v1`.
 */
export function getMerchantLearningMemory(): MerchantLearningMemory {
  if (memoryCache !== null) {
    return memoryCache;
  }
  const loaded = readStoredMerchantLearningMemory();
  const migrated = migrateLegacyReceiptLearningIfNeeded(loaded, true);
  if (migrated.migratedCount === 0) {
    memoryCache = loaded;
  }
  return memoryCache ?? migrated.memory;
}

/**
 * Atualiza o cache local e emite notificação para todos os ouvintes reativos.
 */
export function setMerchantLearningMemory(
  memory: MerchantLearningMemory,
  scheduleCloud = true,
): void {
  memoryCache = memory;
  try {
    setUserStorageItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Local storage quota ou bloqueio em iframe
  }

  notifyListeners(memory);

  if (scheduleCloud) {
    triggerCloudSync(memory);
  }
}

/**
 * Registra um novo aprendizado semântico na memória local e agenda sincronização na nuvem.
 */
export function recordMerchantLearningAction(
  params: RecordMerchantLearningParams,
  now = new Date().toISOString(),
): MerchantLearningMemory {
  const current = getMerchantLearningMemory();
  const next = recordMerchantLearning(params, current, now);
  setMerchantLearningMemory(next, true);
  return next;
}

/**
 * Remove um registro da memória local e agenda sincronização na nuvem.
 */
export function forgetMerchantLearningAction(
  identifier: string,
): MerchantLearningMemory {
  const current = getMerchantLearningMemory();
  const next = forgetMerchantLearning(identifier, current);
  setMerchantLearningMemory(next, true);
  return next;
}

/**
 * Mescla a memória local com a cópia na nuvem (Supabase), preservando o registro mais recente.
 */
export function syncMerchantLearningFromCloud(
  cloudMemoryRaw?: Record<string, unknown> | null,
): void {
  if (!cloudMemoryRaw) return;
  const cloudMemory = sanitizeLearningMemory(cloudMemoryRaw);
  const localMemory = getMerchantLearningMemory();

  let hasChanges = false;
  const merged: MerchantLearningMemory = { ...localMemory };

  for (const [key, cloudRec] of Object.entries(cloudMemory)) {
    const localRec = merged[key];
    if (!localRec) {
      merged[key] = cloudRec;
      hasChanges = true;
    } else {
      // Mescla com base no timestamp de último uso ou contagem
      const cloudTime = new Date(cloudRec.lastUsedAt).getTime() || 0;
      const localTime = new Date(localRec.lastUsedAt).getTime() || 0;

      const mergedAliases = Array.from(
        new Set([...localRec.rawAliases, ...cloudRec.rawAliases]),
      );
      const mergedPixKeys = Array.from(
        new Set([...(localRec.pixKeys || []), ...(cloudRec.pixKeys || [])]),
      );
      const mergedTags = Array.from(
        new Set([...(localRec.semanticTags || []), ...(cloudRec.semanticTags || [])]),
      ).slice(0, 12);
      const cloudNewer = cloudTime >= localTime;

      merged[key] = {
        friendlyName: cloudNewer ? cloudRec.friendlyName : localRec.friendlyName,
        categorySlug: cloudNewer ? cloudRec.categorySlug : localRec.categorySlug,
        cnpjOrCpf: cloudRec.cnpjOrCpf || localRec.cnpjOrCpf,
        pixKeys: mergedPixKeys.length > 0 ? mergedPixKeys : undefined,
        defaultNature: cloudNewer
          ? cloudRec.defaultNature ?? localRec.defaultNature
          : localRec.defaultNature ?? cloudRec.defaultNature,
        rawAliases: mergedAliases,
        preferredPaymentMethod: cloudNewer
          ? cloudRec.preferredPaymentMethod ?? localRec.preferredPaymentMethod
          : localRec.preferredPaymentMethod ?? cloudRec.preferredPaymentMethod,
        preferredCardId: cloudNewer
          ? cloudRec.preferredCardId ?? localRec.preferredCardId
          : localRec.preferredCardId ?? cloudRec.preferredCardId,
        preferredCardLastDigits: cloudNewer
          ? cloudRec.preferredCardLastDigits ?? localRec.preferredCardLastDigits
          : localRec.preferredCardLastDigits ?? cloudRec.preferredCardLastDigits,
        preferredCardBrand: cloudNewer
          ? cloudRec.preferredCardBrand ?? localRec.preferredCardBrand
          : localRec.preferredCardBrand ?? cloudRec.preferredCardBrand,
        serviceSegment: cloudNewer
          ? cloudRec.serviceSegment ?? localRec.serviceSegment
          : localRec.serviceSegment ?? cloudRec.serviceSegment,
        cutTier: cloudNewer
          ? cloudRec.cutTier ?? localRec.cutTier
          : localRec.cutTier ?? cloudRec.cutTier,
        isLearnedSubscription: cloudNewer
          ? cloudRec.isLearnedSubscription ?? localRec.isLearnedSubscription
          : localRec.isLearnedSubscription ?? cloudRec.isLearnedSubscription,
        incomeProfile: cloudNewer
          ? cloudRec.incomeProfile ?? localRec.incomeProfile
          : localRec.incomeProfile ?? cloudRec.incomeProfile,
        ...(mergedTags.length > 0 ? { semanticTags: mergedTags } : {}),
        preferredReportWeight: cloudNewer
          ? cloudRec.preferredReportWeight ?? localRec.preferredReportWeight
          : localRec.preferredReportWeight ?? cloudRec.preferredReportWeight,
        consistentWeightCount:
          (cloudRec.consistentWeightCount ?? 0) >= (localRec.consistentWeightCount ?? 0)
            ? cloudRec.consistentWeightCount
            : localRec.consistentWeightCount,
        preferredIsFamily: cloudNewer
          ? cloudRec.preferredIsFamily ?? localRec.preferredIsFamily
          : localRec.preferredIsFamily ?? cloudRec.preferredIsFamily,
        consistentFamilyCount:
          (cloudRec.consistentFamilyCount ?? 0) >= (localRec.consistentFamilyCount ?? 0)
            ? cloudRec.consistentFamilyCount
            : localRec.consistentFamilyCount,
        usageCount: Math.max(localRec.usageCount, cloudRec.usageCount),
        lastUsedAt: cloudNewer ? cloudRec.lastUsedAt : localRec.lastUsedAt,
      };
      hasChanges = true;
    }
  }

  if (hasChanges) {
    // Atualiza apenas localmente sem re-disparar escrita recursiva na nuvem
    setMerchantLearningMemory(merged, false);
  }
}

/**
 * Envia alterações locais para a nuvem de forma debounced em segundo plano.
 */
function triggerCloudSync(memory: MerchantLearningMemory): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  setSyncingState(true);
  syncTimeout = setTimeout(async () => {
    try {
      await updateCustomSettings({
        merchantLearning: memory as Record<string, unknown>,
      });
    } catch {
      // Falha de rede em segundo plano: mantém local e tentará na próxima sincronização
    } finally {
      setSyncingState(false);
    }
  }, 1000);
}

function setSyncingState(syncing: boolean): void {
  if (isSyncingToCloud !== syncing) {
    isSyncingToCloud = syncing;
    syncStatusListeners.forEach((l) => l(syncing));
  }
}

/**
 * Inscreve um ouvinte para alterações reativas na memória de aprendizado.
 */
export function subscribeMerchantLearning(
  callback: (memory: MerchantLearningMemory) => void,
): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners(memory: MerchantLearningMemory): void {
  listeners.forEach((listener) => {
    try {
      listener(memory);
    } catch {
      // no-op
    }
  });
}

// Reseta cache ao alternar usuário autenticado
if (typeof window !== "undefined") {
  subscribeActiveUserId(() => {
    memoryCache = null;
    cardDigitsCache = null;
    bankCardCache = null;
    notifyListeners(getMerchantLearningMemory());
    notifyCardDigitsListeners(getCardDigitsMapping());
    notifyBankCardListeners(getBankCardMapping());
  });
}

const sessionInsightsReevalListeners = new Set<() => void>();

/**
 * Inscreve um ouvinte para reavaliação imediata de insights na sessão (§Eixo 1).
 */
export function subscribeInsightsReevaluation(callback: () => void): () => void {
  sessionInsightsReevalListeners.add(callback);
  return () => {
    sessionInsightsReevalListeners.delete(callback);
  };
}

/**
 * Dispara reavaliação imediata de insights pendentes na sessão (§Eixo 1).
 */
export function triggerSessionInsightsReevaluation(): void {
  sessionInsightsReevalListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // no-op
    }
  });
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("axis:session-insights-reevaluate"));
    } catch {
      // no-op
    }
  }
}

/**
 * Auto-aprende par (merchant, category) e (rawName, friendlyName) a partir de
 * alterações no extrato, notificações, wizard ou salvamento de despesas (§Eixo 1).
 * Dispara reavaliação imediata de insights pendentes na sessão.
 */
export function autoLearnExpenseCategory(
  description: string,
  categorySlugOrId: string,
  taxId?: string,
  rawName?: string,
): void {
  const trimmed = description?.trim();
  if (!trimmed || trimmed.length < 2 || !categorySlugOrId) return;

  try {
    const rawTrimmed = rawName?.trim();
    const rawAliases =
      rawTrimmed && rawTrimmed.toLowerCase() !== trimmed.toLowerCase()
        ? [rawTrimmed.toLowerCase()]
        : undefined;

    recordMerchantLearningAction({
      friendlyName: trimmed,
      categorySlug: categorySlugOrId,
      cnpjOrCpf: taxId,
      alias: rawTrimmed || trimmed,
      rawAliases,
    });

    triggerSessionInsightsReevaluation();
  } catch {
    // Aprendizado em background nunca bloqueia a experiência do usuário
  }
}

/**
 * Hook global reativo para consultar, registrar e resolver identidades de estabelecimentos.
 */
export function useMerchantLearning() {
  const [memory, setMemory] = useState<MerchantLearningMemory>(() =>
    getMerchantLearningMemory(),
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(isSyncingToCloud);

  useEffect(() => {
    const unsubMemory = subscribeMerchantLearning((next) => {
      setMemory(next);
    });
    const unsubSync = (syncing: boolean) => setIsSyncing(syncing);
    syncStatusListeners.add(unsubSync);

    return () => {
      unsubMemory();
      syncStatusListeners.delete(unsubSync);
    };
  }, []);

  const recordLearning = async (params: RecordMerchantLearningParams): Promise<void> => {
    recordMerchantLearningAction(params);
  };

  const forgetLearning = async (identifier: string): Promise<void> => {
    forgetMerchantLearningAction(identifier);
  };

  const resolve = useCallback(
    (params: Omit<ResolveMerchantIdentityParams, "userMemory">): ResolvedMerchantIdentity => {
      return resolveMerchantIdentity({
        ...params,
        userMemory: memory,
      });
    },
    [memory],
  );

  return {
    memory,
    isSyncing,
    recordLearning,
    forgetLearning,
    resolve,
  };
}

// =========================================================================
// SERVIÇO E PERSISTÊNCIA DE MAPEAMENTO DE DÍGITOS DE CARTÃO (§11.4 / Fase 3)
// =========================================================================

const CARD_DIGITS_STORAGE_KEY = "card_digits_memory";
const cardDigitsListeners = new Set<(mapping: CardDigitsMapping) => void>();
let cardDigitsCache: CardDigitsMapping | null = null;
let cardDigitsSyncTimeout: NodeJS.Timeout | null = null;
let isSyncingCardDigitsToCloud = false;
const cardDigitsSyncStatusListeners = new Set<(syncing: boolean) => void>();

function sanitizeCardDigitsMapping(raw: unknown): CardDigitsMapping {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: CardDigitsMapping = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = String(key || "").replace(/\D/g, "");
    const cleanVal = typeof val === "string" ? val.trim() : "";
    if (cleanKey && cleanVal) {
      result[cleanKey] = cleanVal;
    }
  }
  return result;
}

/**
 * Lê o mapa de dígitos de cartão do cache em memória ou localStorage isolado por usuário (< 2 ms).
 */
export function getCardDigitsMapping(): CardDigitsMapping {
  if (cardDigitsCache !== null) {
    return cardDigitsCache;
  }
  try {
    const raw = getUserStorageItem(CARD_DIGITS_STORAGE_KEY);
    if (!raw) {
      cardDigitsCache = {};
      return cardDigitsCache;
    }
    const parsed = JSON.parse(raw);
    cardDigitsCache = sanitizeCardDigitsMapping(parsed);
    return cardDigitsCache;
  } catch {
    cardDigitsCache = {};
    return cardDigitsCache;
  }
}

/**
 * Atualiza o cache local de dígitos e emite notificação para os ouvintes reativos.
 */
export function setCardDigitsMapping(
  mapping: CardDigitsMapping,
  scheduleCloud = true,
): void {
  cardDigitsCache = mapping;
  try {
    setUserStorageItem(CARD_DIGITS_STORAGE_KEY, JSON.stringify(mapping));
  } catch {
    // Local storage quota ou iframe restrito
  }

  notifyCardDigitsListeners(mapping);

  if (scheduleCloud) {
    triggerCardDigitsCloudSync(mapping);
  }
}

/**
 * Registra o feedback do usuário associando dígitos finais ao ID do cartão.
 */
export function recordCardDigitFeedback(
  digits: string,
  cardId: string,
): CardDigitsMapping {
  const current = getCardDigitsMapping();
  const next = recordCardDigitsLearning(digits, cardId, current);
  setCardDigitsMapping(next, true);
  return next;
}

/**
 * Remove associações de dígitos da memória do usuário.
 */
export function forgetCardDigitFeedback(
  cardIdOrDigits: string,
): CardDigitsMapping {
  const current = getCardDigitsMapping();
  const next = forgetCardDigitsLearning(cardIdOrDigits, current);
  setCardDigitsMapping(next, true);
  return next;
}

/**
 * Mescla o mapa de dígitos da nuvem (Supabase) com a memória local.
 */
export function syncCardDigitsMappingFromCloud(
  cloudMappingRaw?: Record<string, unknown> | null,
): void {
  if (!cloudMappingRaw) return;
  const cloudMapping = sanitizeCardDigitsMapping(cloudMappingRaw);
  const localMapping = getCardDigitsMapping();

  // Nuvem fornece base, local prevalece para edições offline recentes
  const merged: CardDigitsMapping = { ...cloudMapping, ...localMapping };
  setCardDigitsMapping(merged, false);
}

/**
 * Envia o mapa de dígitos para a nuvem de forma debounced em segundo plano.
 */
function triggerCardDigitsCloudSync(mapping: CardDigitsMapping): void {
  if (cardDigitsSyncTimeout) {
    clearTimeout(cardDigitsSyncTimeout);
  }

  setCardDigitsSyncingState(true);
  cardDigitsSyncTimeout = setTimeout(async () => {
    try {
      await updateCustomSettings({
        cardDigitsMapping: mapping,
      });
    } catch {
      // Falha de rede em segundo plano: mantém local e tentará na próxima sincronização
    } finally {
      setCardDigitsSyncingState(false);
    }
  }, 1000);
}

function setCardDigitsSyncingState(syncing: boolean): void {
  if (isSyncingCardDigitsToCloud !== syncing) {
    isSyncingCardDigitsToCloud = syncing;
    cardDigitsSyncStatusListeners.forEach((l) => l(syncing));
  }
}

/**
 * Inscreve um ouvinte para alterações no mapa de dígitos de cartão.
 */
export function subscribeCardDigitsMapping(
  callback: (mapping: CardDigitsMapping) => void,
): () => void {
  cardDigitsListeners.add(callback);
  return () => {
    cardDigitsListeners.delete(callback);
  };
}

function notifyCardDigitsListeners(mapping: CardDigitsMapping): void {
  cardDigitsListeners.forEach((listener) => {
    try {
      listener(mapping);
    } catch {
      // no-op
    }
  });
}

/**
 * Hook reativo para consultar e registrar aprendizado de dígitos de cartão.
 */
export function useCardDigitsMapping() {
  const [mapping, setMapping] = useState<CardDigitsMapping>(() =>
    getCardDigitsMapping(),
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(isSyncingCardDigitsToCloud);

  useEffect(() => {
    const unsub = subscribeCardDigitsMapping((next) => {
      setMapping(next);
    });
    const unsubSync = (syncing: boolean) => setIsSyncing(syncing);
    cardDigitsSyncStatusListeners.add(unsubSync);

    return () => {
      unsub();
      cardDigitsSyncStatusListeners.delete(unsubSync);
    };
  }, []);

  const recordFeedback = useCallback((digits: string, cardId: string) => {
    return recordCardDigitFeedback(digits, cardId);
  }, []);

  const forgetFeedback = useCallback((cardIdOrDigits: string) => {
    return forgetCardDigitFeedback(cardIdOrDigits);
  }, []);

  const lookupCard = useCallback(
    (digits: string | undefined | null) => {
      return lookupCardByDigits(digits, mapping);
    },
    [mapping],
  );

  return {
    mapping,
    cardDigitsMapping: mapping,
    recordFeedback,
    forgetFeedback,
    lookupCard,
    isSyncing,
  };
}

// =========================================================================
// SERVIÇO E PERSISTÊNCIA DE MAPEAMENTO DE PACOTE BANCÁRIO -> CARTÃO (§Plano 09 — Fase 5)
// =========================================================================

const BANK_CARD_STORAGE_KEY = "bank_card_memory";
const bankCardListeners = new Set<(mapping: Record<string, string>) => void>();
let bankCardCache: Record<string, string> | null = null;
let bankCardSyncTimeout: NodeJS.Timeout | null = null;
let isSyncingBankCardToCloud = false;
const bankCardSyncStatusListeners = new Set<(syncing: boolean) => void>();

function sanitizeBankCardMapping(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = String(key || "").trim().toLowerCase();
    const cleanVal = typeof val === "string" ? val.trim() : "";
    if (cleanKey && cleanVal) {
      result[cleanKey] = cleanVal;
    }
  }
  return result;
}

/**
 * Lê o mapa de banco/pacote -> cartão do cache ou storage isolado por usuário.
 */
export function getBankCardMapping(): Record<string, string> {
  if (bankCardCache !== null) {
    return bankCardCache;
  }
  try {
    const raw = getUserStorageItem(BANK_CARD_STORAGE_KEY);
    if (!raw) {
      bankCardCache = {};
      return bankCardCache;
    }
    const parsed = JSON.parse(raw);
    bankCardCache = sanitizeBankCardMapping(parsed);
    return bankCardCache;
  } catch {
    bankCardCache = {};
    return bankCardCache;
  }
}

/**
 * Atualiza o cache local de mapeamento bancário e emite notificação aos ouvintes.
 */
export function setBankCardMapping(
  mapping: Record<string, string>,
  scheduleCloud = true,
): void {
  bankCardCache = mapping;
  try {
    setUserStorageItem(BANK_CARD_STORAGE_KEY, JSON.stringify(mapping));
  } catch {
    // Quota ou iframe restrito
  }

  notifyBankCardListeners(mapping);

  if (scheduleCloud) {
    triggerBankCardCloudSync(mapping);
  }
}

/**
 * Registra a associação entre um pacote bancário Android (ou identificador de banco) e um cartão.
 */
export function recordBankCardFeedback(
  packageName: string,
  cardId: string,
): Record<string, string> {
  const cleanPackage = packageName.trim().toLowerCase();
  const cleanCardId = cardId.trim();
  if (!cleanPackage || !cleanCardId) return getBankCardMapping();

  const current = getBankCardMapping();
  const next = { ...current, [cleanPackage]: cleanCardId };
  setBankCardMapping(next, true);
  return next;
}

/**
 * Remove a associação de um pacote bancário da memória do usuário.
 */
export function forgetBankCardFeedback(packageName: string): Record<string, string> {
  const cleanPackage = packageName.trim().toLowerCase();
  const current = getBankCardMapping();
  if (!(cleanPackage in current)) return current;

  const next = { ...current };
  delete next[cleanPackage];
  setBankCardMapping(next, true);
  return next;
}

/**
 * Mescla o mapa bancário da nuvem (Supabase) com a memória local.
 */
export function syncBankCardMappingFromCloud(
  cloudMappingRaw?: Record<string, unknown> | null,
): void {
  if (!cloudMappingRaw) return;
  const cloudMapping = sanitizeBankCardMapping(cloudMappingRaw);
  const localMapping = getBankCardMapping();

  const merged: Record<string, string> = { ...cloudMapping, ...localMapping };
  setBankCardMapping(merged, false);
}

function triggerBankCardCloudSync(mapping: Record<string, string>): void {
  if (bankCardSyncTimeout) {
    clearTimeout(bankCardSyncTimeout);
  }

  setBankCardSyncingState(true);
  bankCardSyncTimeout = setTimeout(async () => {
    try {
      await updateCustomSettings({
        bankCardMapping: mapping,
      });
    } catch {
      // Offline fallback
    } finally {
      setBankCardSyncingState(false);
    }
  }, 1000);
}

function setBankCardSyncingState(syncing: boolean): void {
  if (isSyncingBankCardToCloud !== syncing) {
    isSyncingBankCardToCloud = syncing;
    bankCardSyncStatusListeners.forEach((l) => l(syncing));
  }
}

export function subscribeBankCardMapping(
  callback: (mapping: Record<string, string>) => void,
): () => void {
  bankCardListeners.add(callback);
  return () => {
    bankCardListeners.delete(callback);
  };
}

function notifyBankCardListeners(mapping: Record<string, string>): void {
  bankCardListeners.forEach((listener) => {
    try {
      listener(mapping);
    } catch {
      // no-op
    }
  });
}

/**
 * Hook reativo para consultar e registrar mapeamento de pacotes bancários para cartões.
 */
export function useBankCardMapping() {
  const [mapping, setMapping] = useState<Record<string, string>>(() =>
    getBankCardMapping(),
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(isSyncingBankCardToCloud);

  useEffect(() => {
    const unsub = subscribeBankCardMapping((next) => {
      setMapping(next);
    });
    const unsubSync = (syncing: boolean) => setIsSyncing(syncing);
    bankCardSyncStatusListeners.add(unsubSync);

    return () => {
      unsub();
      bankCardSyncStatusListeners.delete(unsubSync);
    };
  }, []);

  const recordFeedback = useCallback((pkg: string, cardId: string) => {
    return recordBankCardFeedback(pkg, cardId);
  }, []);

  const forgetFeedback = useCallback((pkg: string) => {
    return forgetBankCardFeedback(pkg);
  }, []);

  const lookupCard = useCallback(
    (pkg: string | undefined | null) => {
      if (!pkg) return undefined;
      return mapping[pkg.trim().toLowerCase()];
    },
    [mapping],
  );

  return {
    mapping,
    bankCardMapping: mapping,
    recordFeedback,
    forgetFeedback,
    lookupCard,
    isSyncing,
  };
}

// =========================================================================
// HELPER UNIFICADO DE FEEDBACK DE TRANSAÇÃO (Tarefa 3.3)
// =========================================================================

export interface RecordTransactionLearningParams {
  merchant?: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  cardId?: string;
  cardLastDigits?: string;
  taxId?: string;
  packageName?: string;
  pixKey?: string;
  nature?: "expense" | "income";
  reportWeight?: number;
  isFamily?: boolean;
  semanticTags?: readonly string[];
  serviceSegment?: LearnedServiceSegment;
  cutTier?: LearnedCutTier;
  isLearnedSubscription?: boolean;
  incomeProfile?: LearnedIncomeProfile;
}

/**
 * Helper unificado que atualiza a memória semântica do estabelecimento (categoria habitual,
 * método de pagamento, chave Pix e cartão preferencial), os dígitos aprendidos do cartão e a associação
 * com o app bancário emissor simultaneamente.
 */
export function recordTransactionLearning(params: RecordTransactionLearningParams): void {
  const {
    merchant,
    categoryId,
    paymentMethod,
    cardId,
    cardLastDigits,
    taxId,
    packageName,
    pixKey,
    nature,
    reportWeight,
    isFamily,
    semanticTags,
    serviceSegment,
    cutTier,
    isLearnedSubscription,
    incomeProfile,
  } = params;

  try {
    const trimmedMerchant = merchant?.trim();

    // 1. Memoriza estabelecimento, categoria habitual, chave Pix e preferências
    if ((trimmedMerchant && trimmedMerchant.length >= 2 || pixKey) && categoryId) {
      recordMerchantLearningAction({
        friendlyName: trimmedMerchant || (pixKey ? `Pix ${pixKey}` : "Contato"),
        categorySlug: categoryId,
        cnpjOrCpf: taxId,
        pixKey,
        defaultNature: nature,
        preferredPaymentMethod: paymentMethod,
        preferredCardId: cardId,
        reportWeight,
        isFamily,
        semanticTags,
        serviceSegment,
        cutTier,
        isLearnedSubscription,
        incomeProfile,
      });
    }

    // 2. Memoriza vínculo de 4 dígitos do cartão se ambos estiverem disponíveis
    if (cardId && cardLastDigits) {
      recordCardDigitFeedback(cardLastDigits, cardId);
    }

    // 3. Memoriza vínculo de pacote bancário -> cartão se ambos estiverem disponíveis
    if (cardId && packageName) {
      recordBankCardFeedback(packageName, cardId);
    }

    // 4. Dispara reavaliação de insights
    triggerSessionInsightsReevaluation();
  } catch {
    // Aprendizado em background nunca bloqueia a experiência do usuário
  }
}

export interface BatchAiMerchantTeachingItem {
  rawDescription: string;
  friendlyName: string;
  canonicalMerchant?: string | null;
  categoryId?: string | null;
  serviceSegment?: LearnedServiceSegment | null;
  cutTier?: LearnedCutTier | null;
  isSubscription?: boolean | null;
  semanticTags?: readonly string[] | null;
}

/**
 * Persiste silenciosamente aprendizados semânticos ensinados pela IA em lote
 * (`categorize_batch` de faturas ou expansão semântica da busca), preservando sempre
 * categorias já ensinadas manualmente pelo usuário.
 */
export function recordBatchAiMerchantTeachings(
  items: readonly BatchAiMerchantTeachingItem[],
): MerchantLearningMemory {
  if (!items.length) {
    return getMerchantLearningMemory();
  }

  let workingMemory = getMerchantLearningMemory();
  let mutated = false;
  const now = new Date().toISOString();

  for (const item of items) {
    const friendly = (item.canonicalMerchant || item.friendlyName || "").trim();
    const raw = item.rawDescription.trim();
    if (!friendly || !raw) continue;

    const existing = findLearnedMerchant(
      { merchant: friendly, rawText: raw },
      workingMemory,
    );
    const preservedCategorySlug = existing?.categorySlug || item.categoryId || "";
    const aliases = [raw, item.friendlyName].filter(Boolean);

    const hasMetadata =
      Boolean(preservedCategorySlug) ||
      Boolean(item.semanticTags?.length) ||
      Boolean(item.serviceSegment) ||
      Boolean(item.cutTier) ||
      typeof item.isSubscription === "boolean";

    if (!hasMetadata) continue;

    workingMemory = recordMerchantLearning(
      {
        friendlyName: existing?.friendlyName || friendly,
        categorySlug: preservedCategorySlug,
        alias: raw,
        rawAliases: aliases,
        serviceSegment: item.serviceSegment ?? undefined,
        cutTier: item.cutTier ?? undefined,
        isLearnedSubscription:
          typeof item.isSubscription === "boolean" ? item.isSubscription : undefined,
        semanticTags: item.semanticTags ?? undefined,
      },
      workingMemory,
      now,
    );
    mutated = true;
  }

  if (mutated) {
    setMerchantLearningMemory(workingMemory, true);
    triggerSessionInsightsReevaluation();
  }

  return workingMemory;
}

// Registra a ponte de unificação para `domain/notifications/receipt-learning.ts`
registerReceiptLearningBridge({
  getMemory: () => getMerchantLearningMemory(),
  record: (params) => {
    const next = recordMerchantLearningAction(params);
    triggerSessionInsightsReevaluation();
    return next;
  },
  clear: () => {
    setMerchantLearningMemory({}, false);
  },
});

