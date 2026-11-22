import { useCallback, useMemo, useState } from "react";
import { useAuth } from "./use-auth";
import { useUpdateCustomSettings, useUserPreferences } from "@/state";
import type { PortfolioAlertDismissalEntry, PortfolioAlertDismissalsMap } from "@/types";

export type { PortfolioAlertDismissalEntry, PortfolioAlertDismissalsMap };

const STORAGE_KEY_PREFIX = "axir_portfolio_alert_dismissals";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function readDismissals(storageKey: string): PortfolioAlertDismissalsMap {
  if (typeof window === "undefined") return {};
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

function writeDismissals(storageKey: string, map: PortfolioAlertDismissalsMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // Ignora falha de cota ou modo privado
  }
}

/**
 * Gerencia dispensa temporária (7 ou 30 dias) de slides do carrossel de insights de investimentos.
 * Garante que os cards dispensados permaneçam silenciados até o término do período escolhido,
 * com sincronização multi-dispositivo na nuvem (Supabase) e cache local.
 */
export function usePortfolioAlertDismissals() {
  const auth = useAuth();
  const userId = auth?.user?.id ?? "anon";
  const storageKey = `${STORAGE_KEY_PREFIX}:${userId}`;

  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const [localDismissals, setLocalDismissals] = useState<PortfolioAlertDismissalsMap>(() =>
    readDismissals(storageKey),
  );

  const cloudDismissals = userPreferencesQuery.data?.custom_settings?.portfolioAlertDismissals;

  const dismissals = useMemo<PortfolioAlertDismissalsMap>(() => {
    return {
      ...(cloudDismissals ?? {}),
      ...(localDismissals ?? {}),
    };
  }, [cloudDismissals, localDismissals]);

  const dismissAlert = useCallback(
    (alertId: string, durationDays: 7 | 30, fingerprint?: string) => {
      const now = Date.now();
      const nextEntry: PortfolioAlertDismissalEntry = {
        dismissedUntil: now + durationDays * MS_PER_DAY,
        dismissedAt: new Date(now).toISOString(),
        fingerprint,
      };

      setLocalDismissals((prev) => {
        const next: PortfolioAlertDismissalsMap = {
          ...(cloudDismissals ?? {}),
          ...prev,
          [alertId]: nextEntry,
        };
        writeDismissals(storageKey, next);
        updateCustomSettingsMutation.mutate({
          portfolioAlertDismissals: next,
        });
        return next;
      });
    },
    [cloudDismissals, storageKey, updateCustomSettingsMutation],
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
  };
}
