import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireAuth } from "./require-auth";

const mockRefreshMfaState = vi.fn();
const mockClearGlobalAuthSession = vi.fn();
const mockSignOut = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
  refreshMfaState: () => mockRefreshMfaState(),
  clearGlobalAuthSession: () => mockClearGlobalAuthSession(),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
  }),
}));

vi.mock("@/state/queries/use-session-bootstrap", () => ({
  useSessionBootstrap: () => ({
    data: {},
    isLoading: false,
    isPending: false,
    isFetching: false,
    error: null,
  }),
}));

vi.mock("@/state/queries/use-user-access", () => ({
  useUserAccess: () => ({
    isLoading: false,
    error: null,
    hasFeature: () => false,
  }),
}));

vi.mock("@/state", () => ({
  useRegisterFcmToken: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-device-session-sync", () => ({
  useDeviceSessionSync: vi.fn(),
}));

vi.mock("@/hooks/use-idle-session-timeout", () => ({
  useIdleSessionTimeout: () => ({
    isWarningVisible: false,
    secondsRemaining: 0,
    stayConnected: vi.fn(),
    signOutNow: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-minimum-loading", () => ({
  useMinimumLoading: (isLoading: boolean) => ({
    isShowing: isLoading,
    isClosing: false,
  }),
}));

vi.mock("@/hooks/use-route-prefetch", () => ({
  useRoutePrefetch: vi.fn(),
}));

vi.mock("@/hooks/use-pending-split-expense", () => ({
  usePendingSplitExpense: vi.fn(),
}));

vi.mock("@/hooks/use-pending-simulation", () => ({
  usePendingSimulation: vi.fn(),
}));

vi.mock("@/app/authenticated-providers", () => ({
  AuthenticatedProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderRequireAuth() {
  return render(
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route
          path="/app"
          element={
            <RequireAuth>
              <div data-testid="protected-content">Conteúdo protegido</div>
            </RequireAuth>
          }
        />
        <Route path="/entrar" element={<div data-testid="login-page">Entrar</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth — erro de MFA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshMfaState.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-123" } },
      loading: false,
      configError: null,
      mfaRequired: true,
      mfaVerified: false,
      mfaAdminOnly: false,
      mfaError: "Não foi possível validar sua verificação em duas etapas.",
    });
  });

  it("renderiza a tela de mfaError com texto auxiliar e os botões 'Tentar novamente' e 'Sair e entrar novamente'", () => {
    renderRequireAuth();

    expect(
      screen.getByText("Não foi possível validar sua verificação em duas etapas."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Se o problema persistir, saia e entre novamente na sua conta."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair e entrar novamente" })).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("chama refreshMfaState e desabilita os botões durante o retry ao clicar em 'Tentar novamente'", async () => {
    const user = userEvent.setup();
    let resolveRetry!: () => void;
    mockRefreshMfaState.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRetry = resolve;
        }),
    );

    renderRequireAuth();

    const retryButton = screen.getByRole("button", { name: "Tentar novamente" });
    const signOutButton = screen.getByRole("button", { name: "Sair e entrar novamente" });

    await user.click(retryButton);

    expect(mockRefreshMfaState).toHaveBeenCalledTimes(1);
    expect(retryButton).toBeDisabled();
    expect(signOutButton).toBeDisabled();

    resolveRetry();

    await waitFor(() => {
      expect(retryButton).not.toBeDisabled();
      expect(signOutButton).not.toBeDisabled();
    });
  });

  it("chama signOut, clearGlobalAuthSession e navega para /entrar ao clicar em 'Sair e entrar novamente' mesmo se signOut falhar", async () => {
    const user = userEvent.setup();
    mockSignOut.mockRejectedValue(new Error("Offline"));

    renderRequireAuth();

    const signOutButton = screen.getByRole("button", { name: "Sair e entrar novamente" });
    await user.click(signOutButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
      expect(mockClearGlobalAuthSession).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });
  });
});
