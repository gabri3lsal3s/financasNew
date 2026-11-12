import type { ReactNode } from "react";
import { useEffect } from "react";
import { NativeUpdateToast } from "@/components/modules/native-update-toast";
import { AppLockOverlay } from "@/app/app-lock-overlay";
import { SubscriptionProvider, useIsPro } from "@/state/subscription-context";
import {
  syncMerchantLearningFromCloud,
  syncCardDigitsMappingFromCloud,
  syncBankCardMappingFromCloud,
} from "@/services/merchant-learning";
import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { syncVisualWithCloud } from "@/hooks/use-visual-customization";
import { useDynamicFavicon } from "@/hooks/use-dynamic-favicon";
import { useDynamicAppIcon } from "@/hooks/use-dynamic-app-icon";
import {
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
  const { data: preferences } = useUserPreferences();

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
          );
        }
      }
      if (preferences.custom_settings.deviceNotifications) {
        syncDeviceNotificationsWithCloud(preferences.custom_settings.deviceNotifications);
      }
    }
  }, [preferences?.custom_settings]);

  return <>{children}</>;
}

function DynamicBrandSync() {
  const isPro = useIsPro();
  useDynamicFavicon(isPro);
  useDynamicAppIcon(isPro);
  return null;
}

function RemindersNotificationSync() {
  const { user } = useAuth();
  if (!user) return null;
  return <RemindersNotificationSyncInner userId={user.id} />;
}

function RemindersNotificationSyncInner({ userId }: { userId: string }) {
  const { allItems, preferences, isLoading } = useReminders();
  const { isDemoActive } = useDemoSession();

  useEffect(() => {
    if (isDemoActive || isLoading) return;
    if (preferences.enabled) {
      void syncDueReminderNotifications(allItems, userId);
    }
  }, [preferences.enabled, allItems, userId, isLoading, isDemoActive]);

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
