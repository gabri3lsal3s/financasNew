import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateReminderPreferences,
  type ReminderPreferencesInput,
} from "@/data/repositories/user-preferences";
import { userPreferencesKey } from "@/state/queries/use-user-preferences";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";

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
