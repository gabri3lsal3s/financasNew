import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppRouter } from "./router";
import * as useAuthModule from "@/hooks/use-auth";

vi.mock("@/components/layout", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    LoadingScreen: () => <div data-testid="loading-screen" />,
    PageShell: () => <div data-testid="page-shell" />,
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
  useUserSubscription: () => ({
    isPro: true,
    isLoading: false,
    subscription: null,
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

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });

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

    expect(await screen.findByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
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

    expect(await screen.findByTestId("page-shell")).toBeInTheDocument();
  });

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
});
