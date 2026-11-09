import { describe, expect, it } from "vitest";
import {
  isValidCPF,
  isValidLuhn,
  isValidCardExpiry,
  sanitizePaymentLog,
} from "../../supabase/functions/_shared/asaas.ts";

describe("Validações Financeiras e Sanitização PCI — Asaas", () => {
  describe("isValidCPF", () => {
    it("valida CPFs matematicamente válidos", () => {
      // CPFs canônicos de teste gerados com algoritmo oficial
      expect(isValidCPF("11144477735")).toBe(true);
      expect(isValidCPF("52998224725")).toBe(true);
      expect(isValidCPF("11144477736")).toBe(false); // Dígito verificador incorreto
    });

    it("rejeita sequências homogêneas", () => {
      expect(isValidCPF("00000000000")).toBe(false);
      expect(isValidCPF("11111111111")).toBe(false);
      expect(isValidCPF("99999999999")).toBe(false);
    });

    it("rejeita comprimentos divergentes de 11 dígitos", () => {
      expect(isValidCPF("")).toBe(false);
      expect(isValidCPF("123")).toBe(false);
      expect(isValidCPF("123456789012")).toBe(false);
    });

    it("ignora caracteres de formatação", () => {
      expect(isValidCPF("111.444.777-35")).toBe(true);
      expect(isValidCPF("529.982.247-25")).toBe(true);
    });
  });

  describe("isValidLuhn", () => {
    it("valida números de cartão válidos por Luhn (Mod 10)", () => {
      // Cartão de teste Visa válido por Luhn
      expect(isValidLuhn("4532015112830366")).toBe(true);
      // Cartão com 1 dígito trocado
      expect(isValidLuhn("4532015112830367")).toBe(false);
    });

    it("rejeita comprimentos inválidos", () => {
      expect(isValidLuhn("1234")).toBe(false);
      expect(isValidLuhn("12345678901234567890")).toBe(false);
    });

    it("ignora espaços e hífens", () => {
      expect(isValidLuhn("4532 0151 1283 0366")).toBe(true);
      expect(isValidLuhn("4532-0151-1283-0366")).toBe(true);
    });
  });

  describe("isValidCardExpiry", () => {
    const fixedNow = new Date("2026-11-09T12:00:00Z");

    it("aprova cartões com vencimento no mês corrente ou futuro", () => {
      expect(isValidCardExpiry("11", "2026", fixedNow)).toBe(true);
      expect(isValidCardExpiry("12", "2026", fixedNow)).toBe(true);
      expect(isValidCardExpiry("01", "2027", fixedNow)).toBe(true);
      expect(isValidCardExpiry("05", "27", fixedNow)).toBe(true);
    });

    it("rejeita cartões já vencidos", () => {
      expect(isValidCardExpiry("10", "2026", fixedNow)).toBe(false);
      expect(isValidCardExpiry("12", "2025", fixedNow)).toBe(false);
      expect(isValidCardExpiry("01", "24", fixedNow)).toBe(false);
    });

    it("rejeita meses fora da faixa 1-12", () => {
      expect(isValidCardExpiry("0", "2027", fixedNow)).toBe(false);
      expect(isValidCardExpiry("13", "2027", fixedNow)).toBe(false);
      expect(isValidCardExpiry("abc", "2027", fixedNow)).toBe(false);
    });
  });

  describe("sanitizePaymentLog", () => {
    it("redige CCV e preserva apenas os últimos 4 dígitos do cartão", () => {
      const sensitive = {
        plan: "monthly",
        customer: "cus_123",
        card: {
          holderName: "GABRIEL SALES",
          number: "4532015112830366",
          expiryMonth: "12",
          expiryYear: "2028",
          ccv: "123",
        },
      };

      const sanitized = sanitizePaymentLog(sensitive) as typeof sensitive;

      expect(sanitized.card.ccv).toBe("***");
      expect(sanitized.card.number).toBe("**** **** **** 0366");
      expect(sanitized.card.holderName).toBe("GABRIEL SALES");
      expect(sanitized.plan).toBe("monthly");
    });

    it("mascara objetos aninhados com chaves variadas (cvv, number)", () => {
      const payload = {
        creditCard: {
          number: "5555444433332222",
          cvv: "999",
        },
      };

      const sanitized = sanitizePaymentLog(payload) as typeof payload;
      expect(sanitized.creditCard.cvv).toBe("***");
      expect(sanitized.creditCard.number).toBe("**** **** **** 2222");
    });
  });
});
