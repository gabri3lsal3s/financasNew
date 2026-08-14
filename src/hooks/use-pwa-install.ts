import { useSyncExternalStore } from "react";
import { getCanInstallPWA, promptPWAInstall, subscribePWAInstall } from "@/app/pwa";

/**
 * Estado de instalação PWA (beforeinstallprompt) — store externa via
 * useSyncExternalStore (sem setState em effect/render, compatível com o lint
 * React Compiler). Ver docs/PWA_GUIDELINES.md §6.
 */
export function usePWAInstall(): { canInstall: boolean; install: () => Promise<void> } {
  const canInstall = useSyncExternalStore(subscribePWAInstall, getCanInstallPWA, getCanInstallPWA);
  return { canInstall, install: promptPWAInstall };
}
