import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { useUserAccess } from "@/state/queries/use-user-access";
import { useUpdateCustomSettings } from "@/state/mutations/use-preference-mutations";
import { useDemoSession } from "@/state/demo-mode";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

/**
 * Hook centralizado para controle e leitura do Modo Familiar.
 *
 * Por padrão, o Modo Familiar inicia ativado (`true`) para novos usuários.
 * Quando desabilitado ou quando o usuário possui licença restrita a Investimentos,
 * as divisões familiares (abas, filtros e switches) são ocultadas na interface.
 */
export function useFamilyMode() {
  const { isDemoActive } = useDemoSession();
  const { hasFeature } = useUserAccess();
  const preferencesQuery = useUserPreferences();
  const updateSettingsMutation = useUpdateCustomSettings();

  const hasFinanceFeatures =
    hasFeature("transactions") ||
    hasFeature("cards") ||
    hasFeature("debts") ||
    hasFeature("budgets");

  const isFamilyModeEnabled = isDemoActive
    ? true
    : !hasFinanceFeatures
      ? false
      : (preferencesQuery.data?.custom_settings?.familyModeEnabled ?? true);

  const toggleFamilyMode = async (enabled: boolean): Promise<void> => {
    if (isDemoActive) return;
    triggerSensory("toggle");
    try {
      await updateSettingsMutation.mutateAsync({
        familyModeEnabled: enabled,
      });
      pushToast({
        title: enabled ? "Modo Familiar ativado" : "Modo Familiar desativado",
        description: enabled
          ? "Abas e opções de despesas familiares agora estão disponíveis."
          : "Interface simplificada. Seus dados familiares continuam preservados com segurança.",
        variant: "default",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  return {
    isFamilyModeEnabled,
    toggleFamilyMode,
    isLoading: preferencesQuery.isLoading,
    isPending: updateSettingsMutation.isPending,
  };
}
