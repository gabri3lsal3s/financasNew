import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOwnProfile } from "@/data/repositories/profiles";
import { USER_ACCESS_KEY } from "@/state/queries/use-user-access";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, name }: { userId: string; name: string }) =>
      updateOwnProfile(userId, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USER_ACCESS_KEY });
      triggerSensory("success");
      pushToast({
        title: "Perfil atualizado",
        description: "Seu nome foi alterado com sucesso.",
        variant: "success",
      });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível atualizar o perfil",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}
