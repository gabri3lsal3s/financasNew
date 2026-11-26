import type { ReactNode } from "react";
import { useEffect } from "react";
import { configure, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppRouter } from "./router";
import * as useAuthModule from "@/hooks/use-auth";

// Sob carga da suíte completa, o primeiro import lazy de cada rota pode exceder
// o timeout padrão de 1s sem significar falha funcional.
configure({ asyncUtilTimeout: 30000 });

const mockPageShellMount = vi.fn();
const mockPageShellUnmount = vi.fn();

vi.mock("@/components/layout", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { Outlet } = await import("react-router");
  return {
    ...actual,
    LoadingScreen: () => <div data-testid="loading-screen" />,
    PageShell: ({ children }: { children?: ReactNode }) => (
      <div data-testid="page-shell">{children ?? <Outlet />}</div>
    ),
  };
});

vi.mock("@/components/layout/page-shell", async () => {
  const { Outlet } = await import("react-router");
  return {
    PageShell: ({ children }: { children?: ReactNode }) => {
      useEffect(() => {
        mockPageShellMount();
        return () => mockPageShellUnmount();
      }, []);
      return <div data-testid="page-shell">{children ?? <Outlet />}</div>;
    },
  };
});

// Os providers autenticados são exercitados nos testes próprios; aqui isolamos o roteamento.
vi.mock("@/app/authenticated-providers", () => ({
  AuthenticatedProviders: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/overview/pages/overview-page", async () => {
  const { Link } = await import("react-router");
  return {
    OverviewPage: () => (
      <div data-testid="overview-page-stub">
        <Link to="/transacoes">Ir para Transações</Link>
      </div>
    ),
  };
});

vi.mock("@/features/transactions/pages/transaction-list-page", async () => {
  const { Link } = await import("react-router");
  return {
    TransactionListPage: () => (
      <div data-testid="transactions-page-stub">
        <Link to="/">Voltar para Início</Link>
      </div>
    ),
  };
});

vi.mock("@/state", () => ({
  useUserAccess: () => ({
    profile: { id: "user-123", role: "user", status: "active" },
    role: "user",
    status: "active",
    isAdmin: false,
    isSuperAdmin: false,
    hasFeature: () => true,
    isLoading: false,
    error: null,
  }),
  useSaveSplitExpense: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSaveSimulationToAccount: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSignalSplitPayment: () => ({
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
  }),
  useFamilyMode: () => ({
    isFamilyModeEnabled: false,
    toggleFamilyMode: vi.fn(),
    isLoading: false,
    isPending: false,
  }),
  useMyFamily: () => ({
    data: null,
    isLoading: false,
  }),
  useCategories: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  usePermission: () => ({
    canRead: true,
    canWrite: true,
    isHidden: false,
    accessLevel: "write",
    isReadOnlyMode: false,
  }),
  useUserSubscription: () => ({
    isPro: true,
    isLoading: false,
    subscription: null,
  }),
  useUserPreferences: () => ({
    data: null,
    isLoading: false,
    error: null,
  }),
  useUpdateCustomSettings: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useAssetGovernanceInsights: () => ({
    insights: [],
    summary: {
      overdueCount: 0,
      quarantineCount: 0,
      opportunityCount: 0,
      lowScoreRiskCount: 0,
      totalInsights: 0,
    },
    consolidatedReviewAlert: null,
    overdueReviewsCount: 0,
    quarantinedCount: 0,
    discountOpportunitiesCount: 0,
    lowScoreRiskCount: 0,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/state/queries/use-public-shares", () => ({
  usePublicShare: () => ({
    data: null,
    isLoading: false,
    error: null,
  }),
  useSharedFamilyBudget: () => ({
    data: null,
    isLoading: false,
    error: null,
  }),
  useSharedGoalTracker: () => ({
    data: null,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-device-session-sync", () => ({
  useDeviceSessionSync: () => {},
}));

vi.mock("@/state/queries/use-family", () => ({
  useFamilyInvite: () => ({
    data: null,
    isLoading: false,
    isError: false,
  }),
  useMyFamily: () => ({
    data: null,
    isLoading: false,
  }),
  useAcceptFamilyInvite: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useLeaveFamily: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));


describe("AppRouter (Code Splitting e Lazy Routes)", () => {
  it("renderiza a rota /entrar com Suspense e lazy loading para visitantes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/entrar");
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", { name: "Entrar" }, { timeout: 35000 }),
    ).toBeInTheDocument();
  }, 60000);

  it("renderiza a rota /cadastro com lazy loading para visitantes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/cadastro");
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", { name: "Criar conta" }, { timeout: 8000 }),
    ).toBeInTheDocument();
  });

  it("renderiza o alias /cadastrar com lazy loading para visitantes (suporte a links externos e viralidade)", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/cadastrar");
    render(<AppRouter />);

    expect(await screen.findByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
  });

  it("renderiza a rota /recuperar-senha com Suspense e lazy loading", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/recuperar-senha");
    render(<AppRouter />);

    expect(await screen.findByRole("heading", { name: /Recuperar Senha/i })).toBeInTheDocument();
  });

  it("renderiza a rota pública /apresentacao (LandingPage) com lazy loading", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/apresentacao");
    render(<AppRouter />);

    expect(await screen.findByRole("button", { name: "Recursos" }, { timeout: 8000 })).toBeInTheDocument();
  });

  it("renderiza a rota pública desautenticada /termos com lazy loading", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/termos");
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", {
        name: "Termos de Serviço e Contrato de Adesão SaaS",
      }),
    ).toBeInTheDocument();
  });

  it("renderiza o alias desautenticado /termos-de-uso com lazy loading", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/termos-de-uso");
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", {
        name: "Termos de Serviço e Contrato de Adesão SaaS",
      }),
    ).toBeInTheDocument();
  });

  it("renderiza a rota pública desautenticada /privacidade com lazy loading", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/privacidade");
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", {
        name: "Política de Privacidade e Proteção de Dados (LGPD)",
      }),
    ).toBeInTheDocument();
  });

  it("renderiza o alias desautenticado /politica-de-privacidade com lazy loading", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/politica-de-privacidade");
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", {
        name: "Política de Privacidade e Proteção de Dados (LGPD)",
      }),
    ).toBeInTheDocument();
  });

  it("renderiza a rota pública /r/:token (SplitPublicPage) para visitantes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/r/token-teste");
    render(<AppRouter />);

    // Deve exibir o badge ou o estado da página sem redirecionar para /entrar
    expect(await screen.findByText("Racha de Conta", {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it("renderiza a rota pública /orcamento-familiar/:token (FamilyBudgetPage) para visitantes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/orcamento-familiar/token-familiar");
    render(<AppRouter />);

    expect(await screen.findByText(/Orçamento familiar/i)).toBeInTheDocument();
  });

  it("renderiza a rota pública /meta/:token (GoalTrackerPublicPage) para visitantes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/meta/token-meta");
    render(<AppRouter />);

    expect(await screen.findByText(/Meta não encontrada/i)).toBeInTheDocument();
  });

  it("renderiza a rota pública /convite-familiar/:token (FamilyInvitePage) para visitantes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/convite-familiar/tok-abc");
    render(<AppRouter />);

    expect(await screen.findByText(/Convite não encontrado ou inválido/i)).toBeInTheDocument();
  });

  it("renderiza o hub público /ferramentas para visitantes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/ferramentas");
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", { name: "Simuladores Financeiros Gratuitos" }),
    ).toBeInTheDocument();
  });

  it("renderiza a ferramenta pública /ferramentas/simulador-dividas para visitantes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/ferramentas/simulador-dividas");
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", {
        name: "Simulador de Quitação: Avalanche vs Bola de Neve",
      }),
    ).toBeInTheDocument();
  });

  it("renderiza a ferramenta pública /ferramentas/rebalanceamento para visitantes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/ferramentas/rebalanceamento");
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", {
        name: "Simulador de Rebalanceamento Inteligente de Carteira",
      }),
    ).toBeInTheDocument();
  });

  it("renderiza a ferramenta pública /ferramentas/juros-compostos para visitantes", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/ferramentas/juros-compostos");
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", {
        name: "Simulador de Juros Compostos & Independência Financeira",
      }),
    ).toBeInTheDocument();
  });



  it("redireciona rota legada /investimentos preservando query strings para /investments", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: { user: { id: "user-123" } } as unknown as useAuthModule.AuthState["session"],
      user: { id: "user-123" } as unknown as useAuthModule.AuthState["user"],
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/investimentos?tab=metas");
    render(<AppRouter />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/investments");
      expect(window.location.search).toBe("?tab=metas");
    });
  });

  it("renderiza a página de apresentação (LandingPage) diretamente ao acessar a raiz / no navegador Web sem sessão", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/");
    render(<AppRouter />);

    expect(await screen.findByRole("button", { name: "Recursos" }, { timeout: 8000 })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("renderiza o painel financeiro (PageShell) ao acessar a raiz / com sessão autenticada", async () => {
    // A raiz decide landing vs App Shell por token síncrono antes de montar hooks pesados.
    window.localStorage.setItem(
      "sb-test-auth-token",
      JSON.stringify({ access_token: "token-teste", refresh_token: "refresh-teste" }),
    );
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: { user: { id: "user-123" } } as unknown as useAuthModule.AuthState["session"],
      user: { id: "user-123" } as unknown as useAuthModule.AuthState["user"],
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/");
    render(<AppRouter />);

    expect(await screen.findByTestId("page-shell", {}, { timeout: 45000 })).toBeInTheDocument();
    window.localStorage.removeItem("sb-test-auth-token");
  }, 60000);

  it("redireciona para /entrar ao acessar a raiz / sem autenticação em plataforma nativa (Capacitor Android)", async () => {
    const nativeModule = await import("@/services/native");
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(true);

    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    window.history.pushState({}, "", "/");
    render(<AppRouter />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/entrar");
    });
  });

  it("mantém a mesma instância de PageShell montada ao navegar entre / e rotas internas", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "sb-test-auth-token",
      JSON.stringify({ access_token: "token-teste", refresh_token: "refresh-teste" }),
    );
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: { user: { id: "user-123" } } as unknown as useAuthModule.AuthState["session"],
      user: { id: "user-123" } as unknown as useAuthModule.AuthState["user"],
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    try {
      window.history.pushState({}, "", "/");
      render(<AppRouter />);

      const initialShell = await screen.findByTestId("page-shell", {}, { timeout: 45000 });
      expect(await screen.findByTestId("overview-page-stub")).toBeInTheDocument();

      mockPageShellMount.mockClear();
      mockPageShellUnmount.mockClear();

      await user.click(screen.getByRole("link", { name: "Ir para Transações" }));
      expect(await screen.findByTestId("transactions-page-stub")).toBeInTheDocument();
      expect(screen.getByTestId("page-shell")).toBe(initialShell);
      expect(mockPageShellMount).not.toHaveBeenCalled();
      expect(mockPageShellUnmount).not.toHaveBeenCalled();

      await user.click(screen.getByRole("link", { name: "Voltar para Início" }));
      expect(await screen.findByTestId("overview-page-stub")).toBeInTheDocument();
      expect(screen.getByTestId("page-shell")).toBe(initialShell);
      expect(mockPageShellMount).not.toHaveBeenCalled();
      expect(mockPageShellUnmount).not.toHaveBeenCalled();
    } finally {
      window.localStorage.removeItem("sb-test-auth-token");
    }
  }, 60000);
});
