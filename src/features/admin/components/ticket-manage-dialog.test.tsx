import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketManageDialog } from "./ticket-manage-dialog";
import type { SupportTicket } from "@/types";

const mockMutateAsync = vi.fn();

vi.mock("@/state", () => ({
  useUpdateSupportTicketMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

const mockTicket: SupportTicket = {
  id: "ticket-12345678",
  user_id: "user-1",
  type: "bug",
  status: "open",
  subject: "Erro ao exportar",
  message: "Ao clicar em exportar ocorre timeout.",
  user_email: "cliente@axir.app",
  user_name: "Ana Costa",
  app_version: "3.10.0",
  current_route: "/relatorios",
  device_info: { platform: "Navegador Web" },
  admin_notes: "Investigar fila",
  admin_reply: "",
  created_at: "2026-10-10T10:00:00Z",
  updated_at: "2026-10-10T10:00:00Z",
};

describe("TicketManageDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(undefined);
  });

  it("renderiza os detalhes do chamado e envia atualização ao salvar", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TicketManageDialog ticket={mockTicket} open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByRole("heading", { name: "Atendimento do Chamado" })).toBeInTheDocument();
    expect(screen.getByText("Ana Costa")).toBeInTheDocument();
    expect(screen.getByText("Ao clicar em exportar ocorre timeout.")).toBeInTheDocument();

    const replyField = screen.getByLabelText(/Resposta Oficial ao Usuário/i);
    await user.type(replyField, "Corrigido na versão atual.");

    await user.click(screen.getByRole("button", { name: /Salvar e Enviar/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      ticketId: "ticket-12345678",
      patch: {
        status: "open",
        admin_notes: "Investigar fila",
        admin_reply: "Corrigido na versão atual.",
      },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
