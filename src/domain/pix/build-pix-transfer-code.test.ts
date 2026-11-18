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
      pixKey: "123.456.789-01",
      merchantName: "Maria Oliveira",
      merchantCity: "Curitiba",
      amountCents: 0,
    });

    expect(code).not.toBeNull();
    const decoded = decodePixBrCode(code!);
    expect(decoded?.pixKey).toBe("12345678901");
    expect(decoded?.amountCents).toBeUndefined();
  });

  it("retorna null para chave ausente, vazia ou valor em centavos inválido", () => {
    expect(buildPixTransferCode({ pixKey: null })).toBeNull();
    expect(buildPixTransferCode({ pixKey: undefined })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "   " })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "a@b.com", amountCents: -100 })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "a@b.com", amountCents: 12.5 })).toBeNull();
    expect(buildPixTransferCode({ pixKey: "a@b.com", amountCents: Number.NaN })).toBeNull();
  });

  it("resolvePixKeyType preserva tipo explícito válido e detecta quando auto/unknown", () => {
    expect(resolvePixKeyType("11999998888", "phone")).toBe("phone");
    expect(resolvePixKeyType("ana@axir.com.br", "auto")).toBe("email");
    expect(resolvePixKeyType("12345678901", "unknown")).toBe("cpf");
    expect(resolvePixKeyType("chave-generica", "auto")).toBeUndefined();
  });
});
