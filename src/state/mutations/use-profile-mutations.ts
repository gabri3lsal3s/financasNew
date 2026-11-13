import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOwnProfile } from "@/data/repositories/profiles";
import { deleteCurrentUserAccount } from "@/data/rpc";
import { cancelSubscription } from "@/data/repositories/billing";
import { USER_ACCESS_KEY } from "@/state/queries/use-user-access";
import { AppError, getErrorMessage } from "@/services/errors";
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

export function useDeleteAccountMutation() {
  return useMutation({
    mutationFn: async () => {
      try {
        await cancelSubscription();
      } catch (err: unknown) {
        // Se a assinatura falhar ao cancelar no Asaas, verificamos se o erro foi
        // ausência de assinatura ou falha real do gateway. Não podemos excluir a conta
        // se houver gateway ativo cobrando o cartão indefinidamente.
        const msg = err instanceof Error ? err.message : String(err);
        const isNotFound =
          msg.toLowerCase().includes("não localizada") ||
          msg.toLowerCase().includes("not found") ||
          msg.toLowerCase().includes("sem assinatura");

        if (!isNotFound) {
          throw new AppError(
            "network",
            "Não foi possível cancelar sua assinatura no gateway de pagamento. Para garantir que nenhuma cobrança futura seja efetuada no seu cartão, a exclusão da conta foi suspensa. Tente novamente em instantes ou contate o suporte.",
            err,
          );
        }
      }
      return deleteCurrentUserAccount();
    },
  });
}
