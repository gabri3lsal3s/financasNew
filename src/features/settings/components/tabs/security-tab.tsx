import { useEffect, useState } from "react";
import { PlatformsTriptychCard } from "@/components/modules";
import { useAuth } from "@/hooks/use-auth";
import {
  authenticateWithBiometrics,
  checkBiometricsAvailability,
  clearWebAuthnPlatformCredential,
  getAppLockConfig,
  getAppLockGraceMinutes,
  isBiometricLockEnabled,
  isNativePlatform,
  isPinLockConfigured,
  isPrivacyShieldEnabled,
  resetAppLockBackgroundTimer,
  setAppLockConfig,
  setAppLockGraceMinutes,
  setBiometricLockEnabled,
  setPrivacyShieldEnabled,
} from "@/services/native";
import { pushToast } from "@/services/toast";
import {
  useUpdateCustomSettings,
  useUserPreferences,
} from "@/state";
import { useDemoSession } from "@/state/demo-mode";
import { useUserAccess } from "@/state/queries/use-user-access";
import { MfaModal } from "../mfa-modal";
import { PinSetupDialog } from "../pin-setup-dialog";
import { ActiveDevicesCard } from "./active-devices-card";
import { DeleteAccountCard } from "./delete-account-card";
import { AppAboutCard } from "./security/app-about-card";
import { AppLockCard } from "./security/app-lock-card";
import { SessionInactivityCard } from "./security/session-inactivity-card";
import { TwoFactorCard } from "./security/two-factor-card";

