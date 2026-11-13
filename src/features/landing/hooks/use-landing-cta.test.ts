import { renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { useLandingCta } from "./use-landing-cta";

describe("useLandingCta", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("retorna rotas de cadastro quando o usuário não está autenticado", () => {
    const { result } = renderHook(() => useLandingCta());

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.trialUrl).toBe("/cadastro");
    expect(result.current.proUrl("pro-anual")).toBe("/assinatura?plano=pro-anual");
    expect(result.current.proUrl("pro-mensal")).toBe("/assinatura?plano=pro-mensal");
  });

  it("retorna rotas diretas para app e checkout quando o usuário já está autenticado no localStorage", () => {
    localStorage.setItem(
      "sb-test-auth-token",
      JSON.stringify({ access_token: "mock-valid-token-123" }),
    );

    const { result } = renderHook(() => useLandingCta());

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.trialUrl).toBe("/");
    expect(result.current.proUrl("pro-anual")).toBe("/assinatura?plano=pro-anual");
    expect(result.current.proUrl("pro-mensal")).toBe("/assinatura?plano=pro-mensal");
  });
});
