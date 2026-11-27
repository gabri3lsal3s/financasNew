import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_DISMISS_DAYS,
  SMART_ADVISOR_DISMISSALS_KEY,
  SMART_ADVISOR_LAST_DISMISSED_DAY_KEY,
  type SmartAdvisorInsight,
} from "@/domain/insights/advisor";
import {
  muteInsightFamily,
  resolveInsightThemeFamily,
} from "@/domain/insights/attention-budget";
import type { InsightThemeFamily, SmartDecayRecord } from "@/domain/insights/learning-graph";
import {
  computeDismissCooldownExpiry,
  mergeAndFilterValidDismissals,
} from "@/domain/insights/smart-advisor-rules";
import { getActiveUserId, getUserStorageKey, subscribeActiveUserId } from "@/services/user-storage";
import { useUpdateCustomSettings, useUserPreferences } from "@/state";

let memoryDismissals: Record<string, number> = {};
let memoryLastDismissedDay: string | null = null;
let loadedScope: string | null = null;
const subscribers = new Set<() => void>();

function currentUserScope(): string {
  return getActiveUserId() ?? "__guest__";
}

function getScopedDismissalsKey(): string {
  const uid = getActiveUserId();
  return uid ? getUserStorageKey(SMART_ADVISOR_DISMISSALS_KEY, uid) : SMART_ADVISOR_DISMISSALS_KEY;
}

function getScopedLastDismissedDayKey(): string {
  const uid = getActiveUserId();
  return uid ? getUserStorageKey(SMART_ADVISOR_LAST_DISMISSED_DAY_KEY, uid) : SMART_ADVISOR_LAST_DISMISSED_DAY_KEY;
}

function notifySubscribers() {
  subscribers.forEach((fn) => fn());
}

subscribeActiveUserId(() => {
  loadedScope = null;
  memoryDismissals = {};
  memoryLastDismissedDay = null;
  notifySubscribers();
});

function initStorageIfNeeded() {
  const scope = currentUserScope();
  if (loadedScope === scope) return;
  if (typeof window === "undefined" || !window.localStorage) {
    loadedScope = scope;
    return;
  }
  try {
    const raw = window.localStorage.getItem(getScopedDismissalsKey());
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      const now = Date.now();
      const valid: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "number" && v > now) valid[k] = v;
      }
      memoryDismissals = valid;
    } else {
      memoryDismissals = {};
    }
  } catch {
    memoryDismissals = {};
  }
  try {
    memoryLastDismissedDay = window.localStorage.getItem(getScopedLastDismissedDayKey());
  } catch {
    memoryLastDismissedDay = null;
  }
  loadedScope = scope;
}

const getDismissalsSnapshot = () => {
  initStorageIfNeeded();
  return memoryDismissals;
};
const getLastDismissedDaySnapshot = () => {
  initStorageIfNeeded();
  return memoryLastDismissedDay;
};

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function replaceSmartAdvisorDismissals(next: Record<string, number>) {
  loadedScope = currentUserScope();
  memoryDismissals = next;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(getScopedDismissalsKey(), JSON.stringify(next));
    } catch {
      // Ignora erro
    }
  }
  notifySubscribers();
}

function syncLastDismissedDayFromCloud(cloudDay: string) {
  initStorageIfNeeded();
  if (memoryLastDismissedDay && memoryLastDismissedDay >= cloudDay) {
    return;
  }
  memoryLastDismissedDay = cloudDay;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(getScopedLastDismissedDayKey(), cloudDay);
    } catch {
      // Ignora erro
    }
  }
  notifySubscribers();
}

function pickEffectiveDecayRecord(
  cloudRec: SmartDecayRecord | undefined,
  localRec: SmartDecayRecord | undefined,
): SmartDecayRecord | undefined {
  if (!cloudRec) return localRec;
  if (!localRec) return cloudRec;
  if (
    cloudRec.dismissCount === 0 &&
    cloudRec.dismissedUntil === 0 &&
    cloudRec.muted !== true &&
    cloudRec.lastDismissedAt === localRec.lastDismissedAt
  ) {
    return cloudRec;
  }
  const cloudTs = Date.parse(cloudRec.lastDismissedAt || "");
  const localTs = Date.parse(localRec.lastDismissedAt || "");
  if (Number.isFinite(cloudTs) && Number.isFinite(localTs) && cloudTs !== localTs) {
    return cloudTs > localTs ? cloudRec : localRec;
  }
  return (localRec.dismissedUntil ?? 0) >= (cloudRec.dismissedUntil ?? 0) ? localRec : cloudRec;
}

/**
 * Reseta todos os cooldowns e registros locais de dispensa do SmartAdvisor.
 */
