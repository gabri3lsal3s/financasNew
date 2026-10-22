import { describe, expect, it } from "vitest";
import {
  extractBrokerName,
  isBrokerExpense,
  learnBrokerAportePattern,
} from "./aporte-learning";
import type { ExpenseLike, RecurringIncomeOccurrence } from "./recurrences";

describe("aporte-learning", () => {
  describe("isBrokerExpense e extractBrokerName", () => {
    it("identifica corretamente despesas para corretoras conhecidas", () => {
      const exp1: ExpenseLike = {
        id: "1",
        description: "TED NuInvest Corretora",
        date: "2026-09-08",
        month: "2026-09",
        valueCents: 150000,
        categoryId: "cat-investimentos",
      };
      expect(isBrokerExpense(exp1)).toBe(true);
      expect(extractBrokerName(exp1.description)).toBe("NuInvest");

      const exp2: ExpenseLike = {
        id: "2",
        description: "XP Investimentos CCTVM",
        date: "2026-09-08",
        month: "2026-09",
        valueCents: 200000,
        categoryId: "cat-investimentos",
      };
      expect(isBrokerExpense(exp2)).toBe(true);
      expect(extractBrokerName(exp2.description)).toBe("XP");

      const exp3: ExpenseLike = {
        id: "3",
        description: "Aporte BTG Pactual",
        date: "2026-09-08",
        month: "2026-09",
        valueCents: 50000,
        categoryId: "cat-investimentos",
      };
      expect(isBrokerExpense(exp3)).toBe(true);
      expect(extractBrokerName(exp3.description)).toBe("BTG");
    });

    it("identifica despesas pela categoria de investimentos", () => {
      const exp: ExpenseLike = {
        id: "4",
        description: "Transferência Pix",
        date: "2026-09-08",
        month: "2026-09",
        valueCents: 100000,
        categoryId: "cat-investimentos",
        categoryName: "Investimentos & Aportes",
      };
      expect(isBrokerExpense(exp)).toBe(true);
    });

    it("retorna false para despesas rotineiras sem relação com corretoras", () => {
      const exp: ExpenseLike = {
        id: "5",
        description: "Supermercado Pão de Açúcar",
        date: "2026-09-08",
        month: "2026-09",
        valueCents: 35000,
        categoryId: "cat-alimentacao",
        categoryName: "Alimentação",
      };
      expect(isBrokerExpense(exp)).toBe(false);
      expect(extractBrokerName(exp.description)).toBeUndefined();
    });
  });

  describe("learnBrokerAportePattern", () => {
    const mainIncome: RecurringIncomeOccurrence = {
      key: "income:salario",
      name: "Salário CLT",
      profile: "fixed",
      suggestedAction: "one_touch_confirm",
      months: ["2026-07", "2026-08", "2026-09"],
      averageCents: 1000000,
      lastValueCents: 1000000,
      confidence: 0.9,
      typicalDayOfMonth: 5,
      valueVariationRatio: 0,
    };

    const pastExpenses: ExpenseLike[] = [
      // Mês 07: Salário dia 5, aporte NuInvest dia 8 (lag = 3 dias)
      {
        id: "e-07",
        description: "TED NuInvest Corretora",
        date: "2026-07-08",
        month: "2026-07",
        valueCents: 200000,
        categoryId: "cat-investimentos",
      },
      // Mês 08: Salário dia 5, aporte NuInvest dia 7 (lag = 2 dias)
      {
        id: "e-08",
        description: "NuInvest Investimentos",
        date: "2026-08-07",
        month: "2026-08",
        valueCents: 200000,
        categoryId: "cat-investimentos",
      },
      // Mês 09: Salário dia 5, aporte NuInvest dia 8 (lag = 3 dias)
      {
        id: "e-09",
        description: "NuInvest",
        date: "2026-09-08",
        month: "2026-09",
        valueCents: 250000,
        categoryId: "cat-investimentos",
      },
    ];

    it("aprende a corretora preferencial, defasagem típica e dia do mês a partir do histórico", () => {
      const pattern = learnBrokerAportePattern({
        expenses: pastExpenses,
        incomes: [mainIncome],
        todayISO: "2026-10-10",
      });

      expect(pattern.primaryBroker).toBe("NuInvest");
      expect(pattern.historicalAportesCount).toBe(3);
      // Lags observados: [3, 2, 3] -> mediana = 3
      expect(pattern.typicalLagDays).toBe(3);
      // Dia típico da renda (5) + lag (3) = 8
      expect(pattern.typicalDayOfMonth).toBe(8);
      // Média dos aportes: (200000 + 200000 + 250000) / 3 = 216667
      expect(pattern.averageAporteCents).toBe(216667);
      expect(pattern.hasAporteThisMonth).toBe(false);
      // Dia 10 >= dia 8 -> isReadyForAporte = true
      expect(pattern.isReadyForAporte).toBe(true);
    });

    it("detecta quando o aporte do mês corrente já foi realizado", () => {
      const expensesWithCurrent: ExpenseLike[] = [
        ...pastExpenses,
        {
          id: "e-10",
          description: "NuInvest",
          date: "2026-10-07",
          month: "2026-10",
          valueCents: 200000,
          categoryId: "cat-investimentos",
        },
      ];

      const pattern = learnBrokerAportePattern({
        expenses: expensesWithCurrent,
        incomes: [mainIncome],
        todayISO: "2026-10-10",
      });

      expect(pattern.hasAporteThisMonth).toBe(true);
      expect(pattern.isReadyForAporte).toBe(false);
    });

    it("não considera pronto para aporte se ainda estiver antes da data típica no mês", () => {
      const pattern = learnBrokerAportePattern({
        expenses: pastExpenses,
        incomes: [mainIncome],
        todayISO: "2026-10-02",
      });

      expect(pattern.hasAporteThisMonth).toBe(false);
      // Dia 2 < dia da renda (5)
      expect(pattern.isReadyForAporte).toBe(false);
    });
  });
});
