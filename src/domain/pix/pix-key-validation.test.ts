import { describe, expect, it } from "vitest";
import { isValidCNPJ, isValidBrazilianPhoneDigits, validateAndClassifyPixKey } from "./pix-key-validation";

describe("pix-key-validation", () => {
  it("valida CNPJ corretamente", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11222333000181")).toBe(true);
    expect(isValidCNPJ("11111111111111")).toBe(false);
    expect(isValidCNPJ("11222333000182")).toBe(false);
  });

  it("valida telefone brasileiro (DDD + 9 dígitos celular ou 8 fixo)", () => {
    expect(isValidBrazilianPhoneDigits("79999887766")).toBe(true);
    expect(isValidBrazilianPhoneDigits("11987654321")).toBe(true);
    expect(isValidBrazilianPhoneDigits("1133334444")).toBe(true);
    expect(isValidBrazilianPhoneDigits("09999887766")).toBe(false); // DDD inválido
    expect(isValidBrazilianPhoneDigits("11887654321")).toBe(false); // 11 dígitos sem 9º dígito
  });

  it("classifica celular sem máscara (11 dígitos que não é CPF válido) automaticamente como phone +55", () => {
    const res = validateAndClassifyPixKey("79999887766", "auto");
    expect(res.isValid).toBe(true);
    expect(res.resolvedType).toBe("phone");
    expect(res.normalizedKey).toBe("+5579999887766");
  });

  it("classifica número com DDI 55 sem sinal + (5579999887766) como phone", () => {
    const res = validateAndClassifyPixKey("5579999887766", "auto");
    expect(res.isValid).toBe(true);
    expect(res.resolvedType).toBe("phone");
    expect(res.normalizedKey).toBe("+5579999887766");
  });

  it("sinaliza ambiguidade quando 11 dígitos sem pontuação são simultaneamente CPF válido e celular válido", () => {
    // Gerando 11 dígitos com DDD 11 + '9' que também passam no Mod-11 do CPF:
    // 119876543 -> vamos verificar dígitos verificadores:
    // 1*10 + 1*9 + 9*8 + 8*7 + 7*6 + 6*5 + 5*4 + 4*3 + 3*2 = 10+9+72+56+42+30+20+12+6 = 257 -> 257%11=4 -> d1 = 7
    // d2: 1*11+1*10+9*9+8*8+7*7+6*6+5*5+4*4+3*3+7*2 = 11+10+81+64+49+36+25+16+9+14 = 315 -> 315%11=7 -> d2 = 4
    // Logo "11987654374" é CPF válido E tem DDD 11 + 3º dígito 9!
    const res = validateAndClassifyPixKey("11987654374", "auto");
    expect(res.isValid).toBe(true);
    expect(res.resolvedType).toBe("cpf");
    expect(res.isAmbiguousCpfOrPhone).toBe(true);

    const asPhone = validateAndClassifyPixKey("11987654374", "phone");
    expect(asPhone.isValid).toBe(true);
    expect(asPhone.resolvedType).toBe("phone");
    expect(asPhone.normalizedKey).toBe("+5511987654374");
    expect(asPhone.isAmbiguousCpfOrPhone).toBe(false);
  });

  it("rejeita chave desconhecida em vez de forçar tipo cpf", () => {
    const res = validateAndClassifyPixKey("chave-invalida-qualquer", "auto");
    expect(res.isValid).toBe(false);
    expect(res.resolvedType).toBeNull();
    expect(res.errorMessage).toBeTruthy();
  });

  it("valida email, chave aleatória e telefone formatado", () => {
    expect(validateAndClassifyPixKey("  Ana@Axir.com.br ").normalizedKey).toBe("ana@axir.com.br");
    expect(
      validateAndClassifyPixKey("123E4567-E12B-12D1-A456-426655440000").normalizedKey,
    ).toBe("123e4567-e12b-12d1-a456-426655440000");
    expect(validateAndClassifyPixKey("(79) 99988-7766").normalizedKey).toBe("+5579999887766");
  });
});
