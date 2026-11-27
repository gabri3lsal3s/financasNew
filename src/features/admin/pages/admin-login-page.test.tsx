import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "./admin-login-page";

const mockSignInAdmin = vi.fn();
const mockUseAuth = vi.fn();
const mockUseUserAccess = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
  signInAdmin: (...args: unknown[]) => mockSignInAdmin(...args),
}));

vi.mock("@/state", () => ({
  useUserAccess: () => mockUseUserAccess(),
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
    mockUseAuth.mockReturnValue({ session: null, mfaRequired: false, mfaVerified: false });
    mockUseUserAccess.mockReturnValue({ isAdmin: false, isLoading: false });
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

  it("encaminha admin autenticado em AAL1 para /entrar?desafio=totp quando mfaRequired for true e mfaVerified for false", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "admin-1" } },
      mfaRequired: true,
      mfaVerified: false,
    });
    mockUseUserAccess.mockReturnValue({ isAdmin: true, isLoading: false });

    render(
      <MemoryRouter initialEntries={["/admin/login"]}>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/dashboard" element={<div>Dashboard Admin</div>} />
          <Route path="/entrar" element={<div>Tela de Desafio TOTP</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Dashboard Admin")).not.toBeInTheDocument();
    expect(screen.getByText("Tela de Desafio TOTP")).toBeInTheDocument();
  });

  it("redireciona imediatamente para /entrar?desafio=totp após signInAdmin retornar mfaRequired: true", async () => {
    const user = userEvent.setup();
    mockSignInAdmin.mockResolvedValueOnce({
      id: "admin-1",
      role: "superadmin",
      mfaRequired: true,
    });

    render(
      <MemoryRouter initialEntries={["/admin/login"]}>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/entrar" element={<div>Tela de Desafio TOTP</div>} />
          <Route path="/admin/dashboard" element={<div>Dashboard Admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/E-mail Administrativo/i), "admin@axir.com.br");
    await user.type(screen.getByLabelText(/Senha de Acesso/i), "senha12345");
    await user.click(screen.getByRole("button", { name: /Entrar no Console/i }));

    expect(await screen.findByText("Tela de Desafio TOTP")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Admin")).not.toBeInTheDocument();
  });
});
