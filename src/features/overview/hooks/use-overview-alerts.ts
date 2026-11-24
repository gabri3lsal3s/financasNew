import { useCallback, useEffect, useMemo, useState } from "react";
import type { NavigateFunction } from "react-router";
import type { PermissionAlertBannerType } from "@/components/modules";
import { mergeDashboardAlertDismissals } from "@/domain/overview";
import {
  isDailyReminderEnabled,
  isDueNotificationsEnabled,
  isNativePlatform,
  isPermissionAlertDismissed,
  setDismissedPermissionAlert,
  useBankAssistantPreferences,
  usePermissionsStatus,
} from "@/services/native";
import { getActiveUserId, getUserStorageKey, subscribeActiveUserId } from "@/services/user-storage";
import { useUpdateCustomSettings, useUserAccess, useUserPreferences } from "@/state";
import type { DashboardAlertDismissals } from "@/types";

const DASHBOARD_ALERT_DISMISSALS_KEY = "financasnew:dashboard_alert_dismissals";

function getScopedDashboardDismissalsKey(userId?: string | null): string {
  const uid = userId !== undefined ? userId : getActiveUserId();
  return uid ? getUserStorageKey(DASHBOARD_ALERT_DISMISSALS_KEY, uid) : DASHBOARD_ALERT_DISMISSALS_KEY;
}

export function loadLocalAlertDismissals(storageKey = getScopedDashboardDismissalsKey()): DashboardAlertDismissals {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalAlertDismissals(
  dismissals: DashboardAlertDismissals,
  storageKey = getScopedDashboardDismissalsKey(),
): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(dismissals));
    }
  } catch {
    // noop
  }
}

export function useDashboardAlertDismissals() {
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const [activeUid, setActiveUid] = useState<string | null>(() => getActiveUserId());
  useEffect(() => subscribeActiveUserId(setActiveUid), []);
  const storageKey = getScopedDashboardDismissalsKey(activeUid);

  const [localDismissalsOverride, setLocalDismissalsOverride] = useState<{
    key: string;
    value: DashboardAlertDismissals;
  } | null>(null);

  const effectiveLocalDismissals = useMemo(() => {
    if (localDismissalsOverride && localDismissalsOverride.key === storageKey) {
      return localDismissalsOverride.value;
    }
    return loadLocalAlertDismissals(storageKey);
  }, [localDismissalsOverride, storageKey]);

  const cloudAlertDismissals = userPreferencesQuery.data?.custom_settings?.dashboardAlertDismissals;

  useEffect(() => {
    if (cloudAlertDismissals && storageKey) {
      const currentLocal = loadLocalAlertDismissals(storageKey);
      const merged = mergeDashboardAlertDismissals(cloudAlertDismissals, currentLocal);
      saveLocalAlertDismissals(merged, storageKey);
    }
  }, [cloudAlertDismissals, storageKey]);

  const alertDismissals = useMemo<DashboardAlertDismissals>(() => {
    return mergeDashboardAlertDismissals(cloudAlertDismissals, effectiveLocalDismissals);
  }, [cloudAlertDismissals, effectiveLocalDismissals]);

  const updateAlertDismissals = useCallback(
    (updater: (prev: DashboardAlertDismissals) => DashboardAlertDismissals) => {
      const currentLocal =
        localDismissalsOverride && localDismissalsOverride.key === storageKey
          ? localDismissalsOverride.value
          : loadLocalAlertDismissals(storageKey);
      const mergedBase = mergeDashboardAlertDismissals(cloudAlertDismissals, currentLocal);
      const next = updater(mergedBase);
      saveLocalAlertDismissals(next, storageKey);
      updateCustomSettingsMutation.mutate({
        dashboardAlertDismissals: next,
      });
      setLocalDismissalsOverride({ key: storageKey, value: next });
    },
    [cloudAlertDismissals, localDismissalsOverride, storageKey, updateCustomSettingsMutation],
  );

  return { alertDismissals, updateAlertDismissals, isLoading: userPreferencesQuery.isLoading };
}

