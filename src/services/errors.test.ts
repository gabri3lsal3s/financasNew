import { describe, expect, it } from "vitest";
import { classifyError, getErrorMessage } from "./errors";

describe("errors gateway & sanitization (src/services/errors.test.ts)", () => {
  it("classifica rate limit (429 / code)", () => {
    expect(getErrorMessage({ status: 429 })).toContain("Aguarde alguns minutos");
    expect(classifyError({ code: "over_request_rate_limit" }).kind).toBe("rate-limit");
  });

  it("classifica credenciais inválidas", () => {
    expect(classifyError({ code: "invalid_credentials" }).kind).toBe("invalid-credentials");
    expect(getErrorMessage({ message: "Invalid login credentials" })).toContain("E-mail ou senha incorretos");
  });

  it("classifica sessão expirada (401 / jwt expirado)", () => {
    expect(classifyError({ status: 401 }).kind).toBe("session-expired");
    expect(classifyError({ code: "PGRST301" }).kind).toBe("session-expired");
  });

  it("classifica erro de rede (Online First → mensagem explícita)", () => {
    expect(classifyError(new TypeError("Failed to fetch")).kind).toBe("network");
    expect(getErrorMessage(new TypeError("NetworkError when attempting to fetch resource."))).toContain(
      "Sem conexão com o servidor",
    );
  });

  it("neutraliza vazamento de esquema/SQL técnico e retorna mensagem segura", () => {
    const technicalErrors = [
      'relation "expenses" does not exist',
      'syntax error at or near "FROM"',
      'column "secret_token" does not exist',
      'null value in column "id" of relation "profiles"',
      "deadlock detected on relation cards",
      "PostgREST error: connection refused",
    ];

    for (const msg of technicalErrors) {
      const err = classifyError({ message: msg });
      expect(err.kind).toBe("unknown");
      expect(err.message).toBe("Algo deu errado. Tente novamente em instantes.");
    }
  });

  it("sanitiza tags HTML em mensagens de erro para prevenir XSS", () => {
    const err = classifyError({
      message: 'Acesso negado: <script>alert("xss")</script>usuário sem permissão',
    });
    expect(err.kind).toBe("permission");
    expect(err.message).not.toContain("<script>");
    expect(err.message).toContain('Acesso negado: alert("xss")usuário sem permissão');
  });

  it("cai em mensagem genérica para erros desconhecidos", () => {
    expect(getErrorMessage(null)).toContain("Algo deu errado");
  });
});
