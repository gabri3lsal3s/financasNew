import { describe, expect, it } from "vitest";
import { currentMonth, shiftMonth } from "@/lib/date";
import {
  formatIsoDate,
  generateMockFinances,
  generateMockInvestments,
  getTourSteps,
  TOUR_STEPS,
} from "./index";

describe("demo-simulation — Datasets Puros e Dinâmicos em Memória (Fase 2)", () => {
  describe("formatIsoDate", () => {
    it("formata a data corretamente com zero à esquerda", () => {
      expect(formatIsoDate("2026-10", 5)).toBe("2026-10-05");
      expect(formatIsoDate("2026-10", 15)).toBe("2026-10-15");
    });

    it("limita o dia ao total de dias do mês fornecido", () => {
      // Abril tem 30 dias
      expect(formatIsoDate("2026-04", 31)).toBe("2026-04-30");
      // Fevereiro de 2026 (ano não bissexto) tem 28 dias
      expect(formatIsoDate("2026-02", 30)).toBe("2026-02-28");
    });

    it("limita dias menores que 1 ao primeiro dia do mês", () => {
      expect(formatIsoDate("2026-05", 0)).toBe("2026-05-01");
      expect(formatIsoDate("2026-05", -5)).toBe("2026-05-01");
    });
  });

  describe("generateMockFinances", () => {
    it("gera dados dinâmicos ancorados no mês corrente por padrão", () => {
      const nowMonth = currentMonth();
      const prevMonth = shiftMonth(nowMonth, -1);
      const dataset = generateMockFinances();

      expect(dataset.referenceMonth).toBe(nowMonth);
      expect(dataset.previousMonth).toBe(prevMonth);

      // Validação de categorias
      expect(dataset.categories.length).toBeGreaterThanOrEqual(8);
      const expenseCats = dataset.categories.filter((c) => c.type === "expense");
      const incomeCats = dataset.categories.filter((c) => c.type === "income");
      expect(expenseCats.length).toBeGreaterThan(0);
      expect(incomeCats.length).toBeGreaterThan(0);

      // Validação de cartões
      expect(dataset.cards).toHaveLength(1);
      const [card] = dataset.cards;
      expect(card?.credit_limit).toBeGreaterThan(0);
      expect(card?.closing_day).toBe(25);
      expect(card?.due_day).toBe(5);

      // Validação de receitas: todas no mês de referência ou no anterior
      expect(dataset.incomes.length).toBeGreaterThan(0);
      for (const inc of dataset.incomes) {
        expect(inc.value).toBeGreaterThan(0);
        const incMonth = inc.date.slice(0, 7);
        expect([nowMonth, prevMonth]).toContain(incMonth);
      }

      // Validação de despesas: todas com valor positivo e datas consistentes
      expect(dataset.expenses.length).toBeGreaterThan(0);
      for (const exp of dataset.expenses) {
        expect(exp.value).toBeGreaterThan(0);
        const expMonth = exp.date.slice(0, 7);
        expect([nowMonth, prevMonth]).toContain(expMonth);
      }

      // Validação de orçamentos: todos vinculados ao mês de referência
      expect(dataset.budgets.length).toBeGreaterThan(0);
      for (const b of dataset.budgets) {
        expect(b.month).toBe(nowMonth);
        expect(b.limit).toBeGreaterThan(0);
      }
    });

    it("suporta mês de referência arbitrário mantendo integridade temporal", () => {
      const customMonth = "2025-08";
      const customPrevMonth = "2025-07";
      const dataset = generateMockFinances(customMonth);

      expect(dataset.referenceMonth).toBe(customMonth);
      expect(dataset.previousMonth).toBe(customPrevMonth);

      const refExpenses = dataset.expenses.filter((e) => e.date.startsWith(customMonth));
      const prevExpenses = dataset.expenses.filter((e) => e.date.startsWith(customPrevMonth));

      expect(refExpenses.length).toBeGreaterThan(0);
      expect(prevExpenses.length).toBeGreaterThan(0);

      // Nenhuma data fora de customMonth e customPrevMonth
      for (const exp of dataset.expenses) {
        const expMonth = exp.date.slice(0, 7);
        expect([customMonth, customPrevMonth]).toContain(expMonth);
      }
    });

    it("mantém coerência entre compras no cartão e competência de fatura", () => {
      const customMonth = "2026-11";
      const dataset = generateMockFinances(customMonth);
      const cardExpenses = dataset.expenses.filter((e) => e.payment_method === "credit_card");

      expect(cardExpenses.length).toBeGreaterThan(0);
      for (const exp of cardExpenses) {
        expect(exp.card_id).toBe("card-demo-black");
        expect(exp.bill_competence).toBeDefined();
      }

      // Checagem de compra parcelada
      const installmentExpense = dataset.expenses.find((e) => e.installments_total > 1);
      expect(installmentExpense).toBeDefined();
      expect(installmentExpense?.installment_group_id).toBeTruthy();
      expect(installmentExpense?.installment_number).toBeLessThanOrEqual(
        installmentExpense?.installments_total ?? 1,
      );
    });
  });

  describe("generateMockInvestments", () => {
    it("gera carteira balanceada com soma de metas igual a 100%", () => {
      const dataset = generateMockInvestments("2026-10");

      // Classes balanceadas
      expect(dataset.assets.length).toBeGreaterThanOrEqual(6);
      const assetClasses = new Set(dataset.assets.map((a) => a.asset_class));
      expect(assetClasses).toContain("Renda Fixa");
      expect(assetClasses).toContain("Ações Brasil");
      expect(assetClasses).toContain("FIIs");
      expect(assetClasses).toContain("Cripto");

      // Soma de metas por classe == 100%
      const totalGroupPercent = dataset.groupTargets.reduce(
        (sum, t) => sum + t.target_percentage,
        0,
      );
      expect(totalGroupPercent).toBe(100);

      // Soma de metas por ativo == 100%
      const totalAllocPercent = dataset.allocationTargets.reduce(
        (sum, t) => sum + t.target_percentage,
        0,
      );
      expect(totalAllocPercent).toBe(100);

      // Todo ativo em allocationTargets existe em assets
      const assetIds = new Set(dataset.assets.map((a) => a.id));
      for (const target of dataset.allocationTargets) {
        expect(assetIds.has(target.asset_id)).toBe(true);
      }
    });

    it("gera curva patrimonial crescente de 3 meses para os snapshots", () => {
      const refMonth = "2026-10";
      const dataset = generateMockInvestments(refMonth);

      expect(dataset.snapshots).toHaveLength(3);
      expect(dataset.snapshots[0]?.month).toBe("2026-08");
      expect(dataset.snapshots[1]?.month).toBe("2026-09");
      expect(dataset.snapshots[2]?.month).toBe("2026-10");

      // Patrimônio crescente
      const val0 = dataset.snapshots[0]?.total_value ?? 0;
      const val1 = dataset.snapshots[1]?.total_value ?? 0;
      const val2 = dataset.snapshots[2]?.total_value ?? 0;
      expect(val1).toBeGreaterThan(val0);
      expect(val2).toBeGreaterThan(val1);
    });

    it("gera proventos e aportes condizentes com o mês corrente", () => {
      const refMonth = "2026-10";
      const dataset = generateMockInvestments(refMonth);

      expect(dataset.contributions.length).toBeGreaterThan(0);
      expect(dataset.dividends.length).toBeGreaterThan(0);

      for (const d of dataset.dividends) {
        expect(d.date.startsWith(refMonth)).toBe(true);
        expect(d.amount).toBeGreaterThan(0);
      }
    });
  });

  describe("TOUR_STEPS e getTourSteps", () => {
    it("fornece 4 passos na trilha de finanças e 3 na de investimentos", () => {
      const financesSteps = getTourSteps("finances");
      const investmentsSteps = getTourSteps("investments");

      expect(financesSteps).toHaveLength(4);
      expect(investmentsSteps).toHaveLength(3);

      // Ordem sequencial
      expect(financesSteps.map((s) => s.order)).toEqual([1, 2, 3, 4]);
      expect(investmentsSteps.map((s) => s.order)).toEqual([1, 2, 3]);

      // Todas as rotas iniciam com '/'
      for (const step of [...financesSteps, ...investmentsSteps]) {
        expect(step.targetRoute.startsWith("/")).toBe(true);
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.description.trim().length).toBeGreaterThan(0);
      }
    });

    it("garante ausência total de emojis e caracteres decorativos nos textos do tour", () => {
      const allSteps = [...TOUR_STEPS.finances, ...TOUR_STEPS.investments];
      const emojiRegex = /\p{Extended_Pictographic}/u;

      for (const step of allSteps) {
        expect(emojiRegex.test(step.title)).toBe(false);
        expect(emojiRegex.test(step.description)).toBe(false);
        if (step.badgeLabel) {
          expect(emojiRegex.test(step.badgeLabel)).toBe(false);
        }
        if (step.actionLabel) {
          expect(emojiRegex.test(step.actionLabel)).toBe(false);
        }
      }
    });
  });
});
