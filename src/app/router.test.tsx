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
});
