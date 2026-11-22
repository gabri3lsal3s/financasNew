import { useEffect, useState } from "react";
import { HOMOLOGATED_BANKS, type UnknownCategoryStrategy } from "@/domain/notifications";
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
  const { listenerGranted, requestNotificationListener } = usePermissionsStatus();

  const [isDisclosureModalOpen, setIsDisclosureModalOpen] = useState(false);
  const [installedBanks, setInstalledBanks] = useState<string[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledBankApp[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const isNative = isNativePlatform();

  useEffect(() => {
    if (!isNative || !isBankListenerAllowed) return;
    void getInstalledBankingApps().then((res) => {
      setInstalledBanks(res.installedBankNames || []);
      setInstalledApps(res.apps || []);
    });
    void syncMonitoredBanksWithNative(
      bankPrefs.passiveCaptureEnabled ? bankPrefs.monitoredBanks : [],
      bankPrefs.interactiveNotificationsEnabled,
    );
  }, [
    isNative,
    isBankListenerAllowed,
    bankPrefs.passiveCaptureEnabled,
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
    commitPrefs(
      { passiveCaptureEnabled: enabled },
      enabled ? bankPrefs.monitoredBanks : [],
    );

    if (!enabled) {
      pushToast({
        title: "Captura de compras desativada",
        description: "Nenhuma notificação bancária será processada.",
      });
      return;
    }

    if (!listenerGranted) {
      setIsDisclosureModalOpen(true);
    } else {
      pushToast({
        title: "Captura de compras ativada",
        description: "Notificações bancárias serão detectadas e convertidas em sugestões.",
        variant: "success",
      });
    }
  };

  const handleConfirmDisclosure = async () => {
    setIsDisclosureModalOpen(false);
    const granted = await requestNotificationListener();
    if (!granted) {
      pushToast({
        title: "Permissão pendente no Android",
        description: "Habilite o Axir nas configurações de Acesso a Notificações do seu aparelho.",
        variant: "warning",
      });
      return;
    }
    void syncMonitoredBanksWithNative(bankPrefs.monitoredBanks);
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
      bankPrefs.passiveCaptureEnabled ? bankPrefs.monitoredBanks : [],
      enabled,
    );
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Notificações com botões de ação rápida ativadas."
        : "Notificações silenciosas ativadas (apenas card discreto na tela inicial).",
    });
  };

  const handleToggleAutoInstallments = (enabled: boolean) => {
    commitPrefs({ autoInstallmentsEnabled: enabled });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Detecção e desmembramento automático de parcelas ativado."
        : "Cálculo de parcelas desativado (compras tratadas como parcela única).",
    });
  };

  const handleToggleAutoCategoryInference = (enabled: boolean) => {
    commitPrefs({ autoCategoryInferenceEnabled: enabled });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Inferência automática de categorias ativada."
        : "Inferência desativada (seleção manual exigida).",
    });
  };

  const handleSelectUnknownCategoryStrategy = (strategy: UnknownCategoryStrategy) => {
    commitPrefs({ unknownCategoryHandling: strategy });
  };

  const handleToggleBank = (bankName: string, nextChecked: boolean) => {
    const nextList = nextChecked
      ? [...new Set([...bankPrefs.monitoredBanks, bankName])]
      : bankPrefs.monitoredBanks.filter((b) => b !== bankName);
    commitPrefs({ monitoredBanks: nextList }, bankPrefs.passiveCaptureEnabled ? nextList : undefined);
  };

  const handleSelectAllBanks = () => {
    const all = [...HOMOLOGATED_BANKS];
    commitPrefs({ monitoredBanks: all }, bankPrefs.passiveCaptureEnabled ? all : undefined);
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
    commitPrefs({ monitoredBanks: nextList }, bankPrefs.passiveCaptureEnabled ? nextList : undefined);
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
    isDisclosureModalOpen,
    setIsDisclosureModalOpen,
    installedBanks,
    installedApps,
    isScanning,
    handleRescanBankingApps,
    handleTogglePassiveCapture,
    handleConfirmDisclosure,
    handleToggleInteractiveNotifications,
    handleToggleAutoInstallments,
    handleToggleAutoCategoryInference,
    handleSelectUnknownCategoryStrategy,
    handleToggleBank,
    handleSelectAllBanks,
    handleDeselectAllBanks,
    handleSelectOnlyInstalledBanks,
  };
}
