import type { ReactNode } from "react";
import { useContext, useEffect, useRef, useState } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { parseTimeHHMM } from "@/domain/notifications";
import { NativeUpdateToast } from "@/components/modules/native-update-toast";
import { AppLockOverlay } from "@/app/app-lock-overlay";
import { SubscriptionProvider, useIsPro } from "@/state/subscription-context";
import {
  syncMerchantLearningFromCloud,
  syncCardDigitsMappingFromCloud,
  syncBankCardMappingFromCloud,
} from "@/services/merchant-learning";
import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { syncVisualWithCloud, useVisualCustomization } from "@/hooks/use-visual-customization";
import { useDynamicFavicon } from "@/hooks/use-dynamic-favicon";
import { useDynamicAppIcon } from "@/hooks/use-dynamic-app-icon";
import {
  cancelDailyReminder,
  clearAllDueNotifications,
  scheduleDailyReminder,
  setPrivacyShieldEnabled,
  syncDueReminderNotifications,
  syncBankAssistantWithCloud,
  syncDeviceNotificationsWithCloud,
  syncMonitoredBanksWithNative,
  isNativePlatform,
} from "@/services/native";
import { useReminders } from "@/state";
import { useDemoSession } from "@/state/demo-mode";
import { useAuth } from "@/hooks/use-auth";

function CloudPreferencesSync({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <>{children}</>;
  return <CloudPreferencesSyncInner>{children}</CloudPreferencesSyncInner>;
}

function CloudPreferencesSyncInner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: preferences } = useUserPreferences();
  const lastNativeScheduleSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (preferences?.custom_settings) {
      syncVisualWithCloud(preferences.custom_settings);
      if (preferences.custom_settings.privacyShieldEnabled !== undefined) {
        setPrivacyShieldEnabled(preferences.custom_settings.privacyShieldEnabled);
      }
      if (preferences.custom_settings.merchantLearning) {
        syncMerchantLearningFromCloud(preferences.custom_settings.merchantLearning);
      }
      if (preferences.custom_settings.cardDigitsMapping) {
        syncCardDigitsMappingFromCloud(preferences.custom_settings.cardDigitsMapping);
      }
      if (preferences.custom_settings.bankCardMapping) {
        syncBankCardMappingFromCloud(preferences.custom_settings.bankCardMapping);
      }
      if (preferences.custom_settings.bankAssistant) {
        const syncedBankPrefs = syncBankAssistantWithCloud(preferences.custom_settings.bankAssistant);
        if (isNativePlatform()) {
          void syncMonitoredBanksWithNative(
            syncedBankPrefs.passiveCaptureEnabled ? syncedBankPrefs.monitoredBanks : [],
            syncedBankPrefs.interactiveNotificationsEnabled,
          );
        }
      }
      if (preferences.custom_settings.deviceNotifications) {
        const deviceNotifs = preferences.custom_settings.deviceNotifications;
        syncDeviceNotificationsWithCloud(deviceNotifs, user?.id);

        if (isNativePlatform()) {
          const scheduleSig = JSON.stringify({
            due: deviceNotifs.dueNotificationsEnabled,
            daily: deviceNotifs.dailyReminderEnabled,
            time: deviceNotifs.dailyReminderTime ?? "20:00",
          });
          if (lastNativeScheduleSigRef.current !== scheduleSig) {
            lastNativeScheduleSigRef.current = scheduleSig;
            if (deviceNotifs.dailyReminderEnabled === true) {
              const { hour, minute } = parseTimeHHMM(deviceNotifs.dailyReminderTime, 20, 0);
              void scheduleDailyReminder({ hour, minute, requestPermission: false });
            } else if (deviceNotifs.dailyReminderEnabled === false) {
              void cancelDailyReminder();
            }
            if (deviceNotifs.dueNotificationsEnabled === false) {
              void clearAllDueNotifications(user?.id);
            }
          }
        }
      }
    }
  }, [preferences?.custom_settings, user?.id]);

  return <>{children}</>;
}

function DynamicBrandSync() {
  const isPro = useIsPro();
  useDynamicFavicon(isPro);
  useDynamicAppIcon(isPro);
  const { accent, setAccent } = useVisualCustomization();

  useEffect(() => {
    if (!isPro && accent === "gold") {
      setAccent("teal");
    }
  }, [isPro, accent, setAccent]);

  return null;
}

function RemindersNotificationSync() {
  const { user } = useAuth();
  if (!user) return null;
  return <RemindersNotificationSyncInner userId={user.id} />;
}

function RemindersNotificationSyncInner({ userId }: { userId: string }) {
  const { items, scheduledPayableItems, preferences, isLoading } = useReminders();
  const { data: userPreferences } = useUserPreferences();
  const { isDemoActive } = useDemoSession();
  const queryClient = useContext(QueryClientContext);
  const [syncVersion, setSyncVersion] = useState(0);

  useEffect(() => {
    const handlePrefsChanged = () => setSyncVersion((v) => v + 1);
    const handleStatesChanged = () => {
      void queryClient?.invalidateQueries({ queryKey: ["reminder-states"] });
      setSyncVersion((v) => v + 1);
    };
    window.addEventListener("axir:device-notification-prefs-changed", handlePrefsChanged);
    window.addEventListener("axir:reminder-states-changed", handleStatesChanged);
    return () => {
      window.removeEventListener("axir:device-notification-prefs-changed", handlePrefsChanged);
      window.removeEventListener("axir:reminder-states-changed", handleStatesChanged);
    };
  }, [queryClient]);

  const deviceNotifications = userPreferences?.custom_settings?.deviceNotifications;

  useEffect(() => {
    if (isDemoActive || isLoading) return;
    if (!preferences.enabled) {
      void clearAllDueNotifications(userId);
      return;
    }
    const payableItems = isNativePlatform()
      ? (scheduledPayableItems ?? items.filter((i) => (i.direction ?? "payable") === "payable"))
      : items.filter((i) => (i.direction ?? "payable") === "payable");
    void syncDueReminderNotifications(payableItems, userId);
  }, [
    preferences.enabled,
    items,
    scheduledPayableItems,
    userId,
    isLoading,
    isDemoActive,
    deviceNotifications?.dueNotificationsEnabled,
    deviceNotifications?.quietHours?.enabled,
    deviceNotifications?.quietHours?.start,
    deviceNotifications?.quietHours?.end,
    syncVersion,
  ]);

  return null;
}

/**
 * Providers exclusivos da área autenticada. Mantidos fora do bundle inicial da
 * landing page para que visitantes não baixem stores, assinaturas, bloqueio
 * biométrico e sincronizações de preferências antes de criar conta.
 */
export function AuthenticatedProviders({ children }: { children: ReactNode }) {
  return (
    <CloudPreferencesSync>
      <SubscriptionProvider>
        <DynamicBrandSync />
        <RemindersNotificationSync />
        <NativeUpdateToast />
        <AppLockOverlay />
        {children}
      </SubscriptionProvider>
    </CloudPreferencesSync>
  );
}
