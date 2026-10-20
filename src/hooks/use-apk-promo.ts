import { useSyncExternalStore, useCallback } from "react";
import { isNativePlatform, isAndroidDevice } from "@/services/native/platform";
import {
  shouldShowApkPromo,
  computeDismissUntilTimestamp,
  APK_PROMO_STORAGE_KEY,
  APK_PROMO_DISMISS_DAYS,
} from "@/domain/native";

function getSnapshot(): boolean {
  try {
    const stored = localStorage.getItem(APK_PROMO_STORAGE_KEY);
    const dismissedUntil = stored ? Number(stored) : null;
    const isNative = isNativePlatform();
    const isAndroid = isAndroidDevice();

    return shouldShowApkPromo({
      isNative,
      isAndroid,
      dismissedUntil,
    });
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notify() {
  listeners.forEach((l) => l());
}

export function useApkPromo() {
  const showPromo = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const dismiss = useCallback((days = APK_PROMO_DISMISS_DAYS) => {
    try {
      const until = computeDismissUntilTimestamp(days);
      localStorage.setItem(APK_PROMO_STORAGE_KEY, String(until));
    } catch {
      // Ignora erro de quota em localStorage
    }
    notify();
  }, []);

  return {
    showPromo,
    dismiss,
  };
}

