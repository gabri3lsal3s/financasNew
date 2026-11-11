import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { useUserAccess } from "@/state/queries/use-user-access";
import { useUpdateCustomSettings } from "@/state/mutations/use-preference-mutations";
import { useDemoSession } from "@/state/demo-mode";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

/**
 * Hook centralizado para controle e leitura do Modo Viagem.
 *
 * Por padrão, o Modo Viagem inicia desabilitado (`false`).
 * Quando desabilitado ou quando o usuário possui licença restrita a Investimentos,
 * os atalhos de navegação e seletores são ocultados na interface.
 */
export function useTripMode() {
  const { isDemoActive } = useDemoSession();
  const { hasFeature } = useUserAccess();
  const preferencesQuery = useUserPreferences();
  const updateSettingsMutation = useUpdateCustomSettings();

  const hasFinanceFeatures =
    hasFeature("transactions") ||
    hasFeature("cards") ||
    hasFeature("debts") ||
    hasFeature("budgets");

  const isTripModeEnabled = isDemoActive
    ? true
    : !hasFinanceFeatures
      ? false
      : (preferencesQuery.data?.custom_settings?.tripModeEnabled ?? true);

  const toggleTripMode = async (enabled: boolean): Promise<void> => {
    if (isDemoActive) return;
    triggerSensory("toggle");
    try {
      await updateSettingsMutation.mutateAsync({
        tripModeEnabled: enabled,
      });
      pushToast({
        title: enabled ? "Modo Viagem ativado" : "Modo Viagem desativado",
        description: enabled
          ? "Grupos de viagem, extrato compartilhado e liquidação Pix agora estão disponíveis."
          : "Interface simplificada. Todos os dados das suas viagens continuam preservados com segurança.",
        variant: "default",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  return {
    isTripModeEnabled,
    toggleTripMode,
    isLoading: preferencesQuery.isLoading,
    isPending: updateSettingsMutation.isPending,
  };
}
