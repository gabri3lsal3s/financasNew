import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateAdminTelegramSettings,
  type UpdateTelegramSettingsInput,
} from "@/data/repositories/telegram-settings";

export type { UpdateTelegramSettingsInput };
import { telegramSettingsKey } from "@/state/queries/use-telegram-settings";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

export function useUpdateTelegramSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: UpdateTelegramSettingsInput) => updateAdminTelegramSettings(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: telegramSettingsKey });
      triggerSensory("selection");
      pushToast({
        title: "Preferências do Telegram salvas",
        description: "Os canais de alerta foram atualizados com sucesso.",
        variant: "default",
      });
    },
    onError: (error) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao salvar preferências",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}
