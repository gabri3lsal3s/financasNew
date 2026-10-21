import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppRouter } from "./router";
import * as useAuthModule from "@/hooks/use-auth";

vi.mock("@/state", () => ({
  useUserAccess: () => ({
    role: "user",
    status: "active",
    isAdmin: false,
    isSuperAdmin: false,
    hasFeature: () => true,
    isLoading: false,
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
    });

    window.history.pushState({}, "", "/apresentacao");
    render(<AppRouter />);

    expect(await screen.findByRole("button", { name: "Recursos" }, { timeout: 8000 })).toBeInTheDocument();
  });
});
