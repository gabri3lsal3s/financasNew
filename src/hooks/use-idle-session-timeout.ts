import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { isNativePlatform } from "@/services/native/platform";
import { pushToast } from "@/services/toast";
import { useDemoSession } from "@/state/demo-mode";

/**
 * Tempo limite seguro padrão de inatividade para sessões Web: 20 minutos (em milissegundos).
 */
export const DEFAULT_IDLE_TIMEOUT_MS = 20 * 60 * 1000;

/**
 * Eventos monitorados para registrar atividade ativa do usuário na interface.
 */
export const IDLE_ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

export interface UseIdleSessionTimeoutOptions {
  /**
   * Tempo limite de inatividade em milissegundos.
   * @default 1200000 (20 minutos)
   */
  timeoutMs?: number;
  /**
   * Força a ativação ou desativação manual do monitoramento.
   * Se omitido, deriva de: usuário logado + ambiente Web + modo demonstração desativado.
   */
  enabled?: boolean;
  /**
   * Callback opcional invocado imediatamente no encerramento da sessão por inatividade.
   */
  onTimeout?: () => void;
}

export interface UseIdleSessionTimeoutResult {
  /** Indica se o monitoramento de inatividade está atualmente ativo. */
  isMonitoringActive: boolean;
  /** Função imperativa para resetar manualmente o contador de inatividade. */
  resetTimer: () => void;
}

/**
 * Hook de governança de segurança contra inatividade em ambiente Web (Idle Session Timeout).
 *
 * Escuta eventos de atividade do usuário (`pointerdown`, `keydown`, `touchstart`, `scroll`)
 * de forma não obstrutiva e passiva (`{ passive: true }`).
 *
 * Se o tempo limite expirar em ambiente Web com usuário logado:
 * - Desconecta suavemente a sessão via `signOut()`.
 * - Exibe notificação discreta: "Sessão encerrada por inatividade para sua proteção."
 *
 * É automaticamente desabilitado em:
 * - Ambiente nativo móvel (onde o AppLock com biometria já cumpre este papel).
 * - Modo de demonstração interativo (`isDemoActive`).
 * - Usuários desautenticados (`session === null`).
 */
export function useIdleSessionTimeout(
  options?: UseIdleSessionTimeoutOptions,
): UseIdleSessionTimeoutResult {
  const { session } = useAuth();
  const { isDemoActive } = useDemoSession();
  const isNative = isNativePlatform();
  const { signOut } = useSignOut();

  const timeoutMs = options?.timeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const onTimeout = options?.onTimeout;

  const hasUser = Boolean(session?.user);
  const isWeb = !isNative;
  const isMonitoringActive =
    (options?.enabled ?? true) && hasUser && isWeb && !isDemoActive;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(0);
  const hasTimedOutRef = useRef<boolean>(false);

  const handleTimeout = useCallback(async () => {
    if (hasTimedOutRef.current) return;
    hasTimedOutRef.current = true;

    pushToast({
      title: "Sessão encerrada por inatividade para sua proteção.",
      variant: "info",
    });

    onTimeout?.();

    try {
      await signOut();
    } catch {
      // no-op em caso de falha de rede
    }
  }, [signOut, onTimeout]);

  const resetTimer = useCallback(() => {
    if (hasTimedOutRef.current) return;
    lastActivityRef.current = Date.now();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void handleTimeout();
    }, timeoutMs);
  }, [handleTimeout, timeoutMs]);

  useEffect(() => {
    if (!isMonitoringActive) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (typeof window === "undefined") return;

    hasTimedOutRef.current = false;
    lastActivityRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      void handleTimeout();
    }, timeoutMs);

    const handleActivity = () => {
      resetTimer();
    };

    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        if (lastActivityRef.current === 0) return;
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= timeoutMs) {
          void handleTimeout();
        } else {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
          timerRef.current = setTimeout(() => {
            void handleTimeout();
          }, timeoutMs - elapsed);
        }
      }
    };

    for (const eventName of IDLE_ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      for (const eventName of IDLE_ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [isMonitoringActive, timeoutMs, resetTimer, handleTimeout]);

  return {
    isMonitoringActive,
    resetTimer,
  };
}
