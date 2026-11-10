import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SplitOnboardingModal } from "./split-onboarding-modal";
import * as authHook from "@/hooks/use-auth";
import * as stateModule from "@/state";

vi.mock("@/hooks/use-auth");
vi.mock("@/state");

const mockedNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

function renderModal(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    guestShareCents: 4500,
    title: "Churrasco com Amigos",
    date: "2026-11-05",
    token: "tok12345",
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SplitOnboardingModal {...defaultProps} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SplitOnboardingModal", () => {
  const mockSaveSplit = vi.fn().mockResolvedValue("expense-new-id");

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(stateModule.useSaveSplitExpense).mockReturnValue({
      mutateAsync: mockSaveSplit,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useSaveSplitExpense>);
    vi.mocked(stateModule.useSignalSplitPayment).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useSignalSplitPayment>);
  });

  it("renderiza cabeçalho, resumo da despesa e formulário de auto-cadastro", () => {
    renderModal();

    expect(screen.getByText("Salvar no meu controle financeiro")).toBeInTheDocument();
    expect(screen.getByText("Churrasco com Amigos")).toBeInTheDocument();
    expect(screen.getByText(/05\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByText("R$ 45,00")).toBeInTheDocument();
    expect(screen.getByText("Auto-cadastro em 1 minuto")).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Crie uma senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar Conta e Salvar Despesa" })).toBeInTheDocument();
  });

  it("aciona deep link nativo ao clicar em 'Abrir no App'", async () => {
    const user = userEvent.setup();
    const originalLocation = window.location;
    const mockLocation = { ...originalLocation, href: "" };
    Object.defineProperty(window, "location", {
      value: mockLocation,
      writable: true,
      configurable: true,
    });

    renderModal();

    const openInAppBtn = screen.getByRole("button", { name: /Abrir despesa no aplicativo Axir instalado/i });
    await user.click(openInAppBtn);

    expect(mockLocation.href).toBe("com.guiafinanceiro.app://r/tok12345?action=save");
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("permite alternar entre modo de cadastro e login de usuário existente", async () => {
    const user = userEvent.setup();
    renderModal();

    const switchBtn = screen.getByRole("button", { name: "Já tenho conta" });
    await user.click(switchBtn);

    expect(screen.getByText("Acesse sua conta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar e Salvar Despesa" })).toBeInTheDocument();

    const switchBackBtn = screen.getByRole("button", { name: "Criar nova conta" });
    await user.click(switchBackBtn);

    expect(screen.getByText("Auto-cadastro em 1 minuto")).toBeInTheDocument();
  });

  it("valida campos obrigatórios no formulário de auto-cadastro", async () => {
    const user = userEvent.setup();
    renderModal();

    const submitBtn = screen.getByRole("button", { name: "Criar Conta e Salvar Despesa" });
    await user.click(submitBtn);

    expect(screen.getByText("Informe um endereço de e-mail válido.")).toBeInTheDocument();
  });

  it("cria conta via signUpWithEmail e salva despesa no dashboard quando sem confirmação", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    vi.mocked(authHook.signUpWithEmail).mockResolvedValueOnce({
      needsEmailConfirmation: false,
    });

    renderModal({ onOpenChange, onSuccess });

    await user.type(screen.getByLabelText(/E-mail/i), "novo@exemplo.com");
    await user.type(screen.getByPlaceholderText(/Crie uma senha/i), "senhaSegura123");

    const submitBtn = screen.getByRole("button", { name: "Criar Conta e Salvar Despesa" });
    await user.click(submitBtn);

    expect(authHook.signUpWithEmail).toHaveBeenCalledWith("novo@exemplo.com", "senhaSegura123", undefined);
    expect(mockSaveSplit).toHaveBeenCalledWith({
      title: "Churrasco com Amigos",
      amountCents: 4500,
      date: "2026-11-05",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
    expect(mockedNavigate).toHaveBeenCalledWith("/");
  });

  it("exibe mensagem amigável e persiste despesa em localStorage se confirmação de e-mail for exigida", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.signUpWithEmail).mockResolvedValueOnce({
      needsEmailConfirmation: true,
    });

    renderModal();

    await user.type(screen.getByLabelText(/E-mail/i), "confirme@exemplo.com");
    await user.type(screen.getByPlaceholderText(/Crie uma senha/i), "senhaSegura123");

    const submitBtn = screen.getByRole("button", { name: "Criar Conta e Salvar Despesa" });
    await user.click(submitBtn);

    expect(screen.getByText("Confirmação de e-mail enviada!")).toBeInTheDocument();
    expect(screen.getByText(/confirme@exemplo\.com/)).toBeInTheDocument();

    const storedRaw = localStorage.getItem("axis_pending_split_expense");
    expect(storedRaw).not.toBeNull();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed.amountCents).toBe(4500);
    expect(parsed.title).toBe("Churrasco com Amigos");
  });

  it("realiza login e salva despesa quando no modo de conta existente", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    vi.mocked(authHook.signInWithEmail).mockResolvedValueOnce();

    renderModal({ onOpenChange });

    // Alterna para modo login
    await user.click(screen.getByRole("button", { name: "Já tenho conta" }));

    await user.type(screen.getByLabelText(/E-mail/i), "existente@exemplo.com");
    await user.type(screen.getByPlaceholderText(/Sua senha/i), "minhaSenha123");

    const submitBtn = screen.getByRole("button", { name: "Entrar e Salvar Despesa" });
    await user.click(submitBtn);

    expect(authHook.signInWithEmail).toHaveBeenCalledWith("existente@exemplo.com", "minhaSenha123");
    expect(mockSaveSplit).toHaveBeenCalledWith({
      title: "Churrasco com Amigos",
      amountCents: 4500,
      date: "2026-11-05",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockedNavigate).toHaveBeenCalledWith("/");
  });
});
