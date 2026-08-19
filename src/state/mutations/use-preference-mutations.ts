import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateReminderPreferences,
  updateCustomSettings,
  type ReminderPreferencesInput,
} from "@/data/repositories/user-preferences";
import { userPreferencesKey } from "@/state/queries/use-user-preferences";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import type { UserCustomSettings, UserPreferences } from "@/types";

export function useUpdateReminderPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReminderPreferencesInput) => updateReminderPreferences(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userPreferencesKey });
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
      await queryClient.cancelQueries({ queryKey: userPreferencesKey });
      const previous = queryClient.getQueryData<UserPreferences | null>(userPreferencesKey);
      if (previous) {
        queryClient.setQueryData<UserPreferences | null>(userPreferencesKey, (old) => {
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
            },
          };
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(userPreferencesKey, context.previous);
      }
      pushToast({
        title: "Não foi possível salvar as configurações na nuvem",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: userPreferencesKey });
    },
  });
}

