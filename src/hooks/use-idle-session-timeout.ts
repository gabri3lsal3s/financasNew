import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { isAppLocked, setAppLockIdlePaused } from "@/services/native/app-lock";
import { isNativePlatform } from "@/services/native/platform";
import {
  getEffectiveIdleLogoutPolicy,
  resolveIdlePolicyMs,
  type IdleLogoutPolicy,
} from "@/services/session-policy";
import { pushToast } from "@/services/toast";
import { useDemoSession } from "@/state/demo-mode/demo-session-store";

/**
 * Tempo padrão da janela de aviso prévio antes do encerramento da sessão (60 segundos).
 */
export const DEFAULT_IDLE_WARNING_SECONDS = 60;

/**
 * Intervalo mínimo entre emissões de heartbeat de atividade para outras abas (15s).
 */
export const ACTIVITY_BROADCAST_THROTTLE_MS = 15_000;

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
   * Tempo limite explícito em milissegundos (sobrescreve a política do usuário).
   */
  timeoutMs?: number;
  /**
   * Política forçada (ex.: `"30m"` para o Console Administrativo).
   */
  forcedPolicy?: IdleLogoutPolicy;
  /**
   * Duração do aviso prévio em segundos antes do logout.
   * @default 60
   */
  warningSeconds?: number;
  /**
   * Força a ativação ou desativação manual do monitoramento.
   */
  enabled?: boolean;
  /**
   * Callback opcional invocado imediatamente no encerramento da sessão por inatividade.
   */
  onTimeout?: () => void;
}

export interface UseIdleSessionTimeoutResult {
  /** Indica se o monitoramento de encerramento por inatividade está ativo nesta aba. */
  isMonitoringActive: boolean;
  /** Indica se o modal de aviso prévio deve estar visível. */
  isWarningVisible: boolean;
  /** Segundos restantes na contagem regressiva do aviso prévio. */
  secondsRemaining: number;
  /** Confirma permanência e reseta o contador entre todas as abas. */
  stayConnected: () => void;
  /** Encerra a sessão imediatamente. */
  signOutNow: () => void;
  /** Função imperativa para resetar manualmente o contador de inatividade. */
  resetTimer: () => void;
}

interface IdleSyncMessage {
  type: "activity" | "stay_connected";
  at: number;
  senderId: string;
}

function getSyncChannelName(userId: string): string {
  return `axir_idle_sync_${userId}`;
}

function createTabSenderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tab_${Math.random().toString(36).slice(2, 10)}`;
}

export function getIdleActivityStorageKey(userId: string): string {
  return `axir_idle_last_activity_${userId}`;
}

/**
 * Hook de governança de inatividade Web/PWA e Console Administrativo.
 *
 * - Padrão para usuários comuns: `"never"` (mantém conectado em dispositivos pessoais).
 * - Quando há usuário autenticado (fora do Modo Demo), mantém emissor leve de atividade
 *   multi-aba ativo (`BroadcastChannel` + fallback `localStorage`) mesmo no modo `"never"`,
 *   mantendo vivas abas do Console Admin (`/admin/*`) abertas em paralelo.
 * - Quando política efetiva != `"never"` (opt-in, "Computador compartilhado" ou Admin):
 *   exibe aviso prévio de 60s baseado em timestamps (`deadlineAt - Date.now()`), respeita
 *   precedência absoluta do `AppLockOverlay` e sincroniza entre abas.
 */
