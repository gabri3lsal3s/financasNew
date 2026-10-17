import { describe, expect, it } from "vitest";
import { batchBudgetLimitsInputSchema, budgetLimitInputSchema } from "./schemas";

describe("schemas — Módulo de Orçamentos", () => {
  describe("budgetLimitInputSchema", () => {
    it("valida entrada correta de limite orçamentário", () => {
      const input = {
        categoryId: "cat-alimentacao",
        month: "2026-08",
        amount: 1500.5,
      };

      const parsed = budgetLimitInputSchema.parse(input);
      expect(parsed.categoryId).toBe("cat-alimentacao");
      expect(parsed.month).toBe("2026-08");
      expect(parsed.amount).toBe(1500.5);
    });

    it("rejeita mês em formato incorreto", () => {
      expect(() =>
        budgetLimitInputSchema.parse({
          categoryId: "cat-1",
          month: "2026/08",
          amount: 500,
        }),
      ).toThrow();
    });

    it("rejeita valores monetários negativos", () => {
      expect(() =>
        budgetLimitInputSchema.parse({
          categoryId: "cat-1",
          month: "2026-08",
          amount: -50,
        }),
      ).toThrow();
    });

    it("rejeita valores monetários que ultrapassam o teto seguro", () => {
      expect(() =>
        budgetLimitInputSchema.parse({
          categoryId: "cat-1",
          month: "2026-08",
          amount: 10 ** 12,
        }),
      ).toThrow();
    });
  });

  describe("batchBudgetLimitsInputSchema", () => {
    it("valida lista em lote de limites orçamentários", () => {
      const input = {
        month: "2026-08",
        limits: [
          { categoryId: "cat-1", amount: 1000 },
          { categoryId: "cat-2", amount: 500 },
        ],
      };

      const parsed = batchBudgetLimitsInputSchema.parse(input);
      expect(parsed.limits).toHaveLength(2);
      expect(parsed.limits[0]?.amount).toBe(1000);
    });

    it("rejeita lote vazio", () => {
      expect(() =>
        batchBudgetLimitsInputSchema.parse({
          month: "2026-08",
          limits: [],
        }),
      ).toThrow();
    });
  });
});
