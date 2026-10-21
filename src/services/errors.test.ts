import { describe, expect, it } from "vitest";
import { classifyError, getErrorMessage } from "./errors";

describe("errors gateway & sanitization (src/services/errors.test.ts)", () => {
  it("classifica rate limit (429 / code) com mensagem amigável padronizada", () => {
    expect(getErrorMessage({ status: 429 })).toBe("Muitas requisições simultâneas. Aguarde alguns instantes e tente novamente.");
    expect(classifyError({ code: "over_request_rate_limit" }).kind).toBe("rate-limit");
    expect(getErrorMessage({ message: "Too many requests, slow down" })).toBe(
      "Muitas requisições simultâneas. Aguarde alguns instantes e tente novamente.",
    );
  });

  it("classifica serviço indisponível / manutenção (503 / code) com ação de retry", () => {
    expect(getErrorMessage({ status: 503 })).toBe(
      "Serviço temporariamente indisponível para manutenção. Aguarde alguns instantes e tente novamente.",
    );
    expect(classifyError({ code: "503" }).kind).toBe("service-unavailable");
    expect(classifyError({ message: "Service Unavailable: servidor em manutenção" }).kind).toBe("service-unavailable");
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

  it("neutraliza vazamento de esquema, nomes de colunas, procedures internas, SQL e stack traces", () => {
    const technicalErrors = [
      'relation "expenses" does not exist',
      'syntax error at or near "FROM"',
      'column "secret_token" does not exist',
      'null value in column "id" of relation "profiles"',
      "deadlock detected on relation cards",
      "PostgREST error: connection refused",
      "function public.create_card_payment(uuid) does not exist",
      "procedure public.recalculate_bill_competences failed",
      "SELECT * FROM public.credit_cards WHERE user_id = 'abc'",
      "DELETE FROM public.incomes WHERE id = 1",
      "UPDATE public.debts SET amount_cents = 0",
      "TypeError: Cannot read properties of undefined (reading 'filter')",
      "Error: unhandled runtime failure\n    at Object.execute (/app/src/data/rpc.ts:45:10)",
      "at runBackgroundSync (src/services/sync.ts:25:3)",
      "operator does not exist: uuid = text",
      "key (user_id)=(123) is still referenced from table expenses",
    ];

    for (const msg of technicalErrors) {
      const err = classifyError({ message: msg });
      expect(err.kind).toBe("unknown");
      expect(err.message).toBe("Algo deu errado. Tente novamente em instantes.");
      expect(err.message).not.toContain("relation");
      expect(err.message).not.toContain("column");
      expect(err.message).not.toContain("syntax error");
      expect(err.message).not.toContain("public.");
      expect(err.message).not.toContain("SELECT");
      expect(err.message).not.toContain("TypeError");
    }
  });

  it("classifica violação de check constraint com mensagem amigável sem expor o nome da constraint", () => {
    const err = classifyError({ message: "new row violates check constraint check_positive_amount" });
    expect(err.kind).toBe("validation");
    expect(err.message).toBe("Dados inválidos. Revise as informações e tente novamente.");
    expect(err.message).not.toContain("check_positive_amount");
  });

  it("sanitiza vazamentos presentes nos campos details ou hint de erros PostgREST", () => {
    const errWithDetails = classifyError({
      message: "Query execution error",
      details: 'column "password_hash" of relation "users" does not exist',
    });
    expect(errWithDetails.message).toBe("Algo deu errado. Tente novamente em instantes.");

    const errWithHint = classifyError({
      message: "Database failure",
      hint: "Perhaps you meant to reference column credit_cards.id",
    });
    expect(errWithHint.message).toBe("Algo deu errado. Tente novamente em instantes.");
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
