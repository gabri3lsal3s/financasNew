import { useCallback, useMemo, useState } from "react";
import type { NavigateFunction } from "react-router";
import type { PermissionAlertBannerType } from "@/components/modules";
import {
  isDueNotificationsEnabled,
  isNativePlatform,
  isPermissionAlertDismissed,
  setDismissedPermissionAlert,
  useBankAssistantPreferences,
  usePermissionsStatus,
} from "@/services/native";
import { useUpdateCustomSettings, useUserAccess, useUserPreferences } from "@/state";
import type { DashboardAlertDismissals } from "@/types";

const DASHBOARD_ALERT_DISMISSALS_KEY = "financasnew:dashboard_alert_dismissals";

export function loadLocalAlertDismissals(): DashboardAlertDismissals {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DASHBOARD_ALERT_DISMISSALS_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalAlertDismissals(dismissals: DashboardAlertDismissals): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DASHBOARD_ALERT_DISMISSALS_KEY, JSON.stringify(dismissals));
    }
  } catch {
    // noop
  }
}

export function useDashboardAlertDismissals() {
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const [localAlertDismissals, setLocalAlertDismissals] = useState<DashboardAlertDismissals>(() =>
    loadLocalAlertDismissals(),
  );

  const cloudAlertDismissals = userPreferencesQuery.data?.custom_settings?.dashboardAlertDismissals;

  const alertDismissals = useMemo<DashboardAlertDismissals>(() => {
    return {
      ...cloudAlertDismissals,
      ...localAlertDismissals,
      goals: {
        ...(cloudAlertDismissals?.goals ?? {}),
        ...(localAlertDismissals?.goals ?? {}),
      },
    };
  }, [cloudAlertDismissals, localAlertDismissals]);

  const updateAlertDismissals = useCallback(
    (updater: (prev: DashboardAlertDismissals) => DashboardAlertDismissals) => {
      setLocalAlertDismissals((prev) => {
        const next = updater(prev);
        saveLocalAlertDismissals(next);
        updateCustomSettingsMutation.mutate({
          dashboardAlertDismissals: next,
        });
        return next;
      });
    },
    [updateCustomSettingsMutation],
  );

  return { alertDismissals, updateAlertDismissals };
}

export function useOverviewPermissionsBanner(navigate: NavigateFunction) {
  const isNative = isNativePlatform();
  const { postNotificationsGranted, listenerGranted, requestPostNotifications, requestNotificationListener } =
    usePermissionsStatus();
  const { preferences: bankPrefs } = useBankAssistantPreferences();
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const { hasFeature } = useUserAccess();
  const isBankListenerAllowed = hasFeature("bank_notification_listener");

  const cloudDeviceNotifs = userPreferencesQuery.data?.custom_settings?.deviceNotifications;
  const dueNotificationsActive = cloudDeviceNotifs?.dueNotificationsEnabled ?? isDueNotificationsEnabled();

  const isBankListenerMissing =
    isNative && isBankListenerAllowed && bankPrefs.passiveCaptureEnabled && !listenerGranted;
  const isPushDueMissing = isNative && dueNotificationsActive && !postNotificationsGranted;

  const [permissionAlertDismissed, setPermissionAlertDismissed] = useState(false);

  const isAlertDismissedInStorage =
    isPermissionAlertDismissed("passiveBankListener") ||
    isPermissionAlertDismissed("pushDue") ||
    Boolean(cloudDeviceNotifs?.dismissedPermissionAlerts?.passiveBankListener) ||
    Boolean(cloudDeviceNotifs?.dismissedPermissionAlerts?.pushDue);

  const shouldShowPermissionsBanner =
    isNative &&
    !permissionAlertDismissed &&
    !isAlertDismissedInStorage &&
    (isBankListenerMissing || isPushDueMissing);

  const permissionBannerType: PermissionAlertBannerType =
    isBankListenerMissing && isPushDueMissing
      ? "both"
      : isBankListenerMissing
        ? "bank_listener"
        : "push_due";

  const handlePermissionsBannerAction = () => {
    if (permissionBannerType === "bank_listener") {
      void requestNotificationListener();
    } else if (permissionBannerType === "push_due") {
      void requestPostNotifications();
    } else {
      navigate("/configuracoes?tab=notifications");
    }
  };

  const handlePermissionsBannerDismiss = () => {
    setPermissionAlertDismissed(true);
    setDismissedPermissionAlert("passiveBankListener", true);
    setDismissedPermissionAlert("pushDue", true);
    updateCustomSettingsMutation.mutate({
      deviceNotifications: {
        dismissedPermissionAlerts: {
          pushDue: true,
          passiveBankListener: true,
        },
      },
    });
  };

  return {
    shouldShowPermissionsBanner,
    permissionBannerType,
    handlePermissionsBannerAction,
    handlePermissionsBannerDismiss,
  };
}
