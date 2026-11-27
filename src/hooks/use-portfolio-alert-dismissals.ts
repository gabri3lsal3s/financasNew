import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveUserId, getUserStorageKey, subscribeActiveUserId } from "@/services/user-storage";
import { useUpdateCustomSettings } from "@/state/mutations/use-preference-mutations";
import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { isQueryPending } from "@/state/query-readiness";
import type { PortfolioAlertDismissalEntry, PortfolioAlertDismissalsMap } from "@/types";

export type { PortfolioAlertDismissalEntry, PortfolioAlertDismissalsMap };

const STORAGE_KEY_PREFIX = "axir_portfolio_alert_dismissals";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function readDismissals(storageKey: string | null): PortfolioAlertDismissalsMap {
  if (!storageKey || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PortfolioAlertDismissalsMap;
  } catch {
    return {};
  }
}

function writeDismissals(storageKey: string | null, map: PortfolioAlertDismissalsMap): void {
  if (!storageKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // Ignora falha de cota ou modo privado
  }
}

function mergePortfolioDismissalsByLatestAction(
  cloud?: PortfolioAlertDismissalsMap,
  local?: PortfolioAlertDismissalsMap,
): PortfolioAlertDismissalsMap {
  const merged: PortfolioAlertDismissalsMap = {};
  for (const key of new Set([...Object.keys(cloud ?? {}), ...Object.keys(local ?? {})])) {
    const c = cloud?.[key];
    const l = local?.[key];
    if (c && l) {
      const cTs = c.dismissedAt ? Date.parse(c.dismissedAt) : NaN;
      const lTs = l.dismissedAt ? Date.parse(l.dismissedAt) : NaN;
      if (Number.isFinite(cTs) && Number.isFinite(lTs) && cTs !== lTs) {
        merged[key] = lTs > cTs ? l : c;
      } else {
        merged[key] = l.dismissedUntil >= c.dismissedUntil ? l : c;
      }
    } else if (l ?? c) {
      merged[key] = (l ?? c)!;
    }
  }
  return merged;
}

/**
 * Gerencia dispensa temporária (7 ou 30 dias) de slides do carrossel de insights de investimentos.
 * Garante que os cards dispensados permaneçam silenciados até o término do período escolhido,
 * com sincronização multi-dispositivo na nuvem (Supabase) e cache local escopado por usuário.
 */
export function usePortfolioAlertDismissals() {
  const [activeUid, setActiveUid] = useState<string | null>(() => getActiveUserId());
  useEffect(() => subscribeActiveUserId(setActiveUid), []);
  const storageKey = activeUid ? getUserStorageKey(STORAGE_KEY_PREFIX, activeUid) : null;

  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const [localState, setLocalState] = useState<{
    key: string | null;
    map: PortfolioAlertDismissalsMap;
  }>(() => ({
    key: storageKey,
    map: readDismissals(storageKey),
  }));

  const effectiveLocalDismissals = useMemo(
    () => (localState.key === storageKey ? localState.map : readDismissals(storageKey)),
    [localState, storageKey],
  );

  const cloudDismissals = userPreferencesQuery.data?.custom_settings?.portfolioAlertDismissals;

  useEffect(() => {
    if (cloudDismissals && storageKey) {
      const merged = mergePortfolioDismissalsByLatestAction(
        cloudDismissals,
        readDismissals(storageKey),
      );
      writeDismissals(storageKey, merged);
    }
  }, [cloudDismissals, storageKey]);

  const dismissals = useMemo<PortfolioAlertDismissalsMap>(() => {
    return mergePortfolioDismissalsByLatestAction(cloudDismissals, effectiveLocalDismissals);
  }, [cloudDismissals, effectiveLocalDismissals]);

  const dismissAlert = useCallback(
    (alertId: string, durationDays: 7 | 30, fingerprint?: string) => {
      if (!activeUid || !storageKey) return;
      const now = Date.now();
      const nextEntry: PortfolioAlertDismissalEntry = {
        dismissedUntil: now + durationDays * MS_PER_DAY,
        dismissedAt: new Date(now).toISOString(),
        fingerprint,
      };

      const prevMap = localState.key === storageKey ? localState.map : readDismissals(storageKey);
      const next: PortfolioAlertDismissalsMap = {
        ...mergePortfolioDismissalsByLatestAction(cloudDismissals, prevMap),
        [alertId]: nextEntry,
      };
      writeDismissals(storageKey, next);
      setLocalState({ key: storageKey, map: next });
      updateCustomSettingsMutation.mutate({
        portfolioAlertDismissals: next,
      });
    },
    [activeUid, cloudDismissals, localState, storageKey, updateCustomSettingsMutation],
  );

  const isAlertDismissed = useCallback(
    (alertId: string, currentFingerprint?: string): boolean => {
      void currentFingerprint;
      const entry = dismissals[alertId];
      if (!entry) return false;
      // Garante rigorosamente que o alerta espera os 7 ou 30 dias para reaparecer
      if (Date.now() >= entry.dismissedUntil) return false;
      return true;
    },
    [dismissals],
  );

  return {
    dismissals,
    dismissAlert,
    isAlertDismissed,
    isLoading: isQueryPending(userPreferencesQuery),
  };
}
