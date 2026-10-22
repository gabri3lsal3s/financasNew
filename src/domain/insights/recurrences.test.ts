import { describe, expect, it } from "vitest";
import {
  calculateTypicalDay,
  detectIncomeRecurrences,
  detectRecurrences,
  estimateNextDueDate,
  evaluateBudgetImpact,
  formatBRL,
  VAMPIRE_CATEGORY_BUDGET_IMPACT_THRESHOLD_PERCENT,
  VAMPIRE_INCOME_IMPACT_THRESHOLD_PERCENT,
  type ExpenseLike,
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

  describe("evaluateBudgetImpact e Gastos Vampiros (Fase 4, Tarefa 4.2)", () => {
    describe("Cálculo do Custo Projetado Anual", () => {
      it("calcula o custo projetado anual (ex.: 'Essa assinatura custa R$ 1.080,00 por ano' para R$ 90,00/mês)", () => {
        const evaluation = evaluateBudgetImpact({
          name: "Clube de Assinatura",
          averageCents: 9000, // R$ 90,00
        });

        expect(evaluation.annualCostCents).toBe(108000); // 90 * 12 = 1.080,00
        expect(evaluation.annualCostFormatted).toBe("R$ 1.080,00");
        expect(evaluation.annualCostMessage).toBe("Essa assinatura custa R$ 1.080,00 por ano");
      });

      it("calcula valores com centavos fracionados (ex.: R$ 29,90/mês -> R$ 358,80/ano)", () => {
        const evaluation = evaluateBudgetImpact({
          name: "Streaming Premium",
          averageCents: 2990, // R$ 29,90
        });

        expect(evaluation.annualCostCents).toBe(35880);
        expect(evaluation.annualCostFormatted).toBe("R$ 358,80");
        expect(evaluation.annualCostMessage).toBe("Essa assinatura custa R$ 358,80 por ano");
      });

      it("trata valores nulos ou negativos com segurança", () => {
        const evaluation = evaluateBudgetImpact({
          name: "Serviço Inativo",
          averageCents: 0,
        });

        expect(evaluation.annualCostCents).toBe(0);
        expect(evaluation.annualCostFormatted).toBe("R$ 0,00");
        expect(evaluation.annualCostMessage).toBe("Essa assinatura custa R$ 0,00 por ano");
        expect(evaluation.isVampire).toBe(false);
      });
    });

    describe("Threshold de Renda Mensal (>= 15%)", () => {
      it("sinaliza highIncomeImpact quando compromete exatamente ou mais de 15% da renda mensal", () => {
        // R$ 1.500,00 de R$ 10.000,00 = exatamente 15.00%
        const exactly15 = evaluateBudgetImpact(
          { name: "Plano de Saúde", averageCents: 150000 },
          1000000,
        );

        expect(exactly15.incomeSharePercent).toBe(15);
        expect(exactly15.highIncomeImpact).toBe(true);
        expect(exactly15.hasHighBudgetImpact).toBe(true);
        expect(exactly15.recommendationMessage).toBe("Compromete 15% da sua renda mensal.");
      });

      it("não sinaliza quando compromete menos de 15% da renda", () => {
        // R$ 1.490,00 de R$ 10.000,00 = 14.90%
        const under15 = evaluateBudgetImpact(
          { name: "Seguro Auto", averageCents: 149000 },
          1000000,
        );

        expect(under15.incomeSharePercent).toBe(14.9);
        expect(under15.highIncomeImpact).toBe(false);
      });

      it("exporta a constante de threshold canônica de renda (15%)", () => {
        expect(VAMPIRE_INCOME_IMPACT_THRESHOLD_PERCENT).toBe(15);
      });
    });

    describe("Threshold de Orçamento da Categoria (>= 30%)", () => {
      it("sinaliza highCategoryBudgetImpact quando compromete exatamente ou mais de 30% do orçamento da categoria", () => {
        // R$ 300,00 de R$ 1.000,00 = exatamente 30.00%
        const exactly30 = evaluateBudgetImpact(
          { name: "Academia", averageCents: 30000 },
          undefined,
          100000,
        );

        expect(exactly30.categoryBudgetSharePercent).toBe(30);
        expect(exactly30.highCategoryBudgetImpact).toBe(true);
        expect(exactly30.hasHighBudgetImpact).toBe(true);
        expect(exactly30.recommendationMessage).toBe("Compromete 30% do orçamento da categoria.");
      });

      it("não sinaliza quando compromete menos de 30% do orçamento da categoria", () => {
        // R$ 290,00 de R$ 1.000,00 = 29.00%
        const under30 = evaluateBudgetImpact(
          { name: "Suplementos", averageCents: 29000 },
          undefined,
          100000,
        );

        expect(under30.categoryBudgetSharePercent).toBe(29);
        expect(under30.highCategoryBudgetImpact).toBe(false);
      });

      it("exporta a constante de threshold canônica de categoria (30%)", () => {
        expect(VAMPIRE_CATEGORY_BUDGET_IMPACT_THRESHOLD_PERCENT).toBe(30);
      });
    });

    describe("Impacto Conjunto e Mensagem de Recomendação", () => {
      it("gera mensagem combinada quando compromete simultaneamente a renda e o orçamento da categoria", () => {
        const dualImpact = evaluateBudgetImpact(
          { name: "Mensalidade Escolar", averageCents: 180000 }, // R$ 1.800,00
          1000000, // Renda: R$ 10.000,00 (18%)
          300000, // Categoria Educação: R$ 3.000,00 (60%)
        );

        expect(dualImpact.highIncomeImpact).toBe(true);
        expect(dualImpact.highCategoryBudgetImpact).toBe(true);
        expect(dualImpact.hasHighBudgetImpact).toBe(true);
        expect(dualImpact.recommendationMessage).toBe(
          "Compromete 18% da sua renda e 60% do orçamento da categoria.",
        );
      });
    });

    describe("Identificação de Gastos Vampiros (isVampire)", () => {
      it("classifica assinaturas com potencial de corte ('can_cut') como gasto vampiro, mesmo com baixo impacto individual", () => {
        // Assinatura de R$ 19,90 em uma renda de R$ 10.000 (0.20% da renda)
        const streaming = evaluateBudgetImpact(
          {
            name: "Serviço Esquecido",
            averageCents: 1990,
            tier: "can_cut",
          },
          1000000,
          50000,
        );

        expect(streaming.hasHighBudgetImpact).toBe(false);
        expect(streaming.isVampire).toBe(true);
        expect(streaming.recommendationMessage).toBe(
          "Assinatura com potencial de corte. Economia projetada de R$ 238,80 por ano.",
        );
      });

      it("classifica gastos discricionários ('discretionary') como gasto vampiro", () => {
        const discSub = evaluateBudgetImpact({
          name: "Revista Online",
          averageCents: 4500,
          tier: "discretionary",
        });

        expect(discSub.isVampire).toBe(true);
        expect(discSub.recommendationMessage).toBe("Gasto discricionário sugerido para revisão.");
      });

      it("NÃO classifica despesas essenciais ('essential') como gasto vampiro, mesmo com alto impacto orçamentário", () => {
        // Aluguel comprometendo 35% da renda
        const rent = evaluateBudgetImpact(
          {
            name: "Aluguel",
            averageCents: 350000, // R$ 3.500,00
            tier: "essential",
          },
          1000000, // R$ 10.000,00
        );

        expect(rent.highIncomeImpact).toBe(true);
        expect(rent.hasHighBudgetImpact).toBe(true);
        expect(rent.isVampire).toBe(false); // Gasto essencial nunca é vampiro
      });

      it("classifica despesas sem tier mas com alto impacto como gasto vampiro", () => {
        const highSpend = evaluateBudgetImpact(
          {
            name: "Compras Frequentes Delivery",
            averageCents: 160000, // 16% da renda
          },
          1000000,
        );

        expect(highSpend.highIncomeImpact).toBe(true);
        expect(highSpend.isVampire).toBe(true);
      });

      it("não classifica despesas corriqueiras de baixo impacto como gasto vampiro", () => {
        const normalSpend = evaluateBudgetImpact(
          {
            name: "Padaria",
            averageCents: 8000, // R$ 80,00
          },
          1000000, // R$ 10.000,00
          100000, // R$ 1.000,00
        );

        expect(normalSpend.hasHighBudgetImpact).toBe(false);
        expect(normalSpend.isVampire).toBe(false);
        expect(normalSpend.recommendationMessage).toBeUndefined();
      });
    });

    describe("formatBRL", () => {
      it("formata centavos no padrão monetário BRL puro", () => {
        expect(formatBRL(108000)).toBe("R$ 1.080,00");
        expect(formatBRL(35880)).toBe("R$ 358,80");
        expect(formatBRL(99)).toBe("R$ 0,99");
        expect(formatBRL(0)).toBe("R$ 0,00");
        expect(formatBRL(-500)).toBe("R$ 0,00");
      });
    });

    describe("Integração com detectRecurrences", () => {
      it("anexa avaliação de budgetImpact quando opções de renda ou orçamento são fornecidas", () => {
        const expenses: ExpenseLike[] = [
          {
            id: "e1",
            description: "Spotify Premium",
            month: "2026-08",
            date: "2026-08-10",
            valueCents: 3490,
            categoryId: "cat-streaming",
            categoryName: "Streaming",
            categoryIcon: "music",
          },
          {
            id: "e2",
            description: "Spotify Premium",
            month: "2026-09",
            date: "2026-09-10",
            valueCents: 3490,
            categoryId: "cat-streaming",
            categoryName: "Streaming",
            categoryIcon: "music",
          },
        ];

        const occurrences = detectRecurrences(expenses, {
          monthlyIncomeCents: 500000, // R$ 5.000,00
          categoryBudgets: { "cat-streaming": 5000 }, // R$ 50,00
        });

        const spotify = occurrences.find((o) => o.level === "subscription");
        expect(spotify).toBeDefined();
        expect(spotify?.budgetImpact).toBeDefined();
        expect(spotify?.budgetImpact?.annualCostCents).toBe(41880);
        expect(spotify?.budgetImpact?.categoryBudgetSharePercent).toBeCloseTo(69.8, 1);
        expect(spotify?.budgetImpact?.highCategoryBudgetImpact).toBe(true);
        expect(spotify?.budgetImpact?.hasHighBudgetImpact).toBe(true);
      });
    });
  });
});
