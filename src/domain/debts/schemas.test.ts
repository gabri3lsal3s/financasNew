import { describe, expect, it } from "vitest";
import { debtInputSchema, debtSettlementSchema } from "./schemas";

describe("schemas — Módulo de Dívidas e Cobranças", () => {
  describe("debtInputSchema", () => {
    it("valida e sanitiza dívida válida", () => {
      const input = {
        personName: "  <b>João</b> da Silva\u0000 ",
        type: "payable" as const,
        amount: 850.75,
        dueDate: "2026-09-10",
        notes: "<script>alert(1)</script>Empréstimo para reforma",
        interestRate: 1.5,
        finePercent: 2,
      };

      const parsed = debtInputSchema.parse(input);
      expect(parsed.personName).toBe("João da Silva");
      expect(parsed.type).toBe("payable");
      expect(parsed.amount).toBe(850.75);
      expect(parsed.dueDate).toBe("2026-09-10");
      expect(parsed.notes).toBe("alert(1)Empréstimo para reforma");
      expect(parsed.interestRate).toBe(1.5);
      expect(parsed.finePercent).toBe(2);
    });

    it("rejeita valores monetários que ultrapassam o teto seguro", () => {
      expect(() =>
        debtInputSchema.parse({
          personName: "Banco",
          type: "payable",
          amount: 10 ** 12,
          dueDate: "2026-09-10",
        }),
      ).toThrow();
    });

    it("rejeita taxas de juros ou multas negativas ou abusivas (>100%)", () => {
      expect(() =>
        debtInputSchema.parse({
          personName: "Banco",
          type: "payable",
          amount: 100,
          dueDate: "2026-09-10",
          interestRate: -5,
        }),
      ).toThrow();

      expect(() =>
        debtInputSchema.parse({
          personName: "Banco",
          type: "payable",
          amount: 100,
          dueDate: "2026-09-10",
          finePercent: 150,
        }),
      ).toThrow();
    });
  });

  describe("debtSettlementSchema", () => {
    it("valida liquidação de dívida com valor positivo", () => {
      const input = {
        debtId: "debt-123",
        amount: 500,
        paidAt: "2026-08-20",
      };

      const parsed = debtSettlementSchema.parse(input);
      expect(parsed.debtId).toBe("debt-123");
      expect(parsed.amount).toBe(500);
      expect(parsed.paidAt).toBe("2026-08-20");
    });

    it("rejeita liquidação com valor zero ou negativo", () => {
      expect(() =>
        debtSettlementSchema.parse({
          debtId: "debt-1",
          amount: 0,
          paidAt: "2026-08-20",
        }),
      ).toThrow();
    });
  });
});