export function useIdleSessionTimeout(
  options?: UseIdleSessionTimeoutOptions,
): UseIdleSessionTimeoutResult {
  const { session, user } = useAuth();
  const { isDemoActive } = useDemoSession();
  const isNative = isNativePlatform();
  const { signOut } = useSignOut();

  const userId = user?.id ?? session?.user?.id ?? null;
  const hasUser = Boolean(userId);
  const isWeb = !isNative;
  const isEligibleUser = (options?.enabled ?? true) && hasUser && !isDemoActive;

  const effectivePolicy =
    options?.forcedPolicy ??
    (userId ? getEffectiveIdleLogoutPolicy(userId) : "never");

  const resolvedPolicyMs =
    options?.timeoutMs !== undefined
      ? options.timeoutMs
      : resolveIdlePolicyMs(effectivePolicy);

  const isMonitoringActive =
    isEligibleUser &&
    (isWeb || options?.forcedPolicy !== undefined) &&
    resolvedPolicyMs !== null &&
    resolvedPolicyMs > 0;

  const warningSeconds = options?.warningSeconds ?? DEFAULT_IDLE_WARNING_SECONDS;
  const warningMs =
    resolvedPolicyMs !== null
      ? Math.min(warningSeconds * 1000, resolvedPolicyMs)
      : warningSeconds * 1000;

  const onTimeout = options?.onTimeout;

  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningSeconds);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(0);
  const lastBroadcastAtRef = useRef<number>(0);
  const hasTimedOutRef = useRef<boolean>(false);
  const isWarningVisibleRef = useRef<boolean>(false);
  const [senderId] = useState(createTabSenderId);
  const senderIdRef = useRef<string>(senderId);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const evaluateDeadlineRef = useRef<(nowMs?: number) => void>(() => {});

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const hideWarning = useCallback(() => {
    if (isWarningVisibleRef.current) {
      isWarningVisibleRef.current = false;
      setIsWarningVisible(false);
      setAppLockIdlePaused(false);
    }
  }, []);

  const broadcastActivity = useCallback(
    (type: "activity" | "stay_connected", at: number, force = false) => {
      if (!userId) return;
      if (!force && at - lastBroadcastAtRef.current < ACTIVITY_BROADCAST_THROTTLE_MS) {
        return;
      }
      lastBroadcastAtRef.current = at;

      const msg: IdleSyncMessage = {
        type,
        at,
        senderId: senderIdRef.current,
      };

      try {
        channelRef.current?.postMessage(msg);
      } catch {
        // no-op
      }

      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem(
            getIdleActivityStorageKey(userId),
            JSON.stringify({ at, type, senderId: senderIdRef.current }),
          );
        } catch {
          // no-op
        }
      }
    },
    [userId],
  );

  const handleTimeout = useCallback(async () => {
    if (hasTimedOutRef.current) return;
    hasTimedOutRef.current = true;
    clearTimers();
    hideWarning();

    pushToast({
      title: "Sessão encerrada por inatividade para sua proteção.",
      variant: "info",
    });

    onTimeout?.();

    try {
      await signOut({ scope: "local" });
    } catch {
      // no-op em caso de falha de rede
    }
  }, [clearTimers, hideWarning, onTimeout, signOut]);

  const evaluateDeadline = useCallback(
    (nowMs = Date.now()) => {
      if (!isMonitoringActive || resolvedPolicyMs === null || hasTimedOutRef.current) {
        return;
      }

      clearTimers();

      if (lastActivityRef.current <= 0) {
        lastActivityRef.current = nowMs;
      }

      const deadlineAt = lastActivityRef.current + resolvedPolicyMs;
      const warningAt = deadlineAt - warningMs;

      if (nowMs >= deadlineAt) {
        void handleTimeout();
        return;
      }

      if (nowMs >= warningAt) {
        const remainingSec = Math.max(1, Math.ceil((deadlineAt - nowMs) / 1000));

        // Precedência absoluta: se o AppLock já estiver cobrindo a tela, não exibe modal
        // e aguarda o deadline para encerrar silenciosamente caso siga sem interação.
        if (isAppLocked()) {
          hideWarning();
          timerRef.current = setTimeout(() => {
            evaluateDeadlineRef.current(Date.now());
          }, Math.max(0, deadlineAt - Date.now()));
          return;
        }

        if (!isWarningVisibleRef.current) {
          isWarningVisibleRef.current = true;
          setIsWarningVisible(true);
          setAppLockIdlePaused(true);
        }
        setSecondsRemaining(remainingSec);

        countdownIntervalRef.current = setInterval(() => {
          const currentNow = Date.now();
          const leftMs = deadlineAt - currentNow;
          if (leftMs <= 0) {
            void handleTimeout();
          } else if (isAppLocked()) {
            hideWarning();
          } else {
            setSecondsRemaining(Math.max(1, Math.ceil(leftMs / 1000)));
          }
        }, 500);

        timerRef.current = setTimeout(() => {
          evaluateDeadlineRef.current(Date.now());
        }, Math.max(0, deadlineAt - nowMs));
        return;
      }

      hideWarning();
      timerRef.current = setTimeout(() => {
        evaluateDeadlineRef.current(Date.now());
      }, Math.max(0, warningAt - nowMs));
    },
    [
      clearTimers,
      handleTimeout,
      hideWarning,
      isMonitoringActive,
      resolvedPolicyMs,
      warningMs,
    ],
  );

  useEffect(() => {
    evaluateDeadlineRef.current = evaluateDeadline;
  }, [evaluateDeadline]);

  const resetTimer = useCallback(() => {
    if (hasTimedOutRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    broadcastActivity("activity", now, false);
    if (isMonitoringActive) {
      evaluateDeadline(now);
    }
  }, [broadcastActivity, evaluateDeadline, isMonitoringActive]);

  const stayConnected = useCallback(() => {
    if (hasTimedOutRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    hideWarning();
    broadcastActivity("stay_connected", now, true);
    if (isMonitoringActive) {
      evaluateDeadline(now);
    }
  }, [broadcastActivity, evaluateDeadline, hideWarning, isMonitoringActive]);

  const signOutNow = useCallback(() => {
    if (hasTimedOutRef.current) return;
    hasTimedOutRef.current = true;
    clearTimers();
    hideWarning();
    void signOut({ scope: "local" }).catch(() => {});
  }, [clearTimers, hideWarning, signOut]);

  // Canal multi-aba (emissor sempre ativo para usuário autenticado + receptor quando monitorando)
  useEffect(() => {
    if (!isEligibleUser || !userId || typeof window === "undefined") {
      return;
    }

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel(getSyncChannelName(userId));
        channelRef.current = bc;
      } catch {
        bc = null;
      }
    }

    const applyRemoteActivity = (at: number, type: "activity" | "stay_connected") => {
      if (at > lastActivityRef.current) {
        lastActivityRef.current = at;
        if (type === "stay_connected" || isWarningVisibleRef.current) {
          hideWarning();
        }
        if (isMonitoringActive) {
          evaluateDeadline(Date.now());
        }
      }
    };

    if (bc) {
      bc.onmessage = (event: MessageEvent<IdleSyncMessage>) => {
        const data = event.data;
        if (!data || data.senderId === senderIdRef.current) return;
        if (typeof data.at === "number" && Number.isFinite(data.at)) {
          applyRemoteActivity(data.at, data.type);
        }
      };
    }

    const storageKey = getIdleActivityStorageKey(userId);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<IdleSyncMessage>;
        if (
          parsed.senderId !== senderIdRef.current &&
          typeof parsed.at === "number" &&
          Number.isFinite(parsed.at)
        ) {
          applyRemoteActivity(parsed.at, parsed.type ?? "activity");
        }
      } catch {
        // no-op
      }
    };

    window.addEventListener("storage", handleStorage);

    // Emite atividade inicial ao montar aba
    const initNow = Date.now();
    lastActivityRef.current = initNow;
    broadcastActivity("activity", initNow, true);

    const handleUserActivity = () => {
      // Enquanto o modal de aviso estiver aberto, só o clique em "Continuar conectado" reseta
      if (isWarningVisibleRef.current) return;
      const now = Date.now();
      lastActivityRef.current = now;
      broadcastActivity("activity", now, false);
      if (isMonitoringActive) {
        evaluateDeadline(now);
      }
    };

    for (const eventName of IDLE_ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      for (const eventName of IDLE_ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleUserActivity);
      }
      if (bc) {
        bc.close();
        if (channelRef.current === bc) {
          channelRef.current = null;
        }
      }
    };
  }, [
    isEligibleUser,
    userId,
    isMonitoringActive,
    broadcastActivity,
    evaluateDeadline,
    hideWarning,
  ]);

  // Monitoramento de deadline e recálculo em retorno de segundo plano/foco
  useEffect(() => {
    if (!isMonitoringActive) {
      clearTimers();
      hideWarning();
      return;
    }

    if (typeof window === "undefined") return;

    hasTimedOutRef.current = false;
    if (lastActivityRef.current <= 0) {
      lastActivityRef.current = Date.now();
    }
    evaluateDeadline(Date.now());

    const handleRecalculate = () => {
      evaluateDeadline(Date.now());
    };

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        evaluateDeadline(Date.now());
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    window.addEventListener("focus", handleRecalculate);

    let appStateHandle: { remove: () => Promise<void> } | null = null;
    if (isNative) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          evaluateDeadline(Date.now());
        }
      }).then((handle) => {
        appStateHandle = handle;
      });
    }

    return () => {
      clearTimers();
      hideWarning();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      window.removeEventListener("focus", handleRecalculate);
      void appStateHandle?.remove?.();
    };
  }, [isMonitoringActive, isNative, clearTimers, evaluateDeadline, hideWarning]);

  return {
    isMonitoringActive,
    isWarningVisible,
    secondsRemaining,
    stayConnected,
    signOutNow,
    resetTimer,
  };
}
