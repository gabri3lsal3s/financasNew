import { describe, expect, it } from "vitest";
import { classifyError, getErrorMessage } from "./index";

describe("getErrorMessage — gateway de erros (ESPECIFICAÇÃO §1.7)", () => {
  it("classifica rate limit (429 / code)", () => {
    expect(getErrorMessage({ status: 429 })).toBe("Muitas requisições simultâneas. Aguarde alguns instantes e tente novamente.");
    expect(classifyError({ code: "over_request_rate_limit" }).kind).toBe("rate-limit");
  });

  it("classifica serviço indisponível (503 / manutenção)", () => {
    expect(getErrorMessage({ status: 503 })).toBe(
      "Serviço temporariamente indisponível para manutenção. Aguarde alguns instantes e tente novamente.",
    );
    expect(classifyError({ code: "503" }).kind).toBe("service-unavailable");
  });

  it("classifica e-mail não confirmado", () => {
    expect(classifyError({ code: "email_not_confirmed" }).kind).toBe("email-not-confirmed");
    expect(getErrorMessage({ status: 422 })).toContain("E-mail ainda não confirmado");
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

  it("classifica violação de unicidade (23505)", () => {
    expect(classifyError({ code: "23505" }).kind).toBe("duplicate");
  });

  it("classifica violação de chave estrangeira com histórico vinculado (23503)", () => {
    const err = classifyError({ code: "23503", message: "update or delete on table violates foreign key constraint" });
    expect(err.kind).toBe("foreign-key");
    expect(err.message).toContain("Não é possível excluir este registro pois existem lançamentos vinculados");
  });

  it("repassa mensagens de negócio dos RPCs (raise exception em pt-BR)", () => {
    const err = classifyError({ message: "Valor da despesa deve ser maior que zero" });
    expect(err.kind).toBe("unknown");
    expect(err.message).toBe("Valor da despesa deve ser maior que zero");
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
      expect(err.message).not.toContain("relation");
      expect(err.message).not.toContain("column");
      expect(err.message).not.toContain("syntax error");
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

