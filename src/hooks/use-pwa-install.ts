import { useSyncExternalStore } from "react";
import {
  getPWAInstallSnapshot,
  promptPWAInstall,
  subscribePWAInstall,
  type PWAInstallSnapshot,
} from "@/app/pwa";

export interface UsePWAInstallReturn extends PWAInstallSnapshot {
  install: () => Promise<void>;
}

/**
 * Estado de instalação PWA (beforeinstallprompt ou iOS Safari) — store externa via
 * useSyncExternalStore (sem setState em effect/render, compatível com o lint
 * React Compiler). Ver docs/PWA_GUIDELINES.md §6.
 */
export function usePWAInstall(): UsePWAInstallReturn {
  const snapshot = useSyncExternalStore(
    subscribePWAInstall,
    getPWAInstallSnapshot,
    getPWAInstallSnapshot,
  );

  return {
    ...snapshot,
    install: promptPWAInstall,
  };
}
