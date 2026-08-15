import { useSyncExternalStore } from "react";
import { RotateCcw } from "lucide-react";
import { isLandscapeMobile, subscribeOrientationLock } from "@/services/orientation-lock";

/**
 * Overlay de fallback do bloqueio estrito de orientação (portrait only).
 *
 * O manifest (`orientation: portrait`) e o `screen.orientation.lock` cobrem o
 * PWA instalado e navegadores com suporte à API; para os demais (iOS Safari,
 * Chrome não-instalado), este overlay ocupa a tela em paisagem num dispositivo
 * de toque e pede ao usuário girar o aparelho — impedindo o uso em landscape.
 *
 * Só renderiza quando `isLandscapeMobile()` — fora disso retorna null (sem
 * custo de render). Fica acima de tudo (`z-orientation-lock`).
 */
export function OrientationLockOverlay() {
  const blocked = useSyncExternalStore(subscribeOrientationLock, isLandscapeMobile);
  if (!blocked) return null;

  return (
    <div
      className="fixed inset-0 z-orientation-lock flex flex-col items-center justify-center gap-6 bg-surface px-8 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex size-20 items-center justify-center rounded-full border border-border bg-muted">
        <RotateCcw className="size-10 text-primary" aria-hidden="true" />
      </div>
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="font-display text-xl font-bold text-foreground">Gire o dispositivo</h1>
        <p className="text-sm text-muted-foreground">
          O Guia Financeiro é otimizado para o modo retrato. Gire o aparelho para continuar.
        </p>
      </div>
    </div>
  );
}
