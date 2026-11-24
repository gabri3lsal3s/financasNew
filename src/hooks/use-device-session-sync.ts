import { useEffect, useRef } from "react";
import { getSupabase } from "@/data/client";
import { checkDeviceRevoked, registerDevice } from "@/data/repositories/devices";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
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
import { pushToast } from "@/services/toast";

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
let isHandlingRemoteRevocation = false;
let lastRevalidateAt = 0;
let hasInitialSubscribed = false;

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
}

/**
 * Orquestrador global (singleton ref-counted) de ciclo de vida de dispositivos e revogação em tempo real.
 * Deve ser montado uma única vez no shell autenticado (`RequireAuth`).
 */
export function useDeviceSessionSync(): void {
  const { user, loading: authLoading, mfaRequired, mfaVerified } = useAuth();
  const { signOut } = useSignOut();
  const signOutRef = useRef(signOut);
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

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
