import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { useUpdateCustomSettings } from "@/state/mutations/use-preference-mutations";
import { useDemoSession } from "@/state/demo-mode";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

/**
 * Hook centralizado para controle e leitura do Modo Familiar.
 *
 * Por padrão, o Modo Familiar inicia desabilitado (`false`).
 * Quando desabilitado, as divisões familiares (abas, filtros e switches) são
 * ocultadas na interface, simplificando o fluxo para uso estritamente individual.
 * No modo demo / simulação, é automaticamente mantido ativo (`true`) para apresentação completa.
 *
 * Invariante de Dados:
 * Desativar o Modo Familiar NÃO remove nem altera despesas ou receitas previamente
 * marcadas como familiares; todos os registros permanecem íntegros na nuvem e
 * totalmente visíveis no extrato consolidado.
 */
export function useFamilyMode() {
  const { isDemoActive } = useDemoSession();
  const preferencesQuery = useUserPreferences();
  const updateSettingsMutation = useUpdateCustomSettings();

  const isFamilyModeEnabled = isDemoActive
    ? true
    : Boolean(preferencesQuery.data?.custom_settings?.familyModeEnabled);

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
