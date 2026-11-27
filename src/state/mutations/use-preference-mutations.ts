import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  mergeCustomSettings,
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
      const uid = getActiveUserId();
      const targetKey = userPreferencesQueryKey(uid);
      if (!uid) {
        return { uid: null, previous: undefined, targetKey };
      }
      await queryClient.cancelQueries({ queryKey: targetKey });
      const previous = queryClient.getQueryData<UserPreferences | null | undefined>(targetKey);
      if (previous) {
        queryClient.setQueryData<UserPreferences | null>(targetKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            custom_settings: mergeCustomSettings(old.custom_settings, patch),
          };
        });
      } else if (previous === null) {
        // Perfil conhecido como ausente no banco: sintetiza preferências padrão sem fabricar consentimentos
        queryClient.setQueryData<UserPreferences | null>(targetKey, () => ({
          user_id: uid,
          theme: "system",
          app_mode: "investor",
          reminders_enabled: false,
          reminder_days_before_debt: 3,
          reminder_days_before_bill: 3,
          report_weights_enabled: false,
          max_sector_acoes: null,
          max_sector_fiis: null,
          custom_settings: mergeCustomSettings({}, patch),
        }));
      }
      return { uid, previous, targetKey };
    },
    onError: (error, _variables, context) => {
      if (context?.uid && getActiveUserId() === context.uid && context.previous !== undefined) {
        queryClient.setQueryData(context.targetKey, context.previous);
      }
      pushToast({
        title: "Não foi possível salvar as configurações na nuvem",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.uid && getActiveUserId() === context.uid) {
        void queryClient.invalidateQueries({ queryKey: context.targetKey });
      }
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

