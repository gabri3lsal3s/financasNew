import { describe, expect, it } from "vitest";
import { cleanCPF, formatCPF, isValidCPF } from "./cpf";

describe("CPF Domain Validation & Formatting", () => {
  it("limpa caracteres especiais mantendo apenas dígitos", () => {
    expect(cleanCPF("123.456.789-00")).toBe("12345678900");
    expect(cleanCPF("abc-123.45")).toBe("12345");
    expect(cleanCPF("")).toBe("");
  });

  it("formata dígitos progressivamente no padrão 000.000.000-00", () => {
    expect(formatCPF("123")).toBe("123");
    expect(formatCPF("1234")).toBe("123.4");
    expect(formatCPF("1234567")).toBe("123.456.7");
    expect(formatCPF("12345678901")).toBe("123.456.789-01");
    expect(formatCPF("1234567890199999")).toBe("123.456.789-01");
  });

  it("rejeita CPFs com tamanho diferente de 11 dígitos", () => {
    expect(isValidCPF("1234567890")).toBe(false);
    expect(isValidCPF("123456789012")).toBe(false);
    expect(isValidCPF("")).toBe(false);
  });

  it("rejeita CPFs com todos os dígitos iguais", () => {
    expect(isValidCPF("00000000000")).toBe(false);
    expect(isValidCPF("11111111111")).toBe(false);
    expect(isValidCPF("22222222222")).toBe(false);
    expect(isValidCPF("99999999999")).toBe(false);
  });

  it("valida corretamente CPFs válidos conhecidos", () => {
    expect(isValidCPF("52998224725")).toBe(true);
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("12345678909")).toBe(true);
    expect(isValidCPF("123.456.789-09")).toBe(true);
  });

  it("rejeita CPFs com dígitos verificadores corrompidos", () => {
    expect(isValidCPF("52998224726")).toBe(false);
    expect(isValidCPF("12345678908")).toBe(false);
    expect(isValidCPF("12345678910")).toBe(false);
  });
});
