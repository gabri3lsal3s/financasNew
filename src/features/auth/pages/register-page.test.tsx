import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "./register-page";
import * as authHook from "@/hooks/use-auth";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
  signUpWithEmail: vi.fn(),
}));

vi.mock("@/components/ui/turnstile", () => ({
  Turnstile: () => <div data-testid="turnstile-stub" />,
}));

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

describe("RegisterPage - Validação em Tempo Real e Requisitos de Senha", () => {
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

  it("renderiza todos os campos de formulário e botão de ação", () => {
    renderRegisterPage();

    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Código de Convite")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeInTheDocument();
  });

  it("exibe o checklist de requisitos de senha e altera a força da senha em tempo real", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const passwordInput = screen.getByLabelText("Senha");
    expect(screen.queryByText("Mínimo 8 caracteres")).not.toBeInTheDocument();

    // Digita senha fraca
    await user.type(passwordInput, "abc");
    expect(screen.getByText("Fraca")).toBeInTheDocument();
    expect(screen.getByText("Mínimo 8 caracteres")).toBeInTheDocument();

    // Digita senha média (com números e tamanho)
    await user.clear(passwordInput);
    await user.type(passwordInput, "Senha123");
    expect(screen.getByText("Média")).toBeInTheDocument();

    // Digita senha forte (com símbolo especial)
    await user.clear(passwordInput);
    await user.type(passwordInput, "Senha123#");
    expect(screen.getByText("Forte")).toBeInTheDocument();
  });

  it("permite alternar a visibilidade da senha entre texto e senha oculta", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const passwordInput = screen.getByLabelText("Senha") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggleBtn = screen.getByRole("button", { name: "Ver senha" });
    await user.click(toggleBtn);
    expect(passwordInput.type).toBe("text");

    const hideBtn = screen.getByRole("button", { name: "Ocultar senha" });
    await user.click(hideBtn);
    expect(passwordInput.type).toBe("password");
  });

  it("dispara o cadastro com sucesso ao preencher formulário válido", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.signUpWithEmail).mockResolvedValue({
      needsEmailConfirmation: false,
    });

    renderRegisterPage();

    await user.type(screen.getByLabelText("Nome"), "Gabriel");
    await user.type(screen.getByLabelText("E-mail"), "gabriel@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "MinhaSenhaForte123!");

    const submitBtn = screen.getByRole("button", { name: "Criar conta" });
    await user.click(submitBtn);

    expect(authHook.signUpWithEmail).toHaveBeenCalledWith(
      "gabriel@exemplo.com",
      "MinhaSenhaForte123!",
      "Gabriel",
      "",
    );
  });

  it("exibe alerta com botões de ação para login e recuperação de senha quando o e-mail já existe", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.signUpWithEmail).mockRejectedValueOnce({
      message: "User already registered",
      code: "user_already_exists",
    });

    renderRegisterPage();

    await user.type(screen.getByLabelText("Nome"), "Gabriel");
    await user.type(screen.getByLabelText("E-mail"), "existente@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "MinhaSenhaForte123!");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(screen.getByText("Este e-mail já está cadastrado na plataforma.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fazer login agora/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Recuperar minha senha/i })).toBeInTheDocument();
  });

  it("exibe links de ação ao receber erro bruto do Supabase com code user_already_exists", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.signUpWithEmail).mockRejectedValueOnce({
      message: "Database error saving new user",
      code: "user_already_exists",
    });

    renderRegisterPage();

    await user.type(screen.getByLabelText("Nome"), "Gabriel");
    await user.type(screen.getByLabelText("E-mail"), "existente@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "MinhaSenhaForte123!");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(screen.getByRole("link", { name: /Fazer login agora/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Recuperar minha senha/i })).toBeInTheDocument();
  });

  it("não exibe links de ação para login quando o erro for de outra natureza (ex: rede)", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.signUpWithEmail).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderRegisterPage();

    await user.type(screen.getByLabelText("Nome"), "Gabriel");
    await user.type(screen.getByLabelText("E-mail"), "novo@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "MinhaSenhaForte123!");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(screen.queryByRole("link", { name: /Fazer login agora/i })).not.toBeInTheDocument();
  });

  it("exibe tela de sucesso de onboarding quando o cadastro exige confirmação de e-mail", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.signUpWithEmail).mockResolvedValueOnce({
      needsEmailConfirmation: true,
    });

    renderRegisterPage();

    await user.type(screen.getByLabelText("Nome"), "Gabriel");
    await user.type(screen.getByLabelText("E-mail"), "confirmar@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "MinhaSenhaForte123!");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(screen.getByText("Confirme seu endereço de e-mail")).toBeInTheDocument();
    expect(screen.getByText("confirmar@exemplo.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ir para o login/i })).toBeInTheDocument();
  });
});
