import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSupportTicket,
  updateAdminSupportTicket,
  markTicketAsRead,
  type CreateSupportTicketInput,
} from "@/data/repositories/support-tickets";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import type { SupportTicketStatus } from "@/types";

export const supportTicketsKey = ["support_tickets"] as const;

/**
 * Hook de mutação para envio de chamados e mensagens de suporte / feedback.
 * Aciona feedback sensorial e toast explicativo de confirmação.
 */
export function useCreateSupportTicketMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSupportTicketInput) => createSupportTicket(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportTicketsKey });
      triggerSensory("success");
      pushToast({
        title: "Mensagem enviada!",
        description: "Retornaremos o contato em breve.",
        variant: "default",
      });
    },
    onError: (error) => {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível enviar a mensagem",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook de mutação administrativa para atualizar status, notas e enviar resposta ao usuário.
 */
export function useUpdateSupportTicketMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ticketId,
      patch,
    }: {
      ticketId: string;
      patch: {
        status?: SupportTicketStatus;
        admin_notes?: string | null;
        admin_reply?: string | null;
      };
    }) => updateAdminSupportTicket(ticketId, patch),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: supportTicketsKey });
      triggerSensory("success");
      pushToast({
        title: vars.patch.admin_reply ? "Resposta enviada!" : "Chamado atualizado",
        description: vars.patch.admin_reply
          ? "Sua resposta foi registrada e ficará disponível para o usuário no app."
          : "O status e notas do chamado foram salvos com sucesso.",
        variant: "default",
      });
    },
    onError: (error) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao atualizar chamado",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook de mutação para o usuário marcar um chamado respondido como lido.
 */
export function useMarkTicketAsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) => markTicketAsRead(ticketId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportTicketsKey });
      triggerSensory("selection");
    },
    onError: (error) => {
      pushToast({
        title: "Erro ao marcar como lido",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}


