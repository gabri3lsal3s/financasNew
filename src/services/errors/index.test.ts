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

  it("classifica erros de usuário já cadastrado como user-already-exists", () => {
    const err1 = classifyError({ message: "User already registered" });
    expect(err1.kind).toBe("user-already-exists");
    expect(err1.message).toBe(
      "Este e-mail já está cadastrado no Áxis Finance. Faça login ou recupere sua senha se tiver esquecido.",
    );

    const err2 = classifyError({ code: "user_already_exists" });
    expect(err2.kind).toBe("user-already-exists");

    const err3 = classifyError({ status: 422, message: "User already registered" });
    expect(err3.kind).toBe("user-already-exists");
  });

  it("cai em mensagem genérica para erros desconhecidos", () => {
    expect(getErrorMessage(null)).toContain("Algo deu errado");
  });
});