export function resetSmartAdvisorCooldowns() {
  memoryDismissals = {};
  memoryLastDismissedDay = null;
  loadedScope = currentUserScope();
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(getScopedDismissalsKey());
      window.localStorage.removeItem(getScopedLastDismissedDayKey());
    } catch {
      // Ignora erro
    }
  }
  notifySubscribers();
}

/**
 * Revoga um descarte específico sob cooldown ativo pelo themeKey, reintroduzindo
 * o tema correspondente no fluxo de detecção do assistente proativo.
 */
export function revokeSmartAdvisorDismissal(themeKey: string) {
  initStorageIfNeeded();
  const next = { ...memoryDismissals };
  delete next[themeKey];
  replaceSmartAdvisorDismissals(next);
}

function recordCooldownDismissal(keyToDismiss: string | undefined, effectiveDay: string | null, nowMs: number, days: number) {
  initStorageIfNeeded();
  if (effectiveDay) memoryLastDismissedDay = effectiveDay;
  if (keyToDismiss) {
    memoryDismissals = { ...memoryDismissals, [keyToDismiss]: computeDismissCooldownExpiry(nowMs, days) };
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      if (effectiveDay) window.localStorage.setItem(getScopedLastDismissedDayKey(), effectiveDay);
      if (keyToDismiss) window.localStorage.setItem(getScopedDismissalsKey(), JSON.stringify(memoryDismissals));
    } catch {
      // Ignora erro de cota no localStorage
    }
  }
  notifySubscribers();
  return memoryDismissals;
}

/**
 * Gerencia leitura, mesclagem (local/cloud/store) e dispensa com cooldown do SmartAdvisor.
 */
export function useSmartAdvisorCooldownController(params: {
  initialDismissals?: Record<string, number>;
  initialLastDismissedDay?: string;
  cloudDismissals?: Record<string, number>;
  cloudLastDismissedDay?: string | null;
  cloudDecayMeta?: Partial<Record<InsightThemeFamily, SmartDecayRecord>>;
  nowMs: number;
  todayISOStr: string;
  onPersistCloudDismissal: (payload: {
    advisorDismissals?: Record<string, number>;
    advisorLastDismissedDay?: string;
    advisorDecayMeta?: Partial<Record<InsightThemeFamily, SmartDecayRecord>>;
  }) => void;
}) {
  const [localDismissals, setLocalDismissals] = useState(params.initialDismissals);
  const [localLastDismissedDay, setLocalLastDismissedDay] = useState(params.initialLastDismissedDay);
  const [localDecayMeta, setLocalDecayMeta] = useState<
    Partial<Record<InsightThemeFamily, SmartDecayRecord>> | undefined
  >(undefined);
  const storeDismissals = useSyncExternalStore(subscribe, getDismissalsSnapshot, () => ({}));
  const storeLastDismissedDay = useSyncExternalStore(subscribe, getLastDismissedDaySnapshot, () => null);

  const effectiveDismissals = useMemo(
    () =>
      mergeAndFilterValidDismissals(
        storeDismissals,
        params.cloudDismissals,
        params.nowMs,
        localDismissals !== undefined,
        localDismissals,
      ),
    [storeDismissals, params.cloudDismissals, params.nowMs, localDismissals],
  );
  const effectiveLastDismissedDay =
    localLastDismissedDay ?? params.cloudLastDismissedDay ?? storeLastDismissedDay;
  const effectiveDecayMeta = useMemo<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>(() => {
    if (!localDecayMeta && !params.cloudDecayMeta) return {};
    if (!localDecayMeta) return params.cloudDecayMeta ?? {};
    if (!params.cloudDecayMeta) return localDecayMeta;
    const merged: Partial<Record<InsightThemeFamily, SmartDecayRecord>> = {};
    const families = new Set([
      ...Object.keys(params.cloudDecayMeta),
      ...Object.keys(localDecayMeta),
    ]) as Set<InsightThemeFamily>;
    for (const family of families) {
      const chosen = pickEffectiveDecayRecord(params.cloudDecayMeta[family], localDecayMeta[family]);
      if (chosen) merged[family] = chosen;
    }
    return merged;
  }, [localDecayMeta, params.cloudDecayMeta]);

  useEffect(() => {
    if (params.cloudDismissals && Object.keys(params.cloudDismissals).length > 0) {
      const merged = mergeAndFilterValidDismissals(
        getDismissalsSnapshot(),
        params.cloudDismissals,
        params.nowMs,
        false,
      );
      replaceSmartAdvisorDismissals(merged);
    }
  }, [params.cloudDismissals, params.nowMs]);

  useEffect(() => {
    if (params.cloudLastDismissedDay && params.cloudLastDismissedDay.trim().length > 0) {
      syncLastDismissedDayFromCloud(params.cloudLastDismissedDay);
    }
  }, [params.cloudLastDismissedDay]);

  const dismissInsight = useCallback(
    (
      eligibleInsights: readonly SmartAdvisorInsight[],
      activeThemeKey: string | undefined,
      themeKey?: string,
      days = DEFAULT_DISMISS_DAYS,
      options?: { isResolution?: boolean },
    ) => {
      const keyToDismiss = themeKey ?? activeThemeKey;
      const isResolution = options?.isResolution === true;

      if (isResolution) {
        if (localDismissals !== undefined || localLastDismissedDay !== undefined) {
          if (keyToDismiss) {
            const expiry = computeDismissCooldownExpiry(params.nowMs, days);
            setLocalDismissals((prev) => ({ ...(prev ?? {}), [keyToDismiss]: expiry }));
          }
          return;
        }

        const nextMemory = recordCooldownDismissal(keyToDismiss, null, params.nowMs, days);
        if (keyToDismiss) {
          const mergedCloud = mergeAndFilterValidDismissals(
            nextMemory,
            params.cloudDismissals,
            params.nowMs,
            false,
          );
          params.onPersistCloudDismissal({
            advisorDismissals: mergedCloud,
          });
        }
        return;
      }

      const isLastRemaining =
        eligibleInsights.length <= 1 ||
        (keyToDismiss != null && eligibleInsights.length === 1 && eligibleInsights[0]?.themeKey === keyToDismiss);
      const effectiveDay = isLastRemaining ? params.todayISOStr : null;

      if (localDismissals !== undefined || localLastDismissedDay !== undefined) {
        if (effectiveDay) setLocalLastDismissedDay(effectiveDay);
        if (keyToDismiss) {
          const expiry = computeDismissCooldownExpiry(params.nowMs, days);
          setLocalDismissals((prev) => ({ ...(prev ?? {}), [keyToDismiss]: expiry }));
        }
        return;
      }

      const nextMemory = recordCooldownDismissal(keyToDismiss, effectiveDay, params.nowMs, days);
      if (keyToDismiss) {
        const mergedCloud = mergeAndFilterValidDismissals(
          nextMemory,
          params.cloudDismissals,
          params.nowMs,
          false,
        );
        params.onPersistCloudDismissal({
          advisorDismissals: mergedCloud,
          advisorLastDismissedDay: effectiveDay ?? undefined,
        });
      }
    },
    [localDismissals, localLastDismissedDay, params],
  );

  const muteFamily = useCallback(
    (themeKey: string) => {
      const family = resolveInsightThemeFamily(themeKey);
      const nextDecay = {
        ...effectiveDecayMeta,
        [family]: muteInsightFamily(effectiveDecayMeta[family], params.nowMs),
      };
      setLocalDecayMeta(nextDecay);
      params.onPersistCloudDismissal({
        advisorDecayMeta: nextDecay,
      });
    },
    [effectiveDecayMeta, params],
  );

  return { effectiveDismissals, effectiveLastDismissedDay, effectiveDecayMeta, dismissInsight, muteFamily };
}

