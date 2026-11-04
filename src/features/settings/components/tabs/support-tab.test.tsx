import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupportTab } from "./support-tab";
import type { SupportTicket } from "@/types";

const mockUseMySupportTickets = vi.fn();
const mockMutateMarkAsRead = vi.fn();

vi.mock("@/state", () => ({
  useMySupportTickets: () => mockUseMySupportTickets(),
  useMarkTicketAsReadMutation: () => ({
    mutate: mockMutateMarkAsRead,
    isPending: false,
  }),
}));

vi.mock("@/components/modules/support/support-chat-modal", () => ({
  SupportChatModal: ({ open }: { open: boolean }) => (
    open ? <div data-testid="support-chat-modal">Modal de Suporte</div> : null
  ),
}));

describe("SupportTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza empty state quando o usuário não possui chamados", () => {
    mockUseMySupportTickets.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<SupportTab />);

    expect(screen.getByText("Nenhum chamado aberto")).toBeInTheDocument();
    expect(screen.getByText("Novo Chamado")).toBeInTheDocument();
  });

  it("renderiza chamados com resposta do suporte e botão para marcar como lida", () => {
    const ticketWithReply: SupportTicket = {
      id: "ticket-123",
      user_id: "user-1",
      user_name: "Gabriel",
      user_email: "gabriel@teste.com",
      type: "doubt",
      subject: "Dúvida sobre faturas",
      message: "Como faço para lançar uma fatura antecipada?",
      status: "resolved",
      admin_notes: null,
      admin_reply: "Olá Gabriel! Basta acessar a aba de Cartões e clicar em Pagar Antecipado.",
      admin_replied_at: "2026-08-20T14:00:00Z",
      user_read_at: null,
      admin_id: "admin-1",
      app_version: "2.84",
      current_route: "/cartoes",
      device_info: {},
      created_at: "2026-08-20T10:00:00Z",
      updated_at: "2026-08-20T14:00:00Z",
    };

    mockUseMySupportTickets.mockReturnValue({
      data: [ticketWithReply],
      isLoading: false,
    });

    render(<SupportTab />);

    expect(screen.getByText("Dúvida sobre faturas")).toBeInTheDocument();
    expect(screen.getByText(/Como faço para lançar uma fatura antecipada/)).toBeInTheDocument();
    expect(screen.getByText(/Basta acessar a aba de Cartões/)).toBeInTheDocument();
    expect(screen.getByText("Nova Resposta")).toBeInTheDocument();

    const markBtn = screen.getByText("Marcar como lida");
    fireEvent.click(markBtn);

    expect(mockMutateMarkAsRead).toHaveBeenCalledWith("ticket-123");
  });
});
