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
import {
  type CardDigitsMapping,
  type MerchantLearningMemory,
  type MerchantLearningRecord,
  type RecordMerchantLearningParams,
  recordCardDigitsLearning,
  forgetCardDigitsLearning,
  lookupCardByDigits,
  recordMerchantLearning,
  forgetMerchantLearning,
  type ResolveMerchantIdentityParams,
  type ResolvedMerchantIdentity,
  resolveMerchantIdentity,
} from "@/domain/notifications";
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
      result[key] = {
        friendlyName: String(rec.friendlyName || "").trim(),
        categorySlug: String(rec.categorySlug || "").trim(),
        cnpjOrCpf: rec.cnpjOrCpf ? String(rec.cnpjOrCpf).replace(/\D/g, "") : undefined,
        rawAliases: Array.isArray(rec.rawAliases)
          ? rec.rawAliases.map((a) => String(a).toLowerCase().trim()).filter(Boolean)
          : [],
        preferredPaymentMethod: rec.preferredPaymentMethod,
        preferredCardId: rec.preferredCardId ? String(rec.preferredCardId) : undefined,
        usageCount: Number(rec.usageCount) || 1,
        lastUsedAt: String(rec.lastUsedAt || new Date().toISOString()),
      };
    }
  }
  return result;
}

/**
 * Lê a memória de aprendizado do cache em memória ou localStorage isolado (< 2 ms).
 */
export function getMerchantLearningMemory(): MerchantLearningMemory {
  if (memoryCache !== null) {
    return memoryCache;
  }
  try {
    const raw = getUserStorageItem(STORAGE_KEY);
    if (!raw) {
      memoryCache = {};
      return memoryCache;
    }
    const parsed = JSON.parse(raw);
    memoryCache = sanitizeLearningMemory(parsed);
    return memoryCache;
  } catch {
    memoryCache = {};
    return memoryCache;
  }
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

      merged[key] = {
        friendlyName: cloudTime >= localTime ? cloudRec.friendlyName : localRec.friendlyName,
        categorySlug: cloudTime >= localTime ? cloudRec.categorySlug : localRec.categorySlug,
        cnpjOrCpf: cloudRec.cnpjOrCpf || localRec.cnpjOrCpf,
        rawAliases: mergedAliases,
        preferredPaymentMethod:
          cloudTime >= localTime
            ? cloudRec.preferredPaymentMethod ?? localRec.preferredPaymentMethod
            : localRec.preferredPaymentMethod ?? cloudRec.preferredPaymentMethod,
        preferredCardId:
          cloudTime >= localTime
            ? cloudRec.preferredCardId ?? localRec.preferredCardId
            : localRec.preferredCardId ?? cloudRec.preferredCardId,
        usageCount: Math.max(localRec.usageCount, cloudRec.usageCount),
        lastUsedAt: cloudTime >= localTime ? cloudRec.lastUsedAt : localRec.lastUsedAt,
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
    notifyListeners(getMerchantLearningMemory());
    notifyCardDigitsListeners(getCardDigitsMapping());
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
// HELPER UNIFICADO DE FEEDBACK DE TRANSAÇÃO (Tarefa 3.3)
// =========================================================================

export interface RecordTransactionLearningParams {
  merchant: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  cardId?: string;
  cardLastDigits?: string;
  taxId?: string;
}

/**
 * Helper unificado que atualiza a memória semântica do estabelecimento (categoria habitual,
 * método de pagamento e cartão preferencial) e os dígitos aprendidos do cartão simultaneamente.
 */
export function recordTransactionLearning(params: RecordTransactionLearningParams): void {
  const { merchant, categoryId, paymentMethod, cardId, cardLastDigits, taxId } = params;

  try {
    const trimmedMerchant = merchant?.trim();

    // 1. Memoriza estabelecimento, categoria habitual e preferências se houver nome válido
    if (trimmedMerchant && trimmedMerchant.length >= 2 && categoryId) {
      recordMerchantLearningAction({
        friendlyName: trimmedMerchant,
        categorySlug: categoryId,
        cnpjOrCpf: taxId,
        preferredPaymentMethod: paymentMethod,
        preferredCardId: cardId,
      });
    }

    // 2. Memoriza vínculo de 4 dígitos do cartão se ambos estiverem disponíveis
    if (cardId && cardLastDigits) {
      recordCardDigitFeedback(cardLastDigits, cardId);
    }

    // 3. Dispara reavaliação de insights
    triggerSessionInsightsReevaluation();
  } catch {
    // Aprendizado em background nunca bloqueia a experiência do usuário
  }
}

