import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateReminderPreferences,
  updateCustomSettings,
  updateAppMode,
  type ReminderPreferencesInput,
} from "@/data/repositories/user-preferences";
import {
  USER_PREFERENCES_KEY,
  userPreferencesQueryKey,
} from "@/state/queries/use-user-preferences";
import { getActiveUserId } from "@/services/user-storage";
import { mergePersistedAdvisorDismissals } from "@/domain/insights/smart-advisor-rules";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import type { AppMode, UserCustomSettings, UserPreferences } from "@/types";

export function useUpdateReminderPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReminderPreferencesInput) => updateReminderPreferences(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USER_PREFERENCES_KEY });
      pushToast({
        title: "Preferências salvas",
        description: "Suas preferências de notificações e lembretes foram atualizadas.",
        variant: "default",
      });
    },
    onError: (error) => {
      pushToast({
        title: "Não foi possível salvar as preferências",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useUpdateCustomSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UserCustomSettings>) => updateCustomSettings(input),
    onMutate: async (patch) => {
      const targetKey = userPreferencesQueryKey(getActiveUserId());
      await queryClient.cancelQueries({ queryKey: USER_PREFERENCES_KEY });
      const previous = queryClient.getQueryData<UserPreferences | null>(targetKey);
      if (previous) {
        queryClient.setQueryData<UserPreferences | null>(targetKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            custom_settings: {
              ...(old.custom_settings ?? {}),
              ...patch,
              dashboardWidgets: {
                ...(old.custom_settings?.dashboardWidgets ?? {}),
                ...(patch.dashboardWidgets ?? {}),
              },
              headerButtons: {
                ...(old.custom_settings?.headerButtons ?? {}),
                ...(patch.headerButtons ?? {}),
              },
              bankAssistant: {
                ...(old.custom_settings?.bankAssistant ?? {}),
                ...(patch.bankAssistant ?? {}),
              },
              deviceNotifications: {
                ...(old.custom_settings?.deviceNotifications ?? {}),
                ...(patch.deviceNotifications ?? {}),
                quietHours:
                  patch.deviceNotifications?.quietHours !== undefined ||
                  old.custom_settings?.deviceNotifications?.quietHours !== undefined
                    ? {
                        ...(old.custom_settings?.deviceNotifications?.quietHours ?? {}),
                        ...(patch.deviceNotifications?.quietHours ?? {}),
                      }
                    : undefined,
                dismissedPermissionAlerts: {
                  ...(old.custom_settings?.deviceNotifications?.dismissedPermissionAlerts ?? {}),
                  ...(patch.deviceNotifications?.dismissedPermissionAlerts ?? {}),
                },
              },
              notificationCategories:
                patch.notificationCategories !== undefined ||
                old.custom_settings?.notificationCategories !== undefined
                  ? {
                      ...(old.custom_settings?.notificationCategories ?? {}),
                      ...(patch.notificationCategories ?? {}),
                    }
                  : undefined,
              emergencyFundConfig: patch.emergencyFundConfig !== undefined
                ? {
                    ...(old.custom_settings?.emergencyFundConfig ?? {}),
                    ...patch.emergencyFundConfig,
                  }
                : old.custom_settings?.emergencyFundConfig,
              dashboardAlertDismissals: patch.dashboardAlertDismissals !== undefined
                ? {
                    ...(old.custom_settings?.dashboardAlertDismissals ?? {}),
                    ...patch.dashboardAlertDismissals,
                    goals: {
                      ...(old.custom_settings?.dashboardAlertDismissals?.goals ?? {}),
                      ...(patch.dashboardAlertDismissals?.goals ?? {}),
                    },
                    cards: {
                      ...(old.custom_settings?.dashboardAlertDismissals?.cards ?? {}),
                      ...(patch.dashboardAlertDismissals?.cards ?? {}),
                    },
                  }
                : old.custom_settings?.dashboardAlertDismissals,
              portfolioAlertDismissals: patch.portfolioAlertDismissals !== undefined
                ? {
                    ...(old.custom_settings?.portfolioAlertDismissals ?? {}),
                    ...patch.portfolioAlertDismissals,
                  }
                : old.custom_settings?.portfolioAlertDismissals,
              dividendAutomation: patch.dividendAutomation !== undefined
                ? {
                    ...(old.custom_settings?.dividendAutomation ?? {}),
                    ...patch.dividendAutomation,
                  }
                : old.custom_settings?.dividendAutomation,
              advisorDismissals: mergePersistedAdvisorDismissals(
                old.custom_settings?.advisorDismissals,
                patch.advisorDismissals,
              ),
              advisorDecayMeta:
                patch.advisorDecayMeta !== undefined
                  ? {
                      ...(old.custom_settings?.advisorDecayMeta ?? {}),
                      ...patch.advisorDecayMeta,
                    }
                  : old.custom_settings?.advisorDecayMeta,
            },
          };
        });
      }
      return { previous, targetKey };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.targetKey, context.previous);
      }
      pushToast({
        title: "Não foi possível salvar as configurações na nuvem",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: USER_PREFERENCES_KEY });
    },
  });
}

export function useUpdateAppMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nextMode: AppMode) => updateAppMode(nextMode),
    onMutate: async (nextMode: AppMode) => {
      const targetKey = userPreferencesQueryKey(getActiveUserId());
      await queryClient.cancelQueries({ queryKey: USER_PREFERENCES_KEY });
      const previous = queryClient.getQueryData<UserPreferences | null>(targetKey);
      if (previous) {
        queryClient.setQueryData<UserPreferences | null>(targetKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            app_mode: nextMode,
          };
        });
      }
      return { previous, targetKey };
    },
    onSuccess: (_data, nextMode) => {
      if (nextMode === "investor") {
        pushToast({
          title: "Módulo de Investimentos ativado",
          description: "Carteira de ativos, rebalanceamento e proventos agora estão disponíveis.",
          variant: "default",
        });
      } else {
        pushToast({
          title: "Modo Essencial ativado",
          description: "Visualização simplificada focada em contas, faturas e orçamentos do mês.",
          variant: "default",
        });
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.targetKey, context.previous);
      }
      pushToast({
        title: "Não foi possível alterar o modo de visualização",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: USER_PREFERENCES_KEY });
    },
  });
}

