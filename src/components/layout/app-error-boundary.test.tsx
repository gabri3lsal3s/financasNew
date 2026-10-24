import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppErrorBoundary } from "./app-error-boundary";
import * as observability from "@/services/observability";

vi.mock("@/services/observability", () => ({
  reportError: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "user@teste.com" },
  }),
}));

vi.mock("@/state", () => ({
  useCreateSupportTicketMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// Componente que simula erro de renderização
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Erro simulado de renderização no componente");
  }
  return <div>Conteúdo renderizado com sucesso</div>;
}

describe("AppErrorBoundary — Resiliência Global contra Tela Branca", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suprime erro ruidoso no console do jsdom durante testes de ErrorBoundary
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renderiza os filhos normalmente quando não ocorrem erros", () => {
    renderWithClient(
      <AppErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Conteúdo renderizado com sucesso")).toBeInTheDocument();
  });

  it("captura exceção no componente filho e exibe a tela de erro sem quebrar a aplicação", () => {
    const onError = vi.fn();

    renderWithClient(
      <AppErrorBoundary onError={onError}>
        <ThrowingComponent shouldThrow={true} />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Algo inesperado aconteceu")).toBeInTheDocument();
    expect(
      screen.getByText(/Ocorreu um comportamento não previsto na aplicação/i),
    ).toBeInTheDocument();

    // Botões de ação do Design System
    expect(screen.getByRole("button", { name: /Tentar novamente/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recarregar Aplicativo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reportar ao Suporte/i })).toBeInTheDocument();

    // Reporta automaticamente ao Sentry
    expect(observability.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      }),
    );
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("permite resetar o estado ao clicar em Tentar novamente", async () => {
    const user = userEvent.setup();
    let throwError = true;

    function DynamicThrower() {
      if (throwError) {
        throw new Error("Erro passageiro");
      }
      return <div>Recuperado com sucesso!</div>;
    }

    renderWithClient(
      <AppErrorBoundary>
        <DynamicThrower />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Algo inesperado aconteceu")).toBeInTheDocument();

    // Corrige a condição do erro antes do retry
    throwError = false;

    const retryBtn = screen.getByRole("button", { name: /Tentar novamente/i });
    await user.click(retryBtn);

    expect(screen.getByText("Recuperado com sucesso!")).toBeInTheDocument();
  });

  it("dispara reload da página ao clicar em Recarregar Aplicativo", async () => {
    const user = userEvent.setup();
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, reload: reloadMock },
    });

    renderWithClient(
      <AppErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </AppErrorBoundary>,
    );

    const reloadBtn = screen.getByRole("button", { name: /Recarregar Aplicativo/i });
    await user.click(reloadBtn);

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("abre o diálogo de suporte pré-configurado com categoria Bug ao clicar em Reportar ao Suporte", async () => {
    const user = userEvent.setup();

    renderWithClient(
      <AppErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </AppErrorBoundary>,
    );

    const reportBtn = screen.getByRole("button", { name: /Reportar ao Suporte/i });
    await user.click(reportBtn);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(screen.getByText("Falar com o Suporte")).toBeInTheDocument();
    const bugTab = screen.getByRole("tab", { name: /Problema \(Bug\)/i });
    expect(bugTab).toHaveAttribute("data-state", "active");

    const messageTextarea = screen.getByRole("textbox", { name: /Mensagem detalhada/i }) as HTMLTextAreaElement;
    expect(messageTextarea.value).toContain("Erro simulado de renderização");
  });

  it("renderiza fallback customizado caso fornecido nas props", () => {
    renderWithClient(
      <AppErrorBoundary fallback={<div>Fallback alternativo customizado</div>}>
        <ThrowingComponent shouldThrow={true} />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Fallback alternativo customizado")).toBeInTheDocument();
    expect(screen.queryByText("Algo inesperado aconteceu")).not.toBeInTheDocument();
  });
});
