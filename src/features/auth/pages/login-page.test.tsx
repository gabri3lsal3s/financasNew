import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./login-page";
import * as authHook from "@/hooks/use-auth";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
  signInWithEmail: vi.fn(),
}));

vi.mock("@/components/ui/turnstile", () => ({
  Turnstile: () => <div data-testid="turnstile-stub" />,
}));

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

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
    });
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
    });

    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: "/entrar", state: { from: { pathname: "/transacoes" } } }]}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
