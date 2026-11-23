import { describe, expect, it } from "vitest";
import { cleanCNPJ, formatCNPJ, isValidCNPJ } from "./cnpj";

describe("domain/validation/cnpj", () => {
  it("limpa caracteres não numéricos com cleanCNPJ", () => {
    expect(cleanCNPJ("11.222.333/0001-81")).toBe("11222333000181");
    expect(cleanCNPJ("18 236 120 0001 58")).toBe("18236120000158");
    expect(cleanCNPJ("abc")).toBe("");
  });

  it("formata dígitos no padrão oficial 00.000.000/0000-00", () => {
    expect(formatCNPJ("11")).toBe("11");
    expect(formatCNPJ("11222")).toBe("11.222");
    expect(formatCNPJ("11222333")).toBe("11.222.333");
    expect(formatCNPJ("112223330001")).toBe("11.222.333/0001");
    expect(formatCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("valida CNPJs autênticos pelo algoritmo Módulo 11 da Receita Federal", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11222333000181")).toBe(true);
    expect(isValidCNPJ("18.236.120/0001-58")).toBe(true);
    expect(isValidCNPJ("00.000.000/0001-91")).toBe(true);
  });

  it("rejeita CNPJs com dígito verificador inválido, repetidos ou tamanho incorreto", () => {
    expect(isValidCNPJ("00.000.000/0000-00")).toBe(false);
    expect(isValidCNPJ("11.111.111/1111-11")).toBe(false);
    expect(isValidCNPJ("12.345.678/0001-90")).toBe(false);
    expect(isValidCNPJ("11.222.333/0001-82")).toBe(false);
    expect(isValidCNPJ("11.222.333/0001-91")).toBe(false);
    expect(isValidCNPJ("1122233300018")).toBe(false);
    expect(isValidCNPJ("112223330001819")).toBe(false);
    expect(isValidCNPJ("")).toBe(false);
  });
});