export function SecurityTab() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin } = useUserAccess(user?.id);
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean | null>(null);
  const [biometryType, setBiometryType] = useState<string>("none");
  const [bioLockEnabled, setBioLockEnabled] = useState(() => isBiometricLockEnabled());
  const [graceMinutes, setGraceMinutes] = useState(() => String(getAppLockGraceMinutes()));
  const [lockOnIdle, setLockOnIdle] = useState(() => getAppLockConfig(userId).lockOnIdle);
  const [hasPinConfigured, setHasPinConfigured] = useState(() => isPinLockConfigured(userId));
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [mfaRefreshKey, setMfaRefreshKey] = useState(0);

  const { isDemoActive } = useDemoSession();
  const isNative = isNativePlatform() || isDemoActive;
  const showBiometrics = isNative || Boolean(biometricsAvailable);
  const showPrivacyShield = isNative;
  const showAppLockCard = true;

  const [localPrivacyOverride, setLocalPrivacyOverride] = useState<boolean | null>(null);
  const cloudPrivacyShield = userPreferencesQuery.data?.custom_settings?.privacyShieldEnabled;
  const privacyEnabled =
    localPrivacyOverride !== null
      ? localPrivacyOverride
      : cloudPrivacyShield !== undefined
        ? cloudPrivacyShield
        : isPrivacyShieldEnabled();

  useEffect(() => {
    void checkBiometricsAvailability().then((res) => {
      setBiometricsAvailable(res.isAvailable);
      setBiometryType(res.biometryType);
    });
  }, []);

  const handleToggleBiometrics = async (enabled: boolean) => {
    if (enabled) {
      const result = await authenticateWithBiometrics({
        reason: "Confirme sua biometria para habilitar o bloqueio do aplicativo",
        userId: userId ?? undefined,
      });
      if (!result.success) {
        pushToast({
          title: "Autenticação não concluída",
          description: result.error ?? "Não foi possível validar sua biometria.",
          variant: "destructive",
        });
        return;
      }
      setBiometricLockEnabled(true);
      resetAppLockBackgroundTimer();
      setBioLockEnabled(true);
      pushToast({
        title: "Bloqueio biométrico ativado",
        description: "O aplicativo exigirá biometria ao retornar do segundo plano.",
        variant: "success",
      });
      return;
    }

    clearWebAuthnPlatformCredential();
    setBiometricLockEnabled(false);
    setBioLockEnabled(false);
    pushToast({
      title: "Bloqueio biométrico desativado",
      variant: "default",
    });
  };

  const handleTogglePinLock = (checked: boolean) => {
    if (checked) {
      if (!hasPinConfigured) {
        setIsPinDialogOpen(true);
        return;
      }
      setBiometricLockEnabled(true);
      setBioLockEnabled(true);
      resetAppLockBackgroundTimer();
      pushToast({
        title: "Bloqueio por PIN ativado",
        description: "O aplicativo exigirá PIN ao retornar do segundo plano.",
        variant: "success",
      });
      return;
    }

    setBiometricLockEnabled(false);
    setBioLockEnabled(false);
    pushToast({
      title: "Bloqueio por PIN desativado",
      variant: "default",
    });
  };

  const handleGraceMinutesChange = (val: string) => {
    setGraceMinutes(val);
    setAppLockGraceMinutes(Number(val));
  };

  const handleToggleLockOnIdle = (enabled: boolean) => {
    setLockOnIdle(enabled);
    setAppLockConfig({ lockOnIdle: enabled }, userId);
  };

  const handleTogglePrivacyShield = (enabled: boolean) => {
    setLocalPrivacyOverride(enabled);
    setPrivacyShieldEnabled(enabled);
    updateCustomSettingsMutation.mutate({ privacyShieldEnabled: enabled });
    pushToast({
      title: enabled ? "Escudo de privacidade ativado" : "Escudo de privacidade desativado",
      description: enabled
        ? "Capturas de tela e miniaturas no alternador de tarefas foram bloqueadas."
        : "Capturas de tela foram liberadas com sucesso.",
      variant: "default",
    });
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
      {showAppLockCard ? (
        <AppLockCard
          showBiometrics={showBiometrics}
          showPrivacyShield={showPrivacyShield}
          biometricsAvailable={biometricsAvailable}
          biometryType={biometryType}
          isDemoActive={isDemoActive}
          bioLockEnabled={bioLockEnabled}
          graceMinutes={graceMinutes}
          lockOnIdle={lockOnIdle}
          hasPinConfigured={hasPinConfigured}
          privacyEnabled={privacyEnabled}
          onToggleBiometrics={(enabled) => {
            void handleToggleBiometrics(enabled);
          }}
          onTogglePinLock={handleTogglePinLock}
          onOpenPinDialog={() => setIsPinDialogOpen(true)}
          onGraceMinutesChange={handleGraceMinutesChange}
          onToggleLockOnIdle={handleToggleLockOnIdle}
          onTogglePrivacyShield={handleTogglePrivacyShield}
        />
      ) : null}

      {!isNative ? <SessionInactivityCard userId={userId} /> : null}

      <TwoFactorCard
        refreshKey={mfaRefreshKey}
        isAdmin={isAdmin}
        onOpenMfaModal={() => setIsMfaModalOpen(true)}
      />

      <ActiveDevicesCard />

      <PinSetupDialog
        open={isPinDialogOpen}
        onOpenChange={setIsPinDialogOpen}
        userId={userId}
        hasExistingPin={hasPinConfigured}
        onPinSaved={() => {
          setHasPinConfigured(isPinLockConfigured(userId));
          setBioLockEnabled(true);
          setBiometricLockEnabled(true);
        }}
        onPinRemoved={() => {
          setHasPinConfigured(false);
          if (!isNative && !biometricsAvailable) {
            setBioLockEnabled(false);
            setBiometricLockEnabled(false);
          }
        }}
      />

      <MfaModal
        open={isMfaModalOpen}
        onOpenChange={(open) => {
          setIsMfaModalOpen(open);
          if (!open) {
            setMfaRefreshKey((k) => k + 1);
          }
        }}
      />

      <PlatformsTriptychCard />

      <AppAboutCard isNative={isNative} />

      <DeleteAccountCard />
    </div>
  );
}
