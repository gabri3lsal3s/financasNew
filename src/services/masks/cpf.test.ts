import { describe, expect, it } from "vitest";
import { cleanCPF, formatCPF, isValidCPF, maskCPF } from "./cpf";

describe("CPF Masking and Sanitization (PII Protection)", () => {
  it("cleanCPF limpa pontuações e mantém apenas números com no máximo 11 dígitos", () => {
    expect(cleanCPF("123.456.789-01")).toBe("12345678901");
    expect(cleanCPF("12345678901999")).toBe("12345678901");
    expect(cleanCPF("abc-12.34")).toBe("1234");
    expect(cleanCPF(null)).toBe("");
    expect(cleanCPF(undefined)).toBe("");
  });

  it("formatCPF formata progressivamente o CPF no padrão pt-BR", () => {
    expect(formatCPF("123")).toBe("123");
    expect(formatCPF("123456")).toBe("123.456");
    expect(formatCPF("123456789")).toBe("123.456.789");
    expect(formatCPF("12345678901")).toBe("123.456.789-01");
  });

  it("maskCPF mascara o CPF preservando a privacidade (anti-shoulder surfing)", () => {
    expect(maskCPF("12345678901")).toBe("***.***.789-**");
    expect(maskCPF("123.456.789-01")).toBe("***.***.789-**");
    expect(maskCPF("")).toBe("");
    expect(maskCPF(null)).toBe("");
    expect(maskCPF("12")).toBe("***.***.***-**");
    expect(maskCPF("12345")).toBe("***.***.45-**");
  });

  it("isValidCPF valida corretamente CPFs válidos e rejeita inválidos ou repetidos", () => {
    // CPFs com dígitos repetidos devem ser rejeitados
    expect(isValidCPF("000.000.000-00")).toBe(false);
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("999.999.999-99")).toBe(false);

    // CPFs com tamanho incompleto
    expect(isValidCPF("1234567890")).toBe(false);
    expect(isValidCPF(null)).toBe(false);

    // CPFs válidos conhecidos (algoritmo mod 11)
    // 52998224725 (válido de teste)
    expect(isValidCPF("52998224725")).toBe(true);
    expect(isValidCPF("529.982.247-25")).toBe(true);

    // CPF com dígito verificador adulterado
    expect(isValidCPF("529.982.247-26")).toBe(false);
  });
});
