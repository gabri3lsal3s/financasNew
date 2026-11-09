import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "./admin-login-page";

const mockSignInWithEmail = vi.fn();
const mockSignOut = vi.fn();
const mockSupabaseGetUser = vi.fn();
const mockSupabaseMaybeSingle = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: null }),
  signInWithEmail: (...args: unknown[]) => mockSignInWithEmail(...args),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({ signOut: mockSignOut }),
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

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    auth: {
      getUser: mockSupabaseGetUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockSupabaseMaybeSingle,
        }),
      }),
    }),
  }),
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
    expect(screen.getByText("Áxis Command Center")).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail Administrativo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha de Acesso/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Entrar no Console/i }),
    ).toBeInTheDocument();
  });

  it("rejeita login se a conta não possuir papel administrativo ativo", async () => {
    const user = userEvent.setup();

    mockSignInWithEmail.mockResolvedValueOnce({ user: { id: "u-regular" } });
    mockSupabaseGetUser.mockResolvedValueOnce({
      data: { user: { id: "u-regular" } },
    });
    mockSupabaseMaybeSingle.mockResolvedValueOnce({
      data: { role: "user", status: "active" },
      error: null,
    });

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

    expect(mockSignInWithEmail).toHaveBeenCalledWith("usuario@comum.com", "senha12345");
    expect(mockSignOut).toHaveBeenCalled();
    expect(
      await screen.findByText(/Esta conta não possui privilégios de operador administrativo/i),
    ).toBeInTheDocument();
  });
});
