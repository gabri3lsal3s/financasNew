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

  it("classifica e preserva mensagem em pt-BR de conta em modo somente-leitura pós-trial", () => {
    const backendError = {
      message: "Acesso negado: sua conta está em modo somente-leitura ou seu período de teste encerrou.",
      code: "P0001",
    };

    const classified = classifyError(backendError);
    expect(classified.message).toBe("Acesso negado: sua conta está em modo somente-leitura ou seu período de teste encerrou.");
  });

  it("classifica e preserva mensagem em pt-BR de módulo sem permissão de escrita", () => {
    const backendError = {
      message: "Acesso negado: permissão de escrita em Investimentos requerida.",
      code: "P0001",
    };

    const classified = classifyError(backendError);
    expect(classified.message).toBe("Acesso negado: permissão de escrita em Investimentos requerida.");
  });

  it("classifica e formata erro de RLS 42501 amigavelmente para o usuário", () => {
    const rlsError = {
      message: "new row violates row-level security policy for table \"expenses\"",
      code: "42501",
    };

    const classified = classifyError(rlsError);
    expect(classified.kind).toBe("permission");
  });
});
