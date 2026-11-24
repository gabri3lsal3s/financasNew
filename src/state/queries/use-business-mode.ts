import { useCallback } from "react";
import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { useUserAccess } from "@/state/queries/use-user-access";
import { useUpdateCustomSettings } from "@/state/mutations/use-preference-mutations";
import { useDemoSession } from "@/state/demo-mode";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { BusinessProfileSettings } from "@/types";

/**
 * Hook centralizado para controle e leitura do Modo Negócio (MEI / Autônomo — Fase 2A).
 *
 * Isolamento opt-in estrito: por padrão inicia SEMPRE desligado (`?? false`).
 * Quando desligado ou quando o usuário possui licença restrita sem finanças,
 * zero componentes ou queries extras são disparados no fluxo PF.
 */
export function useBusinessMode() {
  const { isDemoActive } = useDemoSession();
  const { hasFeature } = useUserAccess();
  const preferencesQuery = useUserPreferences();
  const updateSettingsMutation = useUpdateCustomSettings();

  const hasFinanceFeatures =
    hasFeature("transactions") ||
    hasFeature("cards") ||
    hasFeature("debts") ||
    hasFeature("budgets");

  const isBusinessModeEnabled = isDemoActive
    ? false
    : !hasFinanceFeatures
      ? false
      : (preferencesQuery.data?.custom_settings?.businessModeEnabled ?? false);

  const businessProfile = preferencesQuery.data?.custom_settings?.businessProfile;

  const toggleBusinessMode = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (isDemoActive) return;
      triggerSensory("toggle");
      try {
        await updateSettingsMutation.mutateAsync({
          businessModeEnabled: enabled,
        });
        pushToast({
          title: enabled ? "Modo Negócio ativado" : "Modo Negócio desativado",
          description: enabled
            ? "Separação PF e PJ e o painel /negocio já estão disponíveis."
            : "Interface pessoal restaurada. Seus lançamentos de negócio seguem preservados com segurança.",
          variant: "default",
        });
      } catch {
        triggerSensory("destructive");
      }
    },
    [isDemoActive, updateSettingsMutation],
  );

  const updateBusinessProfile = useCallback(
    async (nextProfile: BusinessProfileSettings): Promise<void> => {
      if (isDemoActive) return;
      await updateSettingsMutation.mutateAsync({
        businessProfile: nextProfile,
      });
    },
    [isDemoActive, updateSettingsMutation],
  );

  return {
    isBusinessModeEnabled,
    businessProfile,
    toggleBusinessMode,
    updateBusinessProfile,
    isLoading: preferencesQuery.isLoading,
    isPending: updateSettingsMutation.isPending,
  };
}
