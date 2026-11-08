import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { isNativePlatform } from "./platform";
import {
  checkNotificationPermissions,
  requestNotificationPermissions,
} from "./local-notifications";
import {
  isNotificationListenerGranted,
  requestNotificationListenerPermission,
} from "./bank-listener";

export interface PermissionsStatus {
  postNotificationsGranted: boolean;
  listenerGranted: boolean;
  isChecking: boolean;
  refresh: () => Promise<void>;
  requestPostNotifications: () => Promise<boolean>;
  requestNotificationListener: () => Promise<boolean>;
}

/**
 * Hook reativo centralizado para diagnóstico e monitoramento das permissões do sistema operacional.
 *
 * Escuta eventos de retomada de foco (`appStateChange` no Android nativo, `visibilitychange`
 * e `focus` no navegador/PWA) para atualizar instantaneamente o status quando o usuário
 * altera permissões nas configurações do sistema e retorna ao app.
 */
export function usePermissionsStatus(): PermissionsStatus {
  const [postNotificationsGranted, setPostNotificationsGranted] = useState(false);
  const [listenerGranted, setListenerGranted] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const [notifRes, listenerRes] = await Promise.all([
        checkNotificationPermissions(),
        isNotificationListenerGranted(),
      ]);
      if (seq === seqRef.current) {
        setPostNotificationsGranted(Boolean(notifRes?.granted));
        setListenerGranted(Boolean(listenerRes));
        setIsChecking(false);
      }
    } catch {
      if (seq === seqRef.current) {
        setPostNotificationsGranted(false);
        setListenerGranted(false);
        setIsChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        void refresh();
      }
    }, 0);

    // 1. Escuta retorno de segundo plano em plataforma nativa (Capacitor App)
    let appStateHandle: { remove: () => void } | null = null;
    if (isNativePlatform()) {
      try {
        const handlePromise = App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            void refresh();
          }
        });
        void handlePromise.then((h) => {
          appStateHandle = h;
        });
      } catch {
        // no-op em ambientes de teste sem plugin
      }
    }

    // 2. Escuta retomada de foco no documento (Web / PWA / Desktop)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    const handleFocus = () => {
      void refresh();
    };

    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (appStateHandle) {
        try {
          appStateHandle.remove();
        } catch {
          // no-op
        }
      }
      if (typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [refresh]);

  const requestPostNotifications = useCallback(async (): Promise<boolean> => {
    const seq = ++seqRef.current;
    try {
      const res = await requestNotificationPermissions();
      const granted = Boolean(res?.granted);
      if (seq === seqRef.current) {
        setPostNotificationsGranted(granted);
        setIsChecking(false);
      }
      return granted;
    } catch {
      if (seq === seqRef.current) {
        setPostNotificationsGranted(false);
        setIsChecking(false);
      }
      return false;
    }
  }, []);

  const requestNotificationListener = useCallback(async (): Promise<boolean> => {
    const seq = ++seqRef.current;
    try {
      await requestNotificationListenerPermission();
      const granted = await isNotificationListenerGranted();
      if (seq === seqRef.current) {
        setListenerGranted(granted);
        setIsChecking(false);
      }
      return granted;
    } catch {
      if (seq === seqRef.current) {
        setListenerGranted(false);
        setIsChecking(false);
      }
      return false;
    }
  }, []);

  return {
    postNotificationsGranted,
    listenerGranted,
    isChecking,
    refresh,
    requestPostNotifications,
    requestNotificationListener,
  };
}
