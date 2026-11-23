import { useEffect, useRef, useState } from "react";
import { HOMOLOGATED_BANKS } from "@/domain/notifications";
import {
  getInstalledBankingApps,
  isNativePlatform,
  syncMonitoredBanksWithNative,
  useBankAssistantPreferences,
  usePermissionsStatus,
  type InstalledBankApp,
} from "@/services/native";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useUpdateCustomSettings, useUserAccess } from "@/state";

export function useBankingAssistant() {
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const { hasFeature } = useUserAccess();
  const isBankListenerAllowed = hasFeature("bank_notification_listener");
  const { preferences: bankPrefs, updatePreferences: updateBankPrefs } =
    useBankAssistantPreferences();
  const { listenerGranted, requestNotificationListener, refresh } = usePermissionsStatus();

  const [isDisclosureModalOpen, setIsDisclosureModalOpen] = useState(false);
  const [installedBanks, setInstalledBanks] = useState<string[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledBankApp[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const awaitingListenerReturnRef = useRef(false);

  const isNative = isNativePlatform();
  const effectivePassiveCaptureActive = Boolean(bankPrefs.passiveCaptureEnabled && listenerGranted);
  const isPassiveCapturePendingPermission = Boolean(
    bankPrefs.passiveCaptureEnabled && !listenerGranted,
  );

  useEffect(() => {
    if (!isNative || !isBankListenerAllowed) return;
    void getInstalledBankingApps().then((res) => {
      setInstalledBanks(res.installedBankNames || []);
      setInstalledApps(res.apps || []);
    });
    void syncMonitoredBanksWithNative(
      effectivePassiveCaptureActive ? bankPrefs.monitoredBanks : [],
      bankPrefs.interactiveNotificationsEnabled,
    );
  }, [
    isNative,
    isBankListenerAllowed,
    effectivePassiveCaptureActive,
    bankPrefs.monitoredBanks,
    bankPrefs.interactiveNotificationsEnabled,
  ]);

  const commitPrefs = (patch: Partial<typeof bankPrefs>, syncNativeList?: string[]) => {
    updateBankPrefs(patch);
    updateCustomSettingsMutation.mutate({ bankAssistant: patch });
    if (syncNativeList !== undefined) {
      void syncMonitoredBanksWithNative(syncNativeList);
    }
  };

  // Quando o usuário retorna das Configurações do Android após confirmar o Disclosure,
  // ativa automaticamente a captura passiva e pré-seleciona os bancos instalados no aparelho.
  useEffect(() => {
    if (!listenerGranted || !awaitingListenerReturnRef.current) return;
    awaitingListenerReturnRef.current = false;
    const autoBanks =
      bankPrefs.monitoredBanks.length === 0 && installedBanks.length > 0
        ? installedBanks
        : bankPrefs.monitoredBanks;
    updateBankPrefs({
      passiveCaptureEnabled: true,
      monitoredBanks: autoBanks,
    });
    updateCustomSettingsMutation.mutate({
      bankAssistant: {
        passiveCaptureEnabled: true,
        monitoredBanks: autoBanks,
      },
    });
    void syncMonitoredBanksWithNative(autoBanks);
    triggerSensory("success");
    pushToast({
      title: "Captura de compras ativada",
      description:
        autoBanks.length > 0
          ? `${autoBanks.length} instituição(ões) selecionada(s) automaticamente.`
          : "Captura passiva de notificações bancárias autorizada.",
      variant: "success",
    });
  }, [
    listenerGranted,
    bankPrefs.monitoredBanks,
    installedBanks,
    updateBankPrefs,
    updateCustomSettingsMutation,
  ]);

  const handleRescanBankingApps = async () => {
    setIsScanning(true);
    try {
      const res = await getInstalledBankingApps();
      const detectedNames = res?.installedBankNames || [];
      setInstalledBanks(detectedNames);
      setInstalledApps(res?.apps || []);

      if (detectedNames.length === 0) {
        pushToast({
          title: "Nenhum aplicativo detectado",
          description: "Nenhum aplicativo bancário suportado foi encontrado no dispositivo.",
          variant: "default",
        });
      } else {
        const count = detectedNames.length;
        pushToast({
          title: "Lista de aplicativos atualizada",
          description:
            count === 1
              ? "1 aplicativo bancário detectado no dispositivo."
              : `${count} aplicativos bancários detectados no dispositivo.`,
          variant: "success",
        });
      }
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Erro ao escanear aplicativos",
        description: "Não foi possível verificar os aplicativos bancários instalados.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleTogglePassiveCapture = (enabled: boolean) => {
    if (!enabled) {
      awaitingListenerReturnRef.current = false;
      commitPrefs({ passiveCaptureEnabled: false }, []);
      pushToast({
        title: "Captura de compras desativada",
        description: "Nenhuma notificação bancária será processada.",
      });
      return;
    }

    if (!listenerGranted) {
      // Fluxo Permission-First: nunca marca como ativo antes de obter consentimento e permissão do Android
      setIsDisclosureModalOpen(true);
      return;
    }

    const autoBanks =
      bankPrefs.monitoredBanks.length === 0 && installedBanks.length > 0
        ? installedBanks
        : bankPrefs.monitoredBanks;
    commitPrefs(
      {
        passiveCaptureEnabled: true,
        ...(autoBanks !== bankPrefs.monitoredBanks ? { monitoredBanks: autoBanks } : {}),
      },
      autoBanks,
    );
    pushToast({
      title: "Captura de compras ativada",
      description:
        autoBanks.length > 0 && bankPrefs.monitoredBanks.length === 0
          ? `${autoBanks.length} aplicativo(s) bancário(s) instalado(s) selecionado(s) automaticamente.`
          : "Notificações bancárias serão detectadas e convertidas em sugestões.",
      variant: "success",
    });
  };

  const handleConfirmDisclosure = async () => {
    setIsDisclosureModalOpen(false);
    awaitingListenerReturnRef.current = true;
    const granted = await requestNotificationListener();
    await refresh?.();
    if (!granted) {
      commitPrefs({ passiveCaptureEnabled: false }, []);
      pushToast({
        title: "Permissão pendente no Android",
        description: "Habilite o Axir nas configurações de Acesso a Notificações do seu aparelho.",
        variant: "warning",
      });
      return;
    }
    awaitingListenerReturnRef.current = false;
    const autoBanks =
      bankPrefs.monitoredBanks.length === 0 && installedBanks.length > 0
        ? installedBanks
        : bankPrefs.monitoredBanks;
    commitPrefs(
      {
        passiveCaptureEnabled: true,
        ...(autoBanks !== bankPrefs.monitoredBanks ? { monitoredBanks: autoBanks } : {}),
      },
      autoBanks,
    );
    triggerSensory("success");
    pushToast({
      title: "Permissão concedida",
      description: "Captura passiva de notificações bancárias autorizada.",
      variant: "success",
    });
  };

  const handleToggleInteractiveNotifications = (enabled: boolean) => {
    commitPrefs({ interactiveNotificationsEnabled: enabled });
    void syncMonitoredBanksWithNative(
      effectivePassiveCaptureActive ? bankPrefs.monitoredBanks : [],
      enabled,
    );
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Notificações com botões de ação rápida ativadas."
        : "Notificações silenciosas ativadas (apenas card discreto na tela inicial).",
    });
  };

  const handleToggleBank = (bankName: string, nextChecked: boolean) => {
    const nextList = nextChecked
      ? [...new Set([...bankPrefs.monitoredBanks, bankName])]
      : bankPrefs.monitoredBanks.filter((b) => b !== bankName);
    commitPrefs(
      { monitoredBanks: nextList },
      effectivePassiveCaptureActive ? nextList : undefined,
    );
  };

  const handleSelectAllBanks = () => {
    const all = [...HOMOLOGATED_BANKS];
    commitPrefs({ monitoredBanks: all }, effectivePassiveCaptureActive ? all : undefined);
    pushToast({
      title: "Todos os bancos selecionados",
      description: `Todos os ${HOMOLOGATED_BANKS.length} bancos homologados estão sendo monitorados.`,
    });
  };

  const handleDeselectAllBanks = () => {
    commitPrefs({ monitoredBanks: [] }, []);
    pushToast({
      title: "Todos os bancos desmarcados",
      description: "Nenhum banco está selecionado para captura.",
    });
  };

  const handleSelectOnlyInstalledBanks = () => {
    if (installedBanks.length === 0) return;
    const nextList = [...new Set([...bankPrefs.monitoredBanks, ...installedBanks])];
    commitPrefs(
      { monitoredBanks: nextList },
      effectivePassiveCaptureActive ? nextList : undefined,
    );
    pushToast({
      title: "Bancos instalados selecionados",
      description: `${installedBanks.length} aplicativo(s) bancário(s) detectado(s) no dispositivo estão sendo monitorados.`,
      variant: "success",
    });
  };

  return {
    isNative,
    isBankListenerAllowed,
    bankPrefs,
    listenerGranted,
    effectivePassiveCaptureActive,
    isPassiveCapturePendingPermission,
    isDisclosureModalOpen,
    setIsDisclosureModalOpen,
    installedBanks,
    installedApps,
    isScanning,
    handleRescanBankingApps,
    handleTogglePassiveCapture,
    handleConfirmDisclosure,
    handleToggleInteractiveNotifications,
    handleToggleBank,
    handleSelectAllBanks,
    handleDeselectAllBanks,
    handleSelectOnlyInstalledBanks,
  };
}
