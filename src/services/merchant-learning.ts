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
  type MerchantLearningMemory,
  type MerchantLearningRecord,
  type RecordMerchantLearningParams,
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
    notifyListeners(getMerchantLearningMemory());
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
