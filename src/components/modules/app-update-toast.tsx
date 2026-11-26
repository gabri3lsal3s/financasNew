import { lazy, Suspense, useLayoutEffect, useSyncExternalStore } from "react";
import { isNativePlatform } from "@/services/native/platform";
import { getIsPWAUpdating, getPWAUpdateAvailable, subscribePWAUpdate } from "@/app/pwa";

const NativeUpdateToast = lazy(() =>
  import("./native-update-toast").then((m) => ({ default: m.NativeUpdateToast })),
);
const PWAUpdateToast = lazy(() =>
  import("./pwa-update-toast").then((m) => ({ default: m.PWAUpdateToast })),
);

function hasPWAUpdate(): boolean {
  return getPWAUpdateAvailable() || getIsPWAUpdating();
}

const UNIFIED_HOST_EVENT = "axir:update-toast-host-change";

/**
 * Toast unificado de atualização do aplicativo (`AppUpdateToast`).
 *
 * Seleciona automaticamente o fluxo adequado à plataforma:
 * - Nativo (`Capacitor.isNativePlatform()`): manifesto remoto + download/instalação Android;
 * - Web / PWA: ciclo `autoUpdate` do Service Worker.
 *
 * Em ambas as plataformas:
 * - Respeita `useActiveOverlays()` (suprime durante modais, wizards e tour guiado);
 * - Respeita a janela de supressão de 12 horas e sessão (`update-toast-policy`);
 * - Coordena o registro global para impedir duplicidade caso `NativeUpdateToast` esteja montado.
 */
export function AppUpdateToast() {
  const isNative = isNativePlatform();
  const hasUpdate = useSyncExternalStore(subscribePWAUpdate, hasPWAUpdate, () => false);

  useLayoutEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const root = document.documentElement;
    const prev = Number(root.dataset.appUpdateToastCount ?? "0") || 0;
    root.dataset.appUpdateToastCount = String(prev + 1);
    window.dispatchEvent(new Event(UNIFIED_HOST_EVENT));

    return () => {
      const current = Number(root.dataset.appUpdateToastCount ?? "1") || 1;
      const next = Math.max(0, current - 1);
      if (next === 0) {
        delete root.dataset.appUpdateToastCount;
      } else {
        root.dataset.appUpdateToastCount = String(next);
      }
      window.dispatchEvent(new Event(UNIFIED_HOST_EVENT));
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {isNative
        ? <NativeUpdateToast bypassUnifiedGuard />
        : hasUpdate && <PWAUpdateToast persistDismissal />}
    </Suspense>
  );
}