/**
 * Hook reativo para leitura e gerenciamento de descartes temporários (cooldowns) do assistente.
 * Mescla nuvem (Supabase) + armazenamento local escopado por usuário e propaga revogações.
 */
export function useSmartAdvisorDismissals() {
  const storeDismissals = useSyncExternalStore(subscribe, getDismissalsSnapshot, () => ({}));
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const [nowMs] = useState(() => Date.now());
  const cloudDismissals = userPreferencesQuery?.data?.custom_settings?.advisorDismissals;

  const dismissals = useMemo(
    () => mergeAndFilterValidDismissals(storeDismissals, cloudDismissals, nowMs, false),
    [storeDismissals, cloudDismissals, nowMs],
  );

  const revokeDismissal = useCallback(
    (themeKey: string) => {
      const next = mergeAndFilterValidDismissals(
        getDismissalsSnapshot(),
        cloudDismissals,
        Date.now(),
        false,
      );
      delete next[themeKey];
      replaceSmartAdvisorDismissals(next);
      memoryLastDismissedDay = null;
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.removeItem(getScopedLastDismissedDayKey());
        } catch {
          // Ignora erro
        }
      }
      updateCustomSettingsMutation?.mutate({
        advisorDismissals: { ...next, [themeKey]: 0 },
        advisorLastDismissedDay: null,
      });
    },
    [cloudDismissals, updateCustomSettingsMutation],
  );

  const resetAll = useCallback(() => {
    resetSmartAdvisorCooldowns();
    updateCustomSettingsMutation?.mutate({
      advisorDismissals: {},
      advisorLastDismissedDay: null,
    });
  }, [updateCustomSettingsMutation]);

  return { dismissals, revokeDismissal, resetAll };
}
