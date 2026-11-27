import { useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { QueryClientContext, type QueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/data/client";
import { checkDeviceRevoked, registerDevice } from "@/data/repositories/devices";
import { isSessionTransportError, postSessionOperation } from "@/data/session-transport";
import { SESSION_POLICY } from "@/domain/auth/session-policy";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { resetAppState } from "@/services/auth-cleanup";
import { reportError } from "@/services/observability";
import {
  clearDeviceSessionSync,
  consumePendingExplicitDeviceRegistration,
  getDeviceInfo,
  getOrCreateDeviceId,
  markDeviceSessionSynced,
  rotateDeviceId,
  shouldSyncDeviceSession,
} from "@/services/native/device-info";
import {
  clearSessionContext,
  getSessionContext,
  registerBfCacheRevalidation,
  subscribeSessionContext,
} from "@/services/session-context";
import { pushToast } from "@/services/toast";
import type { PublicSessionContext } from "@/types/session-custody";

const REVALIDATE_THROTTLE_MS = 10_000;

interface RealtimeChannelLike {
  on: (
    type: string,
    filter: Record<string, unknown>,
    callback: (payload: { new?: Record<string, unknown> }) => void,
  ) => RealtimeChannelLike;
  subscribe: (callback?: (status: string) => void) => RealtimeChannelLike;
}

let activeRefCount = 0;
let activeSyncUserId: string | null = null;
let activeDeviceId: string | null = null;
let activeChannel: RealtimeChannelLike | null = null;
let activeListenersCleanup: (() => void) | null = null;
let inFlightSyncPromise: Promise<void> | null = null;
let inFlightBffRevalidatePromise: Promise<void> | null = null;
let isHandlingRemoteRevocation = false;
let lastRevalidateAt = 0;
let hasInitialSubscribed = false;

export interface UseDeviceSessionSyncOptions {
  onRevoked?: () => void;
}

/**
 * Reseta o estado singleton em memória (exclusivo para isolamento de testes).
 */
export function resetDeviceSessionSyncForTests(): void {
  if (activeChannel) {
    try {
      const supabase = getSupabase();
      if (typeof supabase.removeChannel === "function") {
        void supabase.removeChannel(activeChannel as never);
      }
    } catch {
      // no-op
    }
  }
  activeListenersCleanup?.();
  activeRefCount = 0;
  activeSyncUserId = null;
  activeDeviceId = null;
  activeChannel = null;
  activeListenersCleanup = null;
  inFlightSyncPromise = null;
  inFlightBffRevalidatePromise = null;
  isHandlingRemoteRevocation = false;
  lastRevalidateAt = 0;
  hasInitialSubscribed = false;
}

async function handleRemoteRevocation(
  signOut: (options?: { scope?: "global" | "local" | "others" }) => Promise<void>,
): Promise<void> {
  if (isHandlingRemoteRevocation) return;
  isHandlingRemoteRevocation = true;

  try {
    rotateDeviceId();
    clearDeviceSessionSync();
    pushToast({
      title: "Sessão encerrada",
      description: "Esta sessão foi encerrada remotamente por outro dispositivo.",
      variant: "info",
    });
    await signOut({ scope: "local" }).catch(() => {});
  } catch {
    // Tolera falhas residuais pós-revogação (ex.: 401/403)
  } finally {
    isHandlingRemoteRevocation = false;
  }
}

async function runSyncCycle(
  deviceId: string,
  signOut: (options?: { scope?: "global" | "local" | "others" }) => Promise<void>,
  options?: { isRevalidation?: boolean },
): Promise<void> {
  if (isHandlingRemoteRevocation) return;
  if (inFlightSyncPromise) return inFlightSyncPromise;

  const task = (async () => {
    const isExplicitLogin = consumePendingExplicitDeviceRegistration();

    if (isExplicitLogin) {
      const info = getDeviceInfo();
      await registerDevice({ ...info, deviceId });
      markDeviceSessionSynced();
      lastRevalidateAt = Date.now();
      return;
    }

    if (options?.isRevalidation) {
      const now = Date.now();
      if (now - lastRevalidateAt < REVALIDATE_THROTTLE_MS) {
        return;
      }
      lastRevalidateAt = now;
    } else {
      lastRevalidateAt = Date.now();
    }

    const isRevoked = await checkDeviceRevoked(deviceId);
    if (isRevoked) {
      await handleRemoteRevocation(signOut);
      return;
    }

    if (shouldSyncDeviceSession()) {
      const info = getDeviceInfo();
      await registerDevice({ ...info, deviceId });
      markDeviceSessionSynced();
    }
  })();

  inFlightSyncPromise = task;
  try {
    await task;
  } finally {
    if (inFlightSyncPromise === task) {
      inFlightSyncPromise = null;
    }
  }
}

function teardownSingleton(): void {
  if (activeChannel) {
    try {
      const supabase = getSupabase();
      if (typeof supabase.removeChannel === "function") {
        void supabase.removeChannel(activeChannel as never);
      }
    } catch {
      // no-op em ambiente offline/mock
    }
    activeChannel = null;
  }
  if (activeListenersCleanup) {
    activeListenersCleanup();
    activeListenersCleanup = null;
  }
  activeSyncUserId = null;
  activeDeviceId = null;
  hasInitialSubscribed = false;
  isHandlingRemoteRevocation = false;
}

function isUnauthorizedError(error: unknown): boolean {
  if (isSessionTransportError(error)) {
    return error.status === 401;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 401
  );
}

function handleBffRevocation(
  queryClient: QueryClient | undefined,
  onRevoked?: () => void,
): void {
  clearDeviceSessionSync();
  resetAppState(queryClient, null);
  clearSessionContext("revoked");
  onRevoked?.();
}

async function revalidateBffSession(
  queryClient: QueryClient | undefined,
  onRevoked?: () => void,
): Promise<void> {
  if (!getSessionContext().contextId) return;
  if (inFlightBffRevalidatePromise) return inFlightBffRevalidatePromise;

  const task = (async () => {
    try {
      const result = await postSessionOperation<PublicSessionContext>("revalidate", {});
      if (result?.status === "revoked" || result?.status === "expired") {
        handleBffRevocation(queryClient, onRevoked);
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleBffRevocation(queryClient, onRevoked);
        return;
      }
      void reportError(error, { source: "useDeviceSessionSync_bff_revalidate" });
    }
  })();

  inFlightBffRevalidatePromise = task;
  try {
    await task;
  } finally {
    if (inFlightBffRevalidatePromise === task) {
      inFlightBffRevalidatePromise = null;
    }
  }
}

/**
 * Orquestrador global (singleton ref-counted) de ciclo de vida de dispositivos e revogação em tempo real.
 * Deve ser montado uma única vez no shell autenticado (`RequireAuth`).
 */
export function useDeviceSessionSync(options?: UseDeviceSessionSyncOptions): void {
  const queryClient = useContext(QueryClientContext);
  const { user, loading: authLoading, mfaRequired, mfaVerified } = useAuth();
  const { signOut } = useSignOut();
  const signOutRef = useRef(signOut);
  const onRevokedRef = useRef(options?.onRevoked);
  const deviceIdRef = useRef<string | null>(null);
  const sessionContextId = useSyncExternalStore(
    subscribeSessionContext,
    () => getSessionContext().contextId,
    () => null,
  );

  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  useEffect(() => {
    onRevokedRef.current = options?.onRevoked;
  }, [options?.onRevoked]);

  useEffect(() => {
    if (!sessionContextId) {
      return;
    }

    const triggerRevalidate = () => {
      void revalidateBffSession(queryClient ?? undefined, () => onRevokedRef.current?.());
    };

    const unregisterBfCache = registerBfCacheRevalidation(triggerRevalidate);
    const intervalId = globalThis.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      triggerRevalidate();
    }, SESSION_POLICY.REVALIDATION_POLL_MS);

    return () => {
      unregisterBfCache();
      globalThis.clearInterval(intervalId);
    };
  }, [sessionContextId, queryClient]);

  const userId = user?.id ?? null;
  const isMfaPending = Boolean(mfaRequired && !mfaVerified);
  const isEligible = !authLoading && Boolean(userId) && !isMfaPending;

  useEffect(() => {
    if (!userId && !authLoading) {
      isHandlingRemoteRevocation = false;
      clearDeviceSessionSync();
    }
  }, [userId, authLoading]);

  useEffect(() => {
    if (!isEligible || !userId) {
      return;
    }

    const currentDeviceId = getOrCreateDeviceId();
    deviceIdRef.current = currentDeviceId;

    if (activeSyncUserId && activeSyncUserId !== userId) {
      teardownSingleton();
      activeRefCount = 0;
    }

    activeRefCount += 1;
    const isFirstSubscriber = activeRefCount === 1 || activeSyncUserId !== userId;

    if (isFirstSubscriber) {
      activeSyncUserId = userId;
      activeDeviceId = currentDeviceId;
      hasInitialSubscribed = false;

      void runSyncCycle(currentDeviceId, (opts) => signOutRef.current(opts)).catch((err) => {
        void reportError(err, { source: "useDeviceSessionSync_initial" });
      });

      const handleRevalidate = () => {
        if (!activeDeviceId) return;
        void runSyncCycle(
          activeDeviceId,
          (opts) => signOutRef.current(opts),
          { isRevalidation: true },
        ).catch((err) => {
          void reportError(err, { source: "useDeviceSessionSync_revalidate" });
        });
      };

      const handleVisibilityChange = () => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          handleRevalidate();
        }
      };

      if (typeof window !== "undefined") {
        window.addEventListener("online", handleRevalidate);
      }
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", handleVisibilityChange);
      }

      activeListenersCleanup = () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("online", handleRevalidate);
        }
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        }
      };

      try {
        const supabase = getSupabase();
        if (typeof supabase.channel === "function") {
          const channel = supabase
            .channel(`user-devices-${userId}`)
            .on(
              "postgres_changes",
              {
                event: "UPDATE",
                schema: "public",
                table: "user_devices",
                filter: `user_id=eq.${userId}`,
              },
              (payload) => {
                const newRow = payload.new as { device_id?: string; is_revoked?: boolean } | undefined;
                if (
                  newRow &&
                  newRow.is_revoked === true &&
                  activeDeviceId &&
                  newRow.device_id === activeDeviceId
                ) {
                  void handleRemoteRevocation((opts) => signOutRef.current(opts));
                }
              },
            )
            .subscribe((status) => {
              if (status === "SUBSCRIBED") {
                if (!hasInitialSubscribed) {
                  hasInitialSubscribed = true;
                  return;
                }
                handleRevalidate();
              }
            });

          activeChannel = channel as unknown as RealtimeChannelLike;
        }
      } catch (err) {
        void reportError(err, { source: "useDeviceSessionSync_realtime" });
      }
    }

    return () => {
      activeRefCount = Math.max(0, activeRefCount - 1);
      if (activeRefCount === 0) {
        teardownSingleton();
      }
    };
  }, [isEligible, userId]);
}
