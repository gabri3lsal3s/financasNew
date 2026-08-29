import { describe, expect, it } from "vitest";
import { classifyError, getErrorMessage } from "@/services/errors";

describe("feature-flags and rpc access control backend errors", () => {
  it("classifica e preserva mensagem em pt-BR de funcionalidade desativada no backend", () => {
    const backendError = {
      message: 'Funcionalidade "investments" está temporariamente desativada no sistema.',
      code: "P0001",
    };

    const classified = classifyError(backendError);
    expect(classified.message).toBe('Funcionalidade "investments" está temporariamente desativada no sistema.');
    expect(getErrorMessage(backendError)).toBe('Funcionalidade "investments" está temporariamente desativada no sistema.');
  });

  it("classifica e preserva mensagem em pt-BR de conta suspensa ou inativa", () => {
    const backendError = {
      message: "Acesso negado: conta inativa, pendente de aprovação ou suspensa.",
      code: "P0001",
    };

    const classified = classifyError(backendError);
    expect(classified.message).toBe("Acesso negado: conta inativa, pendente de aprovação ou suspensa.");
  });
});
