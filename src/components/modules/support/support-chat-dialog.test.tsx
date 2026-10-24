import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupportChatDialog } from "./support-chat-dialog";

const mockMutateAsync = vi.fn();

vi.mock("@/state", () => ({
  useCreateSupportTicketMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: {
      id: "usr-123",
      email: "cliente.teste@exemplo.com",
      user_metadata: { name: "Cliente Teste" },
    },
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("SupportChatDialog — Componente de UI de Suporte Nativo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o modal quando aberto com título e descrição do Design System", () => {
    renderWithClient(
      <SupportChatDialog open={true} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Falar com o Suporte")).toBeInTheDocument();
    expect(
      screen.getByText(/Envie sua dúvida, sugestão ou relate um problema para atendimento direto/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Dúvida/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Problema \(Bug\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Sugestão/i })).toBeInTheDocument();
  });

  it("não renderiza nada quando open é false", () => {
    renderWithClient(
      <SupportChatDialog open={false} onOpenChange={vi.fn()} />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("inicia com o tipo e mensagem padrão fornecidos", () => {
    renderWithClient(
      <SupportChatDialog
        open={true}
        onOpenChange={vi.fn()}
        defaultType="bug"
        initialMessage="Falha ao carregar gráfico"
      />,
    );

    const textarea = screen.getByRole("textbox", { name: /Mensagem detalhada/i });
    expect(textarea).toHaveValue("Falha ao carregar gráfico");

    const bugTab = screen.getByRole("tab", { name: /Problema \(Bug\)/i });
    expect(bugTab).toHaveAttribute("data-state", "active");
  });

  it("permite alternar abas de tipo de atendimento", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <SupportChatDialog open={true} onOpenChange={vi.fn()} />,
    );

    const suggestionTab = screen.getByRole("tab", { name: /Sugestão/i });
    await user.click(suggestionTab);

    expect(suggestionTab).toHaveAttribute("data-state", "active");
  });

  it("mantém o botão de envio desabilitado se a mensagem tiver menos de 5 caracteres", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <SupportChatDialog open={true} onOpenChange={vi.fn()} />,
    );

    const sendBtn = screen.getByRole("button", { name: /Enviar Mensagem/i });
    expect(sendBtn).toBeDisabled();

    const textarea = screen.getByRole("textbox", { name: /Mensagem detalhada/i });
    await user.type(textarea, "Oi");

    expect(sendBtn).toBeDisabled();
    expect(screen.getByText("2 / 1000")).toBeInTheDocument();
  });

  it("submete o chamado com sucesso enviando tipo, assunto, mensagem e metadados", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    mockMutateAsync.mockResolvedValueOnce({ id: "ticket-xyz-123" });

    renderWithClient(
      <SupportChatDialog
        open={true}
        onOpenChange={onOpenChange}
        defaultType="suggestion"
        currentRoute="/investments"
        onSuccess={onSuccess}
      />,
    );

    const subjectInput = screen.getByRole("textbox", { name: /Assunto \(opcional\)/i });
    await user.type(subjectInput, "Gráficos de Rentabilidade");

    const textarea = screen.getByRole("textbox", { name: /Mensagem detalhada/i });
    await user.type(textarea, "Gostaria de ver o histórico mensal consolidado.");

    const sendBtn = screen.getByRole("button", { name: /Enviar Mensagem/i });
    expect(sendBtn).toBeEnabled();

    await user.click(sendBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "suggestion",
        subject: "Gráficos de Rentabilidade",
        message: "Gostaria de ver o histórico mensal consolidado.",
        user_name: "Cliente Teste",
        user_email: "cliente.teste@exemplo.com",
        current_route: "/investments",
        app_version: "1.0.0",
        device_info: expect.any(Object),
      }),
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("fecha o diálogo ao clicar em Cancelar", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWithClient(
      <SupportChatDialog open={true} onOpenChange={onOpenChange} />,
    );

    const cancelBtn = screen.getByRole("button", { name: /Cancelar/i });
    await user.click(cancelBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
