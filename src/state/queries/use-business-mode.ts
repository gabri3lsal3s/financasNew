import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listRecurrences } from "@/data/repositories/recurrences";
import { recurrencesKey } from "@/state/queries/use-recurrences";
import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { useUserAccess } from "@/state/queries/use-user-access";
import { useUpdateCustomSettings } from "@/state/mutations/use-preference-mutations";
import { useDemoSession } from "@/state/demo-mode";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { BusinessProfileSettings, Recurrence } from "@/types";

/**
 * Hook centralizado para controle e leitura do Modo Negócio (MEI / Autônomo — Fase 2A).
 *
 * Isolamento opt-in estrito: por padrão inicia SEMPRE desligado (`?? false`).
 * Quando desligado ou quando o usuário possui licença restrita sem finanças,
 * zero componentes ou queries extras são disparados no fluxo PF.
 */
export function useBusinessMode() {
  const queryClient = useQueryClient();
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
        let hasActiveBusinessRecurrences = false;
        if (!enabled) {
          try {
            const cached = queryClient.getQueryData<Recurrence[]>([...recurrencesKey, "all"]);
            const recurrencesList = cached ?? (await listRecurrences());
            hasActiveBusinessRecurrences = recurrencesList.some(
              (r) => r.scope === "business" && r.is_active,
            );
          } catch {
            // Continua fluxo seguro
          }
        }

        await updateSettingsMutation.mutateAsync({
          businessModeEnabled: enabled,
        });

        pushToast({
          title: enabled ? "Modo Negócio ativado" : "Modo Negócio desativado",
          description: enabled
            ? "Separação PF e PJ e o painel /negocio já estão disponíveis."
            : hasActiveBusinessRecurrences
              ? "Interface pessoal restaurada. Atenção: existem recorrências do negócio ativas que continuarão gerando lançamentos. Pause-as em Recorrências se desejar interrompê-las."
              : "Interface pessoal restaurada. Seus lançamentos de negócio seguem preservados com segurança.",
          variant: !enabled && hasActiveBusinessRecurrences ? "warning" : "default",
        });
      } catch {
        triggerSensory("destructive");
      }
    },
    [isDemoActive, queryClient, updateSettingsMutation],
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
