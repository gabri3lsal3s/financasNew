import { describe, expect, it } from "vitest";
import { buildPixTransferCode } from "./build-pix-transfer-code";
import { inspectPixPaymentPayload, verifyPixConfiguration } from "./pix-diagnostics";

describe("pix-diagnostics", () => {
  describe("verifyPixConfiguration", () => {
    it("retorna status empty quando nenhuma chave Pix foi informada", () => {
      const result = verifyPixConfiguration({
        pixKey: "",
        merchantName: "",
        merchantCity: "",
      });

      expect(result.status).toBe("empty");
      expect(result.isReady).toBe(false);
      expect(result.brCode).toBeNull();
      expect(result.crc16).toBeNull();
      expect(result.resolvedCity.value).toBe("BRASILIA");
      expect(result.resolvedCity.usedFallback).toBe(true);
    });

    it("retorna error com motivo explícito quando a chave Pix é inválida ou CNPJ bloqueado", () => {
      const invalidUuid = verifyPixConfiguration({
        pixKey: "123e4567-e12b",
        keyType: "auto",
      });
      expect(invalidUuid.status).toBe("error");
      expect(invalidUuid.isReady).toBe(false);
      expect(invalidUuid.blockingReason).toContain("13/36");

      const blockedCnpj = verifyPixConfiguration({
        pixKey: "11.222.333/0001-81",
        allowCnpj: false,
      });
      expect(blockedCnpj.status).toBe("error");
      expect(blockedCnpj.isReady).toBe(false);
      expect(blockedCnpj.blockingReason).toContain("CNPJ não é suportado");
    });

    it("gera configuração ready apenas com a chave Pix mínima e cidade vazia ou incorreta", () => {
      const ready = verifyPixConfiguration({
        pixKey: "(79) 99988-7766",
        merchantName: "",
        merchantCity: "12345",
        amountCents: 2612,
      });

      expect(ready.status).toBe("ready");
      expect(ready.isReady).toBe(true);
      expect(ready.keyValidation.normalizedKey).toBe("+5579999887766");
      expect(ready.resolvedCity.value).toBe("BRASILIA");
      expect(ready.crc16).toMatch(/^[0-9A-F]{4}$/);
      expect(ready.brCode).toContain("00020126");
      expect(ready.autoAdjustments.length).toBeGreaterThanOrEqual(2);
    });

    it("emite warning quando e-mail coincide com o login ou chave de 11 dígitos é ambígua", () => {
      const emailWarn = verifyPixConfiguration({
        pixKey: "usuario@axir.com.br",
        profileEmail: "usuario@axir.com.br",
        merchantName: "Gabriel Sales",
        merchantCity: "Aracaju - SE",
      });
      expect(emailWarn.status).toBe("warning");
      expect(emailWarn.isReady).toBe(true);
      expect(emailWarn.resolvedCity.value).toBe("ARACAJU");
      expect(emailWarn.warnings[0]).toContain("e-mail de login");

      const ambiguousWarn = verifyPixConfiguration({
        pixKey: "11987654374",
      });
      expect(ambiguousWarn.status).toBe("warning");
      expect(ambiguousWarn.isReady).toBe(true);
      expect(ambiguousWarn.warnings[0]).toContain("CPF ou Celular");
    });
  });

  describe("inspectPixPaymentPayload", () => {
    it("confirma integridade EMV/CRC16 de um BR Code válido", () => {
      const brCode = buildPixTransferCode({
        pixKey: "123e4567-e12b-12d1-a456-426655440000",
        merchantName: "Gabriel Sales",
        merchantCity: "ARACAJU",
        amountCents: 4500,
      });

      const inspected = inspectPixPaymentPayload({
        pixBrCode: brCode,
        pixKey: "123e4567-e12b-12d1-a456-426655440000",
        pixKeyType: "random",
      });

      expect(inspected.isValidEmv).toBe(true);
      expect(inspected.crc16).toMatch(/^[0-9A-F]{4}$/);
      expect(inspected.embeddedKey).toBe("123e4567-e12b-12d1-a456-426655440000");
      expect(inspected.embeddedAmountCents).toBe(4500);
      expect(inspected.issueReason).toBeNull();
    });

    it("identifica o motivo exato quando BR Code está ausente ou corrompido", () => {
      const badKey = inspectPixPaymentPayload({
        pixBrCode: "",
        pixKey: "123.456.789-01",
        pixKeyType: "cpf",
      });
      expect(badKey.isValidEmv).toBe(false);
      expect(badKey.issueReason).toContain("CPF inválido");

      const tampered = inspectPixPaymentPayload({
        pixBrCode: "00020126360014br.gov.bcb.pix0114+55119999988885204000053039865802BR5905Teste6008BRASILIA62070503***6304FFFF",
        pixKey: "",
      });
      expect(tampered.isValidEmv).toBe(false);
      expect(tampered.issueReason).toContain("EMV/CRC16");
    });
  });
});
