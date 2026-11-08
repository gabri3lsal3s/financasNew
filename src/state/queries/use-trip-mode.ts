import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { useUpdateCustomSettings } from "@/state/mutations/use-preference-mutations";
import { useDemoSession } from "@/state/demo-mode";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

/**
 * Hook centralizado para controle e leitura do Modo Viagem.
 *
 * Por padrão, o Modo Viagem inicia desabilitado (`false`).
 * Quando desabilitado, os atalhos de navegação e seletores no wizard são
 * ocultados na interface, deixando a experiência focada para o dia a dia.
 * No modo demo / simulação, é automaticamente mantido ativo (`true`) para o tour.
 *
 * Invariante de Dados:
 * Desativar o Modo Viagem NÃO remove, NÃO altera e NÃO inutiliza nenhuma viagem,
 * membro, despesa compartilhada ou liquidação; todos os dados permanecem íntegros
 * na nuvem e voltam a ser exibidos normalmente ao reativar o modo.
 */
export function useTripMode() {
  const { isDemoActive } = useDemoSession();
  const preferencesQuery = useUserPreferences();
  const updateSettingsMutation = useUpdateCustomSettings();

  const isTripModeEnabled = isDemoActive
    ? true
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
