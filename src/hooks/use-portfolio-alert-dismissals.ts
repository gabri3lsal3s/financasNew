import { useCallback, useState } from "react";
import { useAuth } from "./use-auth";

export interface PortfolioAlertDismissalEntry {
  dismissedUntil: number;
  fingerprint: string;
}

export type PortfolioAlertDismissalsMap = Record<string, PortfolioAlertDismissalEntry>;

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
 * Gerencia dispensa temporária (snooze) de slides do carrossel de insights de investimentos.
 * Invalida automaticamente a dispensa quando o estado subjacente (fingerprint) muda.
 */
export function usePortfolioAlertDismissals() {
  const auth = useAuth();
  const userId = auth?.user?.id ?? "anon";
  const storageKey = `${STORAGE_KEY_PREFIX}:${userId}`;

  const [dismissals, setDismissals] = useState<PortfolioAlertDismissalsMap>(() =>
    readDismissals(storageKey),
  );

  const dismissAlert = useCallback(
    (alertId: string, durationDays: 7 | 30, fingerprint: string) => {
      const nextEntry: PortfolioAlertDismissalEntry = {
        dismissedUntil: Date.now() + durationDays * MS_PER_DAY,
        fingerprint,
      };
      setDismissals((prev) => {
        const next: PortfolioAlertDismissalsMap = {
          ...prev,
          [alertId]: nextEntry,
        };
        writeDismissals(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const isAlertDismissed = useCallback(
    (alertId: string, currentFingerprint: string): boolean => {
      const entry = dismissals[alertId];
      if (!entry) return false;
      if (Date.now() >= entry.dismissedUntil) return false;
      if (entry.fingerprint !== currentFingerprint) return false;
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
