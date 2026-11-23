import { describe, expect, it } from "vitest";
import { buildPixTransferCode, resolvePixKeyType } from "./build-pix-transfer-code";
import { decodePixBrCode, validatePixBrCode } from "./pix-br-code";

describe("buildPixTransferCode", () => {
  it("gera BR Code válido com detecção automática de chave e sanitização de acentos", () => {
    const code = buildPixTransferCode({
      pixKey: "(11) 99999-8888",
      keyType: "auto",
      merchantName: "João da Silva!",
      merchantCity: "São Paulo",
      amountCents: 15250,
      txId: "TRIP-ABC-123",
      infoAdicional: "Acerto: Viagem Férias 2026!",
    });

    expect(code).not.toBeNull();
    expect(validatePixBrCode(code!)).toBe(true);

    const decoded = decodePixBrCode(code!);
    expect(decoded).not.toBeNull();
    expect(decoded?.pixKey).toBe("+5511999998888");
    expect(decoded?.merchantName).toBe("Joao da Silva");
    expect(decoded?.merchantCity).toBe("SAO PAULO");
    expect(decoded?.amountCents).toBe(15250);
    expect(decoded?.txId).toBe("TRIPABC123");
    expect(decoded?.infoAdicional).toBe("Acerto Viagem Ferias 2026");
    expect(decoded?.isValidCrc).toBe(true);
  });

  it("usa fallbacks seguros quando nome e cidade vêm vazios ou só com caracteres inválidos", () => {
    const code = buildPixTransferCode({
      pixKey: "organizador@axir.com.br",
      merchantName: "@@@",
      merchantCity: "   ",
      defaultMerchantName: "Organizador",
      defaultMerchantCity: "SAO PAULO",
    });

    expect(code).not.toBeNull();
    const decoded = decodePixBrCode(code!);
    expect(decoded?.merchantName).toBe("Organizador");
    expect(decoded?.merchantCity).toBe("SAO PAULO");
    expect(decoded?.amountCents).toBeUndefined();
    expect(decoded?.txId).toBe("***");
  });

  it("omite o valor quando amountCents é zero (Pix em aberto)", () => {
    const code = buildPixTransferCode({
      pixKey: "123.456.789-09",
      merchantName: "Maria Oliveira",
      merchantCity: "Curitiba",
      amountCents: 0,
    });

    expect(code).not.toBeNull();
    const decoded = decodePixBrCode(code!);
    expect(decoded?.pixKey).toBe("12345678909");
    expect(decoded?.amountCents).toBeUndefined();
  });

  it("retorna null para chave ausente, vazia, malformada ou valor em centavos inválido", () => {
    expect(buildPixTransferCode({ pixKey: null })).toBeNull();
    expect(buildPixTransferCode({ pixKey: undefined })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "   " })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "123.456.789-01" })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "alice@pix" })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "chave-invalida" })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "a@b.com", amountCents: -100 })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "a@b.com", amountCents: 12.5 })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "a@b.com", amountCents: Number.NaN })).toBeNull();
  });

  it("gera payloads válidos com valor fixo para todos os 5 tipos de chave Pix", () => {
    const keys = [
      { raw: "529.982.247-25", expected: "52998224725", amountCents: 5000 },
      { raw: "11.222.333/0001-81", expected: "11222333000181", amountCents: 15000 },
      { raw: "usuario@exemplo.com", expected: "usuario@exemplo.com", amountCents: 2612 },
      { raw: "(011) 98765-4321", expected: "+5511987654321", amountCents: 8990 },
      {
        raw: "123e4567-e12b-12d1-a456-426655440000",
        expected: "123e4567-e12b-12d1-a456-426655440000",
        amountCents: 100,
      },
    ];

    for (const item of keys) {
      const code = buildPixTransferCode({
        pixKey: item.raw,
        merchantName: "Recebedor Teste",
        merchantCity: "SAO PAULO",
        amountCents: item.amountCents,
      });
      expect(code).not.toBeNull();
      expect(validatePixBrCode(code!)).toBe(true);
      const decoded = decodePixBrCode(code!);
      expect(decoded?.pixKey).toBe(item.expected);
      expect(decoded?.amountCents).toBe(item.amountCents);
      expect(decoded?.txId).toBe("***");
    }
  });

  it("normaliza celular sem máscara para +55 e preserva keyType explícito", () => {
    const code = buildPixTransferCode({
      pixKey: "79999887766",
      keyType: "auto",
      merchantName: "Gabriel Sales",
      merchantCity: "Aracaju",
      amountCents: 4500,
    });
    expect(code).not.toBeNull();
    const decoded = decodePixBrCode(code!);
    expect(decoded?.pixKey).toBe("+5579999887766");
    expect(decoded?.amountCents).toBe(4500);
    expect(decoded?.isValidCrc).toBe(true);
  });

  it("resolvePixKeyType preserva tipo explícito válido e detecta quando auto/unknown", () => {
    expect(resolvePixKeyType("11999998888", "phone")).toBe("phone");
    expect(resolvePixKeyType("ana@axir.com.br", "auto")).toBe("email");
    expect(resolvePixKeyType("12345678901", "unknown")).toBe("cpf");
    expect(resolvePixKeyType("chave-generica", "auto")).toBeUndefined();
  });

  it("gera BR Code resiliente com cidade vazia, UF, numeros ou nome composto longo", () => {
    const emptyCityCode = buildPixTransferCode({
      pixKey: "529.982.247-25",
      merchantName: "",
      merchantCity: "",
      amountCents: 2500,
    });
    expect(emptyCityCode).not.toBeNull();
    expect(validatePixBrCode(emptyCityCode!)).toBe(true);
    const decodedEmpty = decodePixBrCode(emptyCityCode!);
    expect(decodedEmpty?.merchantName).toBe("Recebedor");
    expect(decodedEmpty?.merchantCity).toBe("BRASILIA");
    expect(decodedEmpty?.amountCents).toBe(2500);

    const numericCityCode = buildPixTransferCode({
      pixKey: "(79) 99988-7766",
      merchantName: "Gabriel Sales",
      merchantCity: "12345",
      amountCents: 1000,
    });
    expect(decodePixBrCode(numericCityCode!)?.merchantCity).toBe("BRASILIA");

    const symbolsCityCode = buildPixTransferCode({
      pixKey: "ana@exemplo.com",
      merchantName: "Ana",
      merchantCity: "---",
    });
    expect(decodePixBrCode(symbolsCityCode!)?.merchantCity).toBe("BRASILIA");

    const ufCityCode = buildPixTransferCode({
      pixKey: "ana@exemplo.com",
      merchantName: "Ana",
      merchantCity: "Aracaju - SE",
    });
    expect(decodePixBrCode(ufCityCode!)?.merchantCity).toBe("ARACAJU");

    const longCityCode = buildPixTransferCode({
      pixKey: "ana@exemplo.com",
      merchantName: "Ana",
      merchantCity: "Nossa Senhora do Socorro",
    });
    expect(decodePixBrCode(longCityCode!)?.merchantCity).toBe("NOSSA SENHORA");
  });
});
