import { describe, expect, it } from "vitest";
import {
  calculateTypicalDay,
  detectIncomeRecurrences,
  estimateNextDueDate,
  type IncomeLike,
} from "./recurrences";

describe("domain/insights/recurrences — Detecção Dual de Rendas (Fase 4, Tarefa 4.1)", () => {
  describe("calculateTypicalDay e estimateNextDueDate para Rendas", () => {
    it("calcula o dia mediano típico a partir das datas históricas de recebimento", () => {
      const dates = ["2026-07-05", "2026-08-05", "2026-09-06", "2026-10-04"];
      expect(calculateTypicalDay(dates)).toBe(5);
    });

    it("prevê a data esperada do mês corrente quando o dia típico ainda não passou", () => {
      const result = estimateNextDueDate(5, "2026-09", "2026-10-02");
      expect(result.nextDueDate).toBe("2026-10-05");
      expect(result.daysUntilNextDue).toBe(3);
      expect(result.missingThisMonth).toBe(false);
    });

    it("sinaliza missingThisMonth quando a receita habitual não ocorreu e o dia típico já passou", () => {
      const result = estimateNextDueDate(5, "2026-09", "2026-10-12");
      expect(result.nextDueDate).toBe("2026-10-05");
      expect(result.daysUntilNextDue).toBe(-7);
      expect(result.missingThisMonth).toBe(true);
    });

    it("projeta para o mês seguinte quando a receita do mês corrente já foi recebida", () => {
      const result = estimateNextDueDate(5, "2026-10", "2026-10-12");
      expect(result.nextDueDate).toBe("2026-11-05");
      expect(result.daysUntilNextDue).toBe(24);
      expect(result.missingThisMonth).toBe(false);
    });
  });

  describe("detectIncomeRecurrences — Perfil 1 (Renda Fixa / CLT)", () => {
    it("classifica como 'fixed' e sugere 'one_touch_confirm' quando valor é estável (desvio <= 10%) e dia é regular (desvio <= 2 dias)", () => {
      const cltIncomes: IncomeLike[] = [
        {
          id: "inc-1",
          description: "Salário ACME Corp",
          month: "2026-07",
          date: "2026-07-05",
          valueCents: 500000, // R$ 5.000,00
          categoryId: "cat-salario",
        },
        {
          id: "inc-2",
          description: "Salário ACME Corp",
          month: "2026-08",
          date: "2026-08-05",
          valueCents: 500000,
          categoryId: "cat-salario",
        },
        {
          id: "inc-3",
          description: "Salário ACME Corp",
          month: "2026-09",
          date: "2026-09-04", // Sexta-feira útil
          valueCents: 500000,
          categoryId: "cat-salario",
        },
        {
          id: "inc-4",
          description: "Salário ACME Corp",
          month: "2026-10",
          date: "2026-10-05",
          valueCents: 500000,
          categoryId: "cat-salario",
        },
      ];

      const detected = detectIncomeRecurrences(cltIncomes, { todayISO: "2026-10-15" });

      expect(detected).toHaveLength(1);
      const sal = detected[0]!;
      expect(sal.profile).toBe("fixed");
      expect(sal.suggestedAction).toBe("one_touch_confirm");
      expect(sal.averageCents).toBe(500000);
      expect(sal.lastValueCents).toBe(500000);
      expect(sal.typicalDayOfMonth).toBe(5);
      expect(sal.confidence).toBeGreaterThan(0.8);
      expect(sal.missingThisMonth).toBe(false);
      expect(sal.expectedDate).toBe("2026-11-05");
    });

    it("detecta missingThisMonth quando o salário esperado no dia 5 ainda não foi recebido até o dia 10", () => {
      const cltIncomes: IncomeLike[] = [
        {
          id: "inc-1",
          description: "Salário Tech Ltda",
          month: "2026-07",
          date: "2026-07-05",
          valueCents: 850000,
          categoryId: "cat-salario",
        },
        {
          id: "inc-2",
          description: "Salário Tech Ltda",
          month: "2026-08",
          date: "2026-08-05",
          valueCents: 850000,
          categoryId: "cat-salario",
        },
        {
          id: "inc-3",
          description: "Salário Tech Ltda",
          month: "2026-09",
          date: "2026-09-05",
          valueCents: 850000,
          categoryId: "cat-salario",
        },
      ];

      const detected = detectIncomeRecurrences(cltIncomes, { todayISO: "2026-10-10" });

      expect(detected).toHaveLength(1);
      const sal = detected[0]!;
      expect(sal.profile).toBe("fixed");
      expect(sal.suggestedAction).toBe("one_touch_confirm");
      expect(sal.missingThisMonth).toBe(true);
      expect(sal.expectedDate).toBe("2026-10-05");
      expect(sal.daysUntilExpected).toBe(-5);
    });

    it("aceita pequena variação salarial (ex.: reajuste de dissídio ou horas extras < 10%) como fixed", () => {
      const cltIncomes: IncomeLike[] = [
        {
          id: "inc-1",
          description: "Pró-Labore",
          month: "2026-07",
          date: "2026-07-10",
          valueCents: 400000,
          categoryId: "cat-pro-labore",
        },
        {
          id: "inc-2",
          description: "Pró-Labore",
          month: "2026-08",
          date: "2026-08-10",
          valueCents: 420000, // +5%
          categoryId: "cat-pro-labore",
        },
        {
          id: "inc-3",
          description: "Pró-Labore",
          month: "2026-09",
          date: "2026-09-10",
          valueCents: 420000,
          categoryId: "cat-pro-labore",
        },
      ];

      const detected = detectIncomeRecurrences(cltIncomes);
      expect(detected).toHaveLength(1);
      expect(detected[0]?.profile).toBe("fixed");
      expect(detected[0]?.suggestedAction).toBe("one_touch_confirm");
    });
  });

  describe("detectIncomeRecurrences — Perfil 2 (Cliente Frequente / Freelancer)", () => {
    it("classifica como 'frequent_client' e sugere 'open_value_input' quando há recorrência mensal de pagador com valor variável", () => {
      const freelancerIncomes: IncomeLike[] = [
        {
          id: "f-1",
          description: "Cliente Beta Design",
          month: "2026-07",
          date: "2026-07-15",
          valueCents: 250000, // R$ 2.500,00
          categoryId: "cat-freelance",
        },
        {
          id: "f-2",
          description: "Cliente Beta Design",
          month: "2026-08",
          date: "2026-08-20",
          valueCents: 450000, // R$ 4.500,00 (+80%)
          categoryId: "cat-freelance",
        },
        {
          id: "f-3",
          description: "Cliente Beta Design",
          month: "2026-09",
          date: "2026-09-18",
          valueCents: 320000, // R$ 3.200,00
          categoryId: "cat-freelance",
        },
      ];

      const detected = detectIncomeRecurrences(freelancerIncomes, { todayISO: "2026-10-01" });

      expect(detected).toHaveLength(1);
      const client = detected[0]!;
      expect(client.profile).toBe("frequent_client");
      expect(client.suggestedAction).toBe("open_value_input");
      expect(client.averageCents).toBe(340000); // Média de 2500, 4500 e 3200 = 3400
      expect(client.lastValueCents).toBe(320000);
      expect(client.valueVariationRatio).toBeGreaterThan(0.10);
      expect(client.missingThisMonth).toBe(false); // Hoje é dia 1, dia típico é ~18
    });

    it("processa simultaneamente salário CLT e múltiplos clientes freelancers", () => {
      const mixedIncomes: IncomeLike[] = [
        // Salário CLT
        { id: "s1", description: "Salário Principal", month: "2026-08", date: "2026-08-05", valueCents: 700000, categoryId: "c-sal" },
        { id: "s2", description: "Salário Principal", month: "2026-09", date: "2026-09-05", valueCents: 700000, categoryId: "c-sal" },
        // Cliente 1 (Freelance variável)
        { id: "c1-1", description: "Agência Criativa", month: "2026-08", date: "2026-08-15", valueCents: 150000, categoryId: "c-free" },
        { id: "c1-2", description: "Agência Criativa", month: "2026-09", date: "2026-09-22", valueCents: 300000, categoryId: "c-free" },
        // Cliente 2 (Freelance variável)
        { id: "c2-1", description: "Consultoria Startup X", month: "2026-08", date: "2026-08-10", valueCents: 200000, categoryId: "c-free" },
        { id: "c2-2", description: "Consultoria Startup X", month: "2026-09", date: "2026-09-12", valueCents: 400000, categoryId: "c-free" },
      ];

      const detected = detectIncomeRecurrences(mixedIncomes);

      expect(detected).toHaveLength(3);

      const clt = detected.find((d) => d.name === "Salário Principal");
      expect(clt?.profile).toBe("fixed");
      expect(clt?.suggestedAction).toBe("one_touch_confirm");

      const agency = detected.find((d) => d.name === "Agência Criativa");
      expect(agency?.profile).toBe("frequent_client");
      expect(agency?.suggestedAction).toBe("open_value_input");

      const startup = detected.find((d) => d.name === "Consultoria Startup X");
      expect(startup?.profile).toBe("frequent_client");
      expect(startup?.suggestedAction).toBe("open_value_input");
    });
  });

  describe("Filtros e Travas Anti-Ruído", () => {
    it("ignora receitas associadas a parcelas ou recorrências formais", () => {
      const incomes: IncomeLike[] = [
        {
          id: "inc-1",
          description: "Venda de Carro Parcelada",
          month: "2026-08",
          date: "2026-08-10",
          valueCents: 100000,
          categoryId: "cat-outros",
          installmentGroupId: "group-1",
        },
        {
          id: "inc-2",
          description: "Venda de Carro Parcelada",
          month: "2026-09",
          date: "2026-09-10",
          valueCents: 100000,
          categoryId: "cat-outros",
          installmentGroupId: "group-1",
        },
        {
          id: "inc-3",
          description: "Aluguel Recebido",
          month: "2026-08",
          date: "2026-08-01",
          valueCents: 200000,
          categoryId: "cat-aluguel",
          recurrenceId: "rec-formal-1",
        },
        {
          id: "inc-4",
          description: "Aluguel Recebido",
          month: "2026-09",
          date: "2026-09-01",
          valueCents: 200000,
          categoryId: "cat-aluguel",
          recurrenceId: "rec-formal-1",
        },
      ];

      const detected = detectIncomeRecurrences(incomes);
      expect(detected).toHaveLength(0);
    });

    it("ignora receitas ocorridas em apenas 1 mês isolado", () => {
      const incomes: IncomeLike[] = [
        {
          id: "inc-1",
          description: "Venda Pontual Mercado Livre",
          month: "2026-09",
          date: "2026-09-15",
          valueCents: 35000,
          categoryId: "cat-vendas",
        },
      ];

      const detected = detectIncomeRecurrences(incomes);
      expect(detected).toHaveLength(0);
    });
  });
});
