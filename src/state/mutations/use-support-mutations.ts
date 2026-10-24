import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSupportTicket,
  updateAdminSupportTicket,
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
 * Hook de mutação administrativa para atualizar status e notas de chamados.
 */
export function useUpdateSupportTicketMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ticketId,
      patch,
    }: {
      ticketId: string;
      patch: { status?: SupportTicketStatus; admin_notes?: string | null };
    }) => updateAdminSupportTicket(ticketId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportTicketsKey });
      triggerSensory("success");
      pushToast({
        title: "Chamado atualizado",
        description: "O status e notas do chamado foram salvos com sucesso.",
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

