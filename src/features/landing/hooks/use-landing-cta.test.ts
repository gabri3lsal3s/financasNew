import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLandingCta } from "./use-landing-cta";
import * as useAuthModule from "@/hooks/use-auth";

describe("useLandingCta", () => {
  it("retorna rotas de cadastro quando o usuário não está autenticado", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
    });

    const { result } = renderHook(() => useLandingCta());

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.trialUrl).toBe("/cadastro");
    expect(result.current.proUrl("pro-anual")).toBe("/cadastro?plano=pro-anual");
    expect(result.current.proUrl("pro-mensal")).toBe("/cadastro?plano=pro-mensal");
  });

  it("retorna rotas diretas para app e checkout quando o usuário já está autenticado", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: { user: { id: "user-123" } } as unknown as useAuthModule.AuthState["session"],
      user: { id: "user-123" } as unknown as useAuthModule.AuthState["user"],
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
    });

    const { result } = renderHook(() => useLandingCta());

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.trialUrl).toBe("/");
    expect(result.current.proUrl("pro-anual")).toBe("/assinatura?plano=pro-anual");
    expect(result.current.proUrl("pro-mensal")).toBe("/assinatura?plano=pro-mensal");
  });
});
