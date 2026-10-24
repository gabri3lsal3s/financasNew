import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TicketsTab } from "./tickets-tab";
import type { SupportTicket } from "@/types";

const mockTickets: SupportTicket[] = [
  {
    id: "ticket-001",
    user_id: "u-1",
    type: "bug",
    status: "open",
    subject: "Erro ao sincronizar saldo",
    message: "Ao importar o arquivo OFX, o saldo da conta Nubank divergiu em R$ 10,00.",
    user_name: "Mariana Costa",
    user_email: "mariana@teste.com",
    app_version: "1.0.0",
    current_route: "/transactions",
    device_info: { platform: "Android Nativo" },
    admin_notes: null,
    created_at: "2026-10-23T14:30:00Z",
    updated_at: "2026-10-23T14:30:00Z",
  },
  {
    id: "ticket-002",
    user_id: "u-2",
    type: "doubt",
    status: "in_progress",
    subject: "Como rebalancear ativos?",
    message: "Gostaria de saber como definir a meta de porcentagem por setor.",
    user_name: "Lucas Pereira",
    user_email: "lucas@teste.com",
    app_version: "1.0.0",
    current_route: "/investments",
    device_info: { platform: "Web" },
    admin_notes: "Respondido por e-mail com guia passo a passo.",
    created_at: "2026-10-22T10:00:00Z",
    updated_at: "2026-10-22T11:00:00Z",
  },
  {
    id: "ticket-003",
    user_id: "u-3",
    type: "suggestion",
    status: "resolved",
    subject: "Modo escuro OLED",
    message: "Seria excelente ter um preto puro para telas AMOLED.",
    user_name: "Ana Beatriz",
    user_email: "ana@teste.com",
    app_version: "1.0.0",
    current_route: "/settings",
    device_info: { platform: "PWA Instalado" },
    admin_notes: "Adicionado ao backlog do Design System.",
    created_at: "2026-10-20T09:00:00Z",
    updated_at: "2026-10-21T09:00:00Z",
  },
];

const mockMutateAsync = vi.fn();
let mockQueryReturn = {
  data: mockTickets,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

vi.mock("@/state", () => ({
  useAdminSupportTickets: () => mockQueryReturn,
  useUpdateSupportTicketMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe("TicketsTab — Gestão Administrativa de Chamados de Suporte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryReturn = {
      data: mockTickets,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
  });

  it("renderiza os cards de métricas no topo e a lista completa de chamados", () => {
    render(<TicketsTab />);

    // Métricas
    expect(screen.getByText("Total Recebidos")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Abertos")).toBeInTheDocument();
    expect(screen.getAllByText("Em Atendimento").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Resolvidos")).toBeInTheDocument();

    // Chamados na lista
    expect(screen.getByText("Mariana Costa")).toBeInTheDocument();
    expect(screen.getByText("mariana@teste.com")).toBeInTheDocument();
    expect(screen.getByText(/Ao importar o arquivo OFX/i)).toBeInTheDocument();

    expect(screen.getByText("Lucas Pereira")).toBeInTheDocument();
    expect(screen.getByText(/Gostaria de saber como definir a meta/i)).toBeInTheDocument();
    expect(screen.getByText(/Respondido por e-mail com guia passo a passo/i)).toBeInTheDocument();

    expect(screen.getByText("Ana Beatriz")).toBeInTheDocument();
    expect(screen.getByText(/Seria excelente ter um preto puro/i)).toBeInTheDocument();
  });

  it("filtra chamados pela busca textual", async () => {
    const user = userEvent.setup();
    render(<TicketsTab />);

    const searchInput = screen.getByPlaceholderText(/Buscar por cliente, e-mail ou mensagem/i);
    await user.type(searchInput, "Nubank");

    expect(screen.getByText("Mariana Costa")).toBeInTheDocument();
    expect(screen.queryByText("Lucas Pereira")).not.toBeInTheDocument();
    expect(screen.queryByText("Ana Beatriz")).not.toBeInTheDocument();
  });

  it("filtra chamados pelo status", async () => {
    const user = userEvent.setup();
    render(<TicketsTab />);

    const statusSelect = screen.getByRole("combobox", { name: "Filtrar por status" });
    await user.click(statusSelect);

    const inProgressOption = screen.getByRole("option", { name: "Em Atendimento" });
    await user.click(inProgressOption);

    expect(screen.queryByText("Mariana Costa")).not.toBeInTheDocument();
    expect(screen.getByText("Lucas Pereira")).toBeInTheDocument();
    expect(screen.queryByText("Ana Beatriz")).not.toBeInTheDocument();
  });

  it("exibe estado de carregamento com Skeletons", () => {
    mockQueryReturn = {
      data: [],
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    };

    const { container } = render(<TicketsTab />);
    expect(container.querySelectorAll(".animate-shimmer").length).toBeGreaterThan(0);
  });

  it("exibe estado de erro e permite acionar retry", async () => {
    const user = userEvent.setup();
    const mockRefetch = vi.fn();
    mockQueryReturn = {
      data: [],
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    };

    render(<TicketsTab />);

    expect(screen.getByText("Não foi possível carregar os chamados")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /Tentar novamente/i });
    await user.click(retryBtn);

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("exibe empty state calmo quando não há nenhum chamado cadastrado", () => {
    mockQueryReturn = {
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };

    render(<TicketsTab />);

    expect(screen.getByText("Nenhum chamado recebido até o momento")).toBeInTheDocument();
  });

  it("abre o diálogo de atendimento ao clicar em Atender Chamado e submete atualização", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ id: "ticket-001" });

    render(<TicketsTab />);

    const attendButtons = screen.getAllByRole("button", { name: /Atender Chamado/i });
    await user.click(attendButtons[0]!);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Atendimento do Chamado")).toBeInTheDocument();
    expect(within(dialog).getByText("Mariana Costa")).toBeInTheDocument();

    const notesTextarea = screen.getByRole("textbox", {
      name: /Notas Internas da Equipe/i,
    });
    await user.type(notesTextarea, "Investigado e corrigido no extrato.");

    const saveBtn = screen.getByRole("button", { name: /Salvar Alterações/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: "ticket-001",
          patch: expect.objectContaining({
            admin_notes: "Investigado e corrigido no extrato.",
          }),
        }),
      );
    });
  });
});
