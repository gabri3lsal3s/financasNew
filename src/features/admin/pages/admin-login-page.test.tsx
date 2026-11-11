import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "./admin-login-page";

const mockSignInAdmin = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: null }),
  signInAdmin: (...args: unknown[]) => mockSignInAdmin(...args),
}));

vi.mock("@/state", () => ({
  useUserAccess: () => ({
    isAdmin: false,
    isLoading: false,
  }),
}));

vi.mock("@/components/ui/turnstile", () => ({
  Turnstile: ({ onVerify }: { onVerify: (token: string) => void }) => {
    return (
      <div data-testid="turnstile-mock">
        <button type="button" onClick={() => onVerify("dummy-token")}>
          Verificar Turnstile
        </button>
      </div>
    );
  },
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("AdminLoginPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o formulário de login administrativo com branding seguro", () => {
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Console Administrativo")).toBeInTheDocument();
    expect(screen.getByText("Axir Command Center")).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail Administrativo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha de Acesso/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Entrar no Console/i }),
    ).toBeInTheDocument();
  });

  it("rejeita login se a conta não possuir papel administrativo ativo", async () => {
    const user = userEvent.setup();

    mockSignInAdmin.mockRejectedValueOnce(
      new Error(
        "Acesso restrito: Esta conta não possui privilégios de operador administrativo para acessar o Console da Plataforma.",
      ),
    );

    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/E-mail Administrativo/i);
    const passwordInput = screen.getByLabelText(/Senha de Acesso/i);
    const submitBtn = screen.getByRole("button", { name: /Entrar no Console/i });

    await user.type(emailInput, "usuario@comum.com");
    await user.type(passwordInput, "senha12345");
    await user.click(submitBtn);

    expect(mockSignInAdmin).toHaveBeenCalledWith("usuario@comum.com", "senha12345");
    expect(
      await screen.findByText(/Esta conta não possui privilégios de operador administrativo/i),
    ).toBeInTheDocument();
  });
});
