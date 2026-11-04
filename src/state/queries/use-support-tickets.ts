import { useQuery } from "@tanstack/react-query";
import {
  listAdminSupportTickets,
  listMySupportTickets,
  type SupportTicketFilter,
} from "@/data/repositories/support-tickets";
import { supportTicketsKey } from "@/state/mutations/use-support-mutations";
import type { SupportTicket } from "@/types";

/**
 * Hook para consulta administrativa de chamados de suporte.
 * Requer permissão de administrador/superadmin.
 */
export function useAdminSupportTickets(filter?: SupportTicketFilter) {
  return useQuery<SupportTicket[]>({
    queryKey: [
      ...supportTicketsKey,
      "admin",
      filter?.status ?? "all",
      filter?.type ?? "all",
    ],
    queryFn: () => listAdminSupportTickets(filter),
  });
}

/**
 * Hook para o próprio usuário consultar o histórico dos seus chamados e respostas.
 */
export function useMySupportTickets() {
  return useQuery<SupportTicket[]>({
    queryKey: [...supportTicketsKey, "my"],
    queryFn: () => listMySupportTickets(),
  });
}

