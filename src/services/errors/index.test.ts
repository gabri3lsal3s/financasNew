import { describe, expect, it } from "vitest";
import { classifyError, getErrorMessage } from "./index";

describe("getErrorMessage — gateway de erros (ESPECIFICAÇÃO §1.7)", () => {
  it("classifica rate limit (429 / code)", () => {
    expect(getErrorMessage({ status: 429 })).toContain("Aguarde alguns minutos");
    expect(classifyError({ code: "over_request_rate_limit" }).kind).toBe("rate-limit");
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

  it("repassa mensagens de negócio dos RPCs (raise exception em pt-BR)", () => {
    const err = classifyError({ message: "Valor da despesa deve ser maior que zero" });
    expect(err.kind).toBe("unknown");
    expect(err.message).toBe("Valor da despesa deve ser maior que zero");
  });

  it("cai em mensagem genérica para erros desconhecidos", () => {
    expect(getErrorMessage(null)).toContain("Algo deu errado");
  });
});
