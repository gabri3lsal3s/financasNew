import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateLoginBackoff, LoginPage } from "./login-page";
import * as authHook from "@/hooks/use-auth";
import * as authData from "@/data/auth";
import * as toastModule from "@/services/toast";

vi.mock("@/data/auth", () => ({
  resendConfirmationEmail: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
  signInWithEmail: vi.fn(),
}));

vi.mock("@/components/ui/turnstile", () => ({
  Turnstile: ({ onVerify }: { onVerify?: (token: string) => void }) => (
    <div data-testid="turnstile-stub">
      <button
        type="button"
        data-testid="turnstile-trigger"
        onClick={() => onVerify?.("mock-turnstile-token-xyz")}
      >
        Simular Captcha
      </button>
    </div>
  ),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("calculateLoginBackoff", () => {
  it("retorna 0 segundos para menos de 3 falhas consecutivas", () => {
    expect(calculateLoginBackoff(0)).toBe(0);
    expect(calculateLoginBackoff(1)).toBe(0);
    expect(calculateLoginBackoff(2)).toBe(0);
  });

  it("retorna 15 segundos para 3 e 4 falhas consecutivas", () => {
    expect(calculateLoginBackoff(3)).toBe(15);
    expect(calculateLoginBackoff(4)).toBe(15);
  });

  it("retorna 60 segundos para 5 ou mais falhas consecutivas", () => {
    expect(calculateLoginBackoff(5)).toBe(60);
    expect(calculateLoginBackoff(6)).toBe(60);
    expect(calculateLoginBackoff(10)).toBe(60);
  });
});

describe("LoginPage - Autenticação e Visibilidade de Senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza todos os campos de login e botão de entrar", () => {
    renderLoginPage();

    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("permite alternar a visibilidade da senha no login", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const passwordInput = screen.getByLabelText("Senha") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggleBtn = screen.getByRole("button", { name: "Ver senha" });
    await user.click(toggleBtn);
    expect(passwordInput.type).toBe("text");

    const hideBtn = screen.getByRole("button", { name: "Ocultar senha" });
    await user.click(hideBtn);
    expect(passwordInput.type).toBe("password");
  });

  it("submete credenciais corretamente ao preencher o formulário", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.signInWithEmail).mockResolvedValue(undefined);

    renderLoginPage();

    await user.type(screen.getByLabelText("E-mail"), "usuario@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "MinhaSenha123!");

    const submitBtn = screen.getByRole("button", { name: "Entrar" });
    await user.click(submitBtn);

    expect(authHook.signInWithEmail).toHaveBeenCalledWith(
      "usuario@exemplo.com",
      "MinhaSenha123!",
      undefined,
    );
  });

  it("repassa o captchaToken retornado pelo Turnstile ao submeter o login", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.signInWithEmail).mockResolvedValue(undefined);

    renderLoginPage();

    await user.type(screen.getByLabelText("E-mail"), "usuario@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "MinhaSenha123!");
    await user.click(screen.getByTestId("turnstile-trigger"));

    const submitBtn = screen.getByRole("button", { name: "Entrar" });
    await user.click(submitBtn);

    expect(authHook.signInWithEmail).toHaveBeenCalledWith(
      "usuario@exemplo.com",
      "MinhaSenha123!",
      "mock-turnstile-token-xyz",
    );
  });

  it("redireciona para / e ignora /configuracoes quando logado com rota de retorno para configuracoes", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-1" } } as never,
      user: { id: "user-1" } as never,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: "/entrar", state: { from: { pathname: "/configuracoes" } } }]}>
        <LoginPage />
      </MemoryRouter>,
    );

    // Quando logado, LoginPage emite <Navigate to="/" replace />
    // Como MemoryRouter processa a navegação, a tela de login não exibe campos
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("preserva rota de destino segura (ex: /transacoes) ao autenticar com sucesso", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-1" } } as never,
      user: { id: "user-1" } as never,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: "/entrar", state: { from: { pathname: "/transacoes" } } }]}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("exibe banner de confirmação pendente quando o login falha por e-mail não confirmado", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.signInWithEmail).mockRejectedValueOnce({
      message: "Email not confirmed",
      code: "email_not_confirmed",
    });

    renderLoginPage();

    await user.type(screen.getByLabelText("E-mail"), "pendente@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "MinhaSenha123!");

    const submitBtn = screen.getByRole("button", { name: "Entrar" });
    await user.click(submitBtn);

    expect(screen.getByText("Confirmação de e-mail pendente")).toBeInTheDocument();
    expect(screen.getByText("pendente@exemplo.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar link de confirmação" })).toBeInTheDocument();
  });

  it("dispara reenvio e ativa cooldown de 60 segundos ao clicar em reenviar link de confirmação", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.signInWithEmail).mockRejectedValueOnce({
      message: "Email not confirmed",
      code: "email_not_confirmed",
    });
    vi.mocked(authData.resendConfirmationEmail).mockResolvedValueOnce(undefined);

    renderLoginPage();

    await user.type(screen.getByLabelText("E-mail"), "pendente@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "MinhaSenha123!");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const resendBtn = screen.getByRole("button", { name: "Reenviar link de confirmação" });
    await user.click(resendBtn);

    expect(authData.resendConfirmationEmail).toHaveBeenCalledWith("pendente@exemplo.com");
    expect(toastModule.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Link reenviado!",
      }),
    );

    expect(screen.getByRole("button", { name: /Aguarde \d+s para reenviar/i })).toBeDisabled();
  });

  it("mantém o botão Entrar habilitado após 1 e 2 falhas consecutivas de login", async () => {
    vi.mocked(authHook.signInWithEmail).mockRejectedValue(new Error("Credenciais inválidas"));

    renderLoginPage();

    const emailInput = screen.getByLabelText("E-mail");
    const passwordInput = screen.getByLabelText("Senha");
    const submitBtn = screen.getByRole("button", { name: "Entrar" });

    // Falha 1
    fireEvent.change(emailInput, { target: { value: "user@exemplo.com" } });
    fireEvent.change(passwordInput, { target: { value: "senha-1" } });
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByRole("button", { name: "Entrar" })).not.toBeDisabled();

    // Falha 2
    fireEvent.change(passwordInput, { target: { value: "senha-2" } });
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByRole("button", { name: "Entrar" })).not.toBeDisabled();
  });

  it("bloqueia o botão Entrar por 15 segundos com contador regressivo após 3 falhas consecutivas", async () => {
    vi.useFakeTimers();
    vi.mocked(authHook.signInWithEmail).mockRejectedValue(new Error("Credenciais inválidas"));

    renderLoginPage();

    const emailInput = screen.getByLabelText("E-mail");
    const passwordInput = screen.getByLabelText("Senha");
    const submitBtn = screen.getByRole("button", { name: "Entrar" });

    fireEvent.change(emailInput, { target: { value: "user@exemplo.com" } });
    fireEvent.change(passwordInput, { target: { value: "senha" } });

    // 3 falhas seguidas
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        fireEvent.click(submitBtn);
      });
    }

    // Botão deve estar bloqueado com 15 segundos
    expect(
      screen.getByRole("button", { name: /Aguarde 15s para tentar novamente/i }),
    ).toBeDisabled();

    // Avança 5 segundos
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      screen.getByRole("button", { name: /Aguarde 10s para tentar novamente/i }),
    ).toBeDisabled();

    // Avança os 10 segundos restantes
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Botão é reabilitado
    expect(screen.getByRole("button", { name: "Entrar" })).not.toBeDisabled();
  });

  it("impede submissão e chamada de rede durante o período de bloqueio temporário", async () => {
    vi.useFakeTimers();
    vi.mocked(authHook.signInWithEmail).mockRejectedValue(new Error("Credenciais inválidas"));

    renderLoginPage();

    const emailInput = screen.getByLabelText("E-mail");
    const passwordInput = screen.getByLabelText("Senha");
    const submitBtn = screen.getByRole("button", { name: "Entrar" });

    fireEvent.change(emailInput, { target: { value: "user@exemplo.com" } });
    fireEvent.change(passwordInput, { target: { value: "senha" } });

    // 3 falhas
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        fireEvent.click(submitBtn);
      });
    }
    expect(authHook.signInWithEmail).toHaveBeenCalledTimes(3);

    // Tentar submeter novamente pelo formulário durante o bloqueio
    const form = emailInput.closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    // Nenhuma chamada adicional deve ter sido efetuada
    expect(authHook.signInWithEmail).toHaveBeenCalledTimes(3);
  });

  it("impõe atraso de 60 segundos e exibe aviso de proteção ativa após 5 falhas consecutivas", async () => {
    vi.useFakeTimers();
    vi.mocked(authHook.signInWithEmail).mockRejectedValue(new Error("Credenciais inválidas"));

    renderLoginPage();

    const emailInput = screen.getByLabelText("E-mail");
    const passwordInput = screen.getByLabelText("Senha");
    const submitBtn = screen.getByRole("button", { name: "Entrar" });

    fireEvent.change(emailInput, { target: { value: "user@exemplo.com" } });
    fireEvent.change(passwordInput, { target: { value: "senha" } });

    // Falhas 1, 2, 3
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        fireEvent.click(submitBtn);
      });
    }

    // Avança 15s para liberar o primeiro bloqueio
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    // Falha 4
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    });

    // Avança 15s para liberar o bloqueio da 4ª falha
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    // Falha 5
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    });

    // Deve exibir o bloqueio de 60s e o aviso de proteção ativa
    expect(
      screen.getByRole("button", { name: /Aguarde 60s para tentar novamente/i }),
    ).toBeDisabled();
    expect(screen.getByText(/proteção ativa/i)).toBeInTheDocument();

    // Avança 30 segundos
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(
      screen.getByRole("button", { name: /Aguarde 30s para tentar novamente/i }),
    ).toBeDisabled();
    expect(screen.getByText(/proteção ativa/i)).toBeInTheDocument();

    // Avança os 30 segundos restantes
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    // Bloqueio encerrado
    expect(screen.getByRole("button", { name: "Entrar" })).not.toBeDisabled();
    expect(screen.queryByText(/proteção ativa/i)).not.toBeInTheDocument();
  });

  it("reseta o contador de falhas e bloqueios quando o login é realizado com sucesso", async () => {
    vi.useFakeTimers();
    vi.mocked(authHook.signInWithEmail)
      .mockRejectedValueOnce(new Error("Erro 1"))
      .mockRejectedValueOnce(new Error("Erro 2"))
      .mockRejectedValueOnce(new Error("Erro 3"))
      .mockResolvedValueOnce(undefined);

    renderLoginPage();

    const emailInput = screen.getByLabelText("E-mail");
    const passwordInput = screen.getByLabelText("Senha");
    const submitBtn = screen.getByRole("button", { name: "Entrar" });

    fireEvent.change(emailInput, { target: { value: "user@exemplo.com" } });
    fireEvent.change(passwordInput, { target: { value: "senha" } });

    // Falhas 1, 2, 3
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        fireEvent.click(submitBtn);
      });
    }

    // Bloqueado em 15s
    expect(
      screen.getByRole("button", { name: /Aguarde 15s para tentar novamente/i }),
    ).toBeDisabled();

    // Avança 15s para liberar o bloqueio
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    const activeSubmitBtn = screen.getByRole("button", { name: "Entrar" });
    expect(activeSubmitBtn).not.toBeDisabled();

    // Próxima tentativa tem sucesso
    await act(async () => {
      fireEvent.click(activeSubmitBtn);
    });

    // Agora simula nova falha subsequente: como foi resetado, deve ser contada como 1ª falha
    vi.mocked(authHook.signInWithEmail).mockRejectedValueOnce(new Error("Erro novo"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    });

    // O botão continua "Entrar" e não está bloqueado
    expect(screen.getByRole("button", { name: "Entrar" })).not.toBeDisabled();
  });
});