export function useOverviewPermissionsBanner(navigate: NavigateFunction) {
  const isNative = isNativePlatform();
  const { postNotificationsGranted, listenerGranted, isChecking, requestPostNotifications } =
    usePermissionsStatus();
  const { preferences: bankPrefs } = useBankAssistantPreferences();
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const { hasFeature } = useUserAccess();
  const isBankListenerAllowed = hasFeature("bank_notification_listener");

  const cloudDeviceNotifs = userPreferencesQuery.data?.custom_settings?.deviceNotifications;
  const dueNotificationsActive = cloudDeviceNotifs?.dueNotificationsEnabled ?? isDueNotificationsEnabled();
  const dailyReminderActive = cloudDeviceNotifs?.dailyReminderEnabled ?? isDailyReminderEnabled();
  const hasDeviceAlertsConfigured = Boolean(
    dueNotificationsActive ||
      dailyReminderActive ||
      cloudDeviceNotifs?.remotePushEnabled ||
      postNotificationsGranted,
  );

  const hasMonitoredBanks = (bankPrefs.monitoredBanks?.length ?? 0) > 0;
  const isBankListenerMissing =
    isNative &&
    isBankListenerAllowed &&
    bankPrefs.passiveCaptureEnabled &&
    hasMonitoredBanks &&
    !listenerGranted;
  const isPushDueMissing =
    isNative && (dueNotificationsActive || dailyReminderActive) && !postNotificationsGranted;

  const [dismissedSession, setDismissedSession] = useState<{
    pushDue?: boolean;
    passiveBankListener?: boolean;
  }>({});

  const isBankListenerDismissed =
    Boolean(dismissedSession.passiveBankListener) ||
    isPermissionAlertDismissed("passiveBankListener") ||
    Boolean(cloudDeviceNotifs?.dismissedPermissionAlerts?.passiveBankListener);
  const isPushDueDismissed =
    Boolean(dismissedSession.pushDue) ||
    isPermissionAlertDismissed("pushDue") ||
    Boolean(cloudDeviceNotifs?.dismissedPermissionAlerts?.pushDue);

  const showBankMissing = isBankListenerMissing && !isBankListenerDismissed;
  const showPushMissing = isPushDueMissing && !isPushDueDismissed;

  const shouldShowPermissionsBanner =
    isNative && (showBankMissing || showPushMissing);

  const permissionBannerType: PermissionAlertBannerType =
    showBankMissing && showPushMissing
      ? "both"
      : showBankMissing
        ? "bank_listener"
        : "push_due";

  const handlePermissionsBannerAction = () => {
    if (permissionBannerType === "bank_listener" || permissionBannerType === "both") {
      // Direciona para Settings > Notificações onde o Prominent Disclosure é exibido antes do Android Notification Listener
      navigate("/configuracoes?tab=notifications");
    } else if (permissionBannerType === "push_due") {
      void requestPostNotifications();
    } else {
      navigate("/configuracoes?tab=notifications");
    }
  };

  const handlePermissionsBannerDismiss = () => {
    setDismissedSession((prev) => ({
      ...prev,
      ...(showBankMissing ? { passiveBankListener: true } : {}),
      ...(showPushMissing ? { pushDue: true } : {}),
    }));
    if (showBankMissing) {
      setDismissedPermissionAlert("passiveBankListener", true);
    }
    if (showPushMissing) {
      setDismissedPermissionAlert("pushDue", true);
    }
    updateCustomSettingsMutation.mutate({
      deviceNotifications: {
        ...cloudDeviceNotifs,
        dismissedPermissionAlerts: {
          ...(cloudDeviceNotifs?.dismissedPermissionAlerts ?? {}),
          ...(showPushMissing ? { pushDue: true } : {}),
          ...(showBankMissing ? { passiveBankListener: true } : {}),
        },
      },
    });
  };

  return {
    isChecking,
    hasDeviceAlertsConfigured,
    shouldShowPermissionsBanner,
    permissionBannerType,
    handlePermissionsBannerAction,
    handlePermissionsBannerDismiss,
  };
}
