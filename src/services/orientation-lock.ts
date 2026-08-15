/**
 * Bloqueio de orientação mobile para retrato estrito (portrait only).
 *
 * Combinado com o manifest (`orientation: "portrait"` + `display: "standalone"`):
 * 1. Chamada a `screen.orientation.lock("portrait-primary")` / `lock("portrait")`
 *    na inicialização e no primeiro gesto do usuário (pointerdown/touchstart/click),
 *    satisfazendo a exigência de ativação por interação do usuário de navegadores mobile;
 * 2. Reaplicação contínua em `visibilitychange` (ao voltar para a aba/app),
 *    `fullscreenchange` e mudanças de orientação/redimensionamento.
 * 3. Suporte a prefixos legados de navegadores (`lockOrientation`, `mozLockOrientation`, `msLockOrientation`).
 * 4. Silencioso quando o navegador não suporta ou recusa a chamada.
 */

type LegacyScreen = Screen & {
  orientation?: ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
  };
  lockOrientation?: (orientation: string) => boolean;
  mozLockOrientation?: (orientation: string) => boolean;
  msLockOrientation?: (orientation: string) => boolean;
};

/**
 * Tenta travar a orientação em modo retrato (portrait-primary / portrait).
 * Trata rejeições silenciosamente sem disparar exceções.
 */
export function lockPortrait(): void {
  if (typeof window === "undefined" || typeof screen === "undefined") return;

  const scr = screen as LegacyScreen;

  // W3C Screen Orientation API padrão
  if (scr.orientation && typeof scr.orientation.lock === "function") {
    try {
      const lockPromise = scr.orientation.lock("portrait-primary");
      if (lockPromise && typeof lockPromise.catch === "function") {
        lockPromise.catch(() => {
          // Fallback para portrait genérico se portrait-primary for rejeitado
          try {
            scr.orientation?.lock?.("portrait")?.catch?.(() => {});
          } catch {
            // Silencioso
          }
        });
      }
      return;
    } catch {
      // Fallback para APIs legadas
    }
  }

  // APIs com prefixos legados
  try {
    if (typeof scr.lockOrientation === "function") {
      if (!scr.lockOrientation("portrait-primary")) {
        scr.lockOrientation("portrait");
      }
    } else if (typeof scr.mozLockOrientation === "function") {
      if (!scr.mozLockOrientation("portrait-primary")) {
        scr.mozLockOrientation("portrait");
      }
    } else if (typeof scr.msLockOrientation === "function") {
      if (!scr.msLockOrientation("portrait-primary")) {
        scr.msLockOrientation("portrait");
      }
    }
  } catch {
    // Sem suporte — silencioso
  }
}

/**
 * Inicializa o bloqueio contínuo de orientação em retrato:
 * - Aplica o lock imediatamente no bootstrap;
 * - Reaplica na interação do usuário (pointerdown, touchstart, click);
 * - Reaplica ao retornar ao app (visibilitychange), fullscreen ou redimensionamento.
 */
export function initOrientationLock(): () => void {
  if (typeof window === "undefined") return () => {};

  lockPortrait();

  const handleUserInteraction = () => {
    lockPortrait();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      lockPortrait();
    }
  };

  const handleOrientationChange = () => {
    lockPortrait();
  };

  // Re-tenta lock no primeiro toque/interação (gesto do usuário)
  window.addEventListener("pointerdown", handleUserInteraction, { passive: true });
  window.addEventListener("touchstart", handleUserInteraction, { passive: true });
  window.addEventListener("click", handleUserInteraction, { passive: true });

  // Eventos de ciclo de vida e estado
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("fullscreenchange", handleUserInteraction);
  window.addEventListener("orientationchange", handleOrientationChange);
  window.addEventListener("resize", handleOrientationChange);

  return () => {
    window.removeEventListener("pointerdown", handleUserInteraction);
    window.removeEventListener("touchstart", handleUserInteraction);
    window.removeEventListener("click", handleUserInteraction);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("fullscreenchange", handleUserInteraction);
    window.removeEventListener("orientationchange", handleOrientationChange);
    window.removeEventListener("resize", handleOrientationChange);
  };
}
