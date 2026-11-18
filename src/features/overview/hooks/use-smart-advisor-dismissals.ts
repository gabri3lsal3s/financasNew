import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_DISMISS_DAYS,
  SMART_ADVISOR_DISMISSALS_KEY,
  SMART_ADVISOR_LAST_DISMISSED_DAY_KEY,
  type SmartAdvisorInsight,
} from "@/domain/insights/advisor";
import {
  computeDismissCooldownExpiry,
  mergeAndFilterValidDismissals,
} from "@/domain/insights/smart-advisor-rules";

let memoryDismissals: Record<string, number> = {};
let memoryLastDismissedDay: string | null = null;
let storageInitialized = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((fn) => fn());
}

function initStorageIfNeeded() {
  if (storageInitialized) return;
  if (typeof window === "undefined" || !window.localStorage) {
    storageInitialized = true;
    return;
  }
  try {
    const raw = window.localStorage.getItem(SMART_ADVISOR_DISMISSALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      const now = Date.now();
      const valid: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "number" && v > now) valid[k] = v;
      }
      memoryDismissals = valid;
    }
  } catch {
    memoryDismissals = {};
  }
  try {
    memoryLastDismissedDay = window.localStorage.getItem(SMART_ADVISOR_LAST_DISMISSED_DAY_KEY);
  } catch {
    memoryLastDismissedDay = null;
  }
  storageInitialized = true;
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

/**
 * Reseta todos os cooldowns e registros locais de dispensa do SmartAdvisor.
 */
export function resetSmartAdvisorCooldowns() {
  memoryDismissals = {};
  memoryLastDismissedDay = null;
  storageInitialized = true;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(SMART_ADVISOR_DISMISSALS_KEY);
      window.localStorage.removeItem(SMART_ADVISOR_LAST_DISMISSED_DAY_KEY);
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
  memoryDismissals = next;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(SMART_ADVISOR_DISMISSALS_KEY, JSON.stringify(next));
    } catch {
      // Ignora erro
    }
  }
  notifySubscribers();
}

function recordCooldownDismissal(keyToDismiss: string | undefined, effectiveDay: string | null, nowMs: number, days: number) {
  initStorageIfNeeded();
  if (effectiveDay) memoryLastDismissedDay = effectiveDay;
  if (keyToDismiss) {
    memoryDismissals = { ...memoryDismissals, [keyToDismiss]: computeDismissCooldownExpiry(nowMs, days) };
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      if (effectiveDay) window.localStorage.setItem(SMART_ADVISOR_LAST_DISMISSED_DAY_KEY, effectiveDay);
      if (keyToDismiss) window.localStorage.setItem(SMART_ADVISOR_DISMISSALS_KEY, JSON.stringify(memoryDismissals));
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
  nowMs: number;
  todayISOStr: string;
  onPersistCloudDismissal: (payload: { advisorDismissals: Record<string, number>; advisorLastDismissedDay?: string }) => void;
}) {
  const [localDismissals, setLocalDismissals] = useState(params.initialDismissals);
  const [localLastDismissedDay, setLocalLastDismissedDay] = useState(params.initialLastDismissedDay);
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

  const dismissInsight = useCallback(
    (
      eligibleInsights: readonly SmartAdvisorInsight[],
      activeThemeKey: string | undefined,
      themeKey?: string,
      days = DEFAULT_DISMISS_DAYS,
    ) => {
      const keyToDismiss = themeKey ?? activeThemeKey;
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
        params.onPersistCloudDismissal({
          advisorDismissals: { ...(params.cloudDismissals ?? {}), ...nextMemory },
          advisorLastDismissedDay: effectiveDay ?? undefined,
        });
      }
    },
    [localDismissals, localLastDismissedDay, params],
  );

  return { effectiveDismissals, effectiveLastDismissedDay, dismissInsight };
}

/**
 * Hook reativo para leitura e gerenciamento de descartes temporários (cooldowns) do assistente.
 */
export function useSmartAdvisorDismissals() {
  const dismissals = useSyncExternalStore(subscribe, getDismissalsSnapshot, () => ({}));
  const revokeDismissal = useCallback((themeKey: string) => revokeSmartAdvisorDismissal(themeKey), []);
  const resetAll = useCallback(() => resetSmartAdvisorCooldowns(), []);
  return { dismissals, revokeDismissal, resetAll };
}
