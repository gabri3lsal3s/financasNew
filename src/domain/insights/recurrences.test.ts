import { describe, expect, it } from "vitest";
import {
  calculateRecurringTotals,
  calculateTypicalDay,
  classifyPriceAdjustment,
  detectDuplicateChargesInMonth,
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
import { normalizeText } from "./shared";

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
      expect(result.lifecycle).toBe("active");
    });

    it("identifica como 'lapsed' (descontinuada) e não gera data de cobrança no mês atual quando a última cobrança foi anterior a M-1", () => {
      // Ex.: hoje é 2026-10-22, mas a despesa parou em 2026-05 (há 5 meses)
      const result = estimateNextDueDate(22, "2026-05", "2026-10-22");
      expect(result.lifecycle).toBe("lapsed");
      expect(result.nextDueDate).toBeUndefined();
      expect(result.daysUntilNextDue).toBeUndefined();
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

  describe("Filtro Estrito Antirruído para Cobranças Duplicadas e Reajustes (Fase 4, Tarefa 4.3)", () => {
    describe("Regra de Duplicidade Antirruído", () => {
      it("NÃO sinaliza duplicidade para compras corriqueiras de mesmo valor em dias diferentes (Uber/iFood)", () => {
        // Exemplo: 3 corridas de Uber de R$ 20,00 nos dias 05, 12 e 20 de julho
        const uberTrips: ExpenseLike[] = [
          { id: "u1", description: "Uber Viagem", month: "2026-06", date: "2026-06-10", valueCents: 2000, categoryId: "transporte" },
          { id: "u2", description: "Uber Viagem", month: "2026-06", date: "2026-06-25", valueCents: 2000, categoryId: "transporte" },
          { id: "u3", description: "Uber Viagem", month: "2026-07", date: "2026-07-05", valueCents: 2000, categoryId: "transporte" },
          { id: "u4", description: "Uber Viagem", month: "2026-07", date: "2026-07-12", valueCents: 2000, categoryId: "transporte" },
          { id: "u5", description: "Uber Viagem", month: "2026-07", date: "2026-07-20", valueCents: 2000, categoryId: "transporte" },
        ];

        const occurrences = detectRecurrences(uberTrips);
        const uber = occurrences.find((o) => o.name === "Uber Viagem");

        expect(uber).toBeDefined();
        // Em dias diferentes NÃO é cobrança duplicada — é uso legítimo do serviço!
        expect(uber?.duplicateChargesThisMonth).toBeUndefined();
      });

      it("NÃO sinaliza duplicidade para compras no mesmo dia em horários diferentes", () => {
        // Duas corridas de Uber no mesmo dia: uma pela manhã (08:15) e outra à noite (18:45)
        const expenses: ExpenseLike[] = [
          { id: "e1", description: "Uber", month: "2026-07", date: "2026-07-10", time: "08:15", valueCents: 2500, categoryId: "transporte" },
          { id: "e2", description: "Uber", month: "2026-07", date: "2026-07-10", time: "18:45", valueCents: 2500, categoryId: "transporte" },
        ];

        const count = detectDuplicateChargesInMonth(expenses, false);
        expect(count).toBeUndefined();
      });

      it("SINALIZA duplicidade para compras de mesmo valor exato no mesmo dia e na mesma hora/minuto", () => {
        // Exemplo: transação duplicada na maquininha às 14:32:00
        const expenses: ExpenseLike[] = [
          { id: "d1", description: "Cafeteria Central", month: "2026-07", date: "2026-07-10", time: "14:32", valueCents: 1850, categoryId: "restaurante" },
          { id: "d2", description: "Cafeteria Central", month: "2026-07", date: "2026-07-10", time: "14:32", valueCents: 1850, categoryId: "restaurante" },
        ];

        const count = detectDuplicateChargesInMonth(expenses, false);
        expect(count).toBe(2);
      });

      it("SINALIZA duplicidade para compras com mesmo valor e data idêntica via string ISO", () => {
        const expenses: ExpenseLike[] = [
          { id: "d1", description: "Farmácia Saúde", month: "2026-07", date: "2026-07-15T10:15:30", valueCents: 4200, categoryId: "saude" },
          { id: "d2", description: "Farmácia Saúde", month: "2026-07", date: "2026-07-15T10:15:45", valueCents: 4200, categoryId: "saude" },
        ];

        // Mesmo minuto (10:15)
        const count = detectDuplicateChargesInMonth(expenses, false);
        expect(count).toBe(2);
      });

      it("SINALIZA duplicidade para compras com mesmo valor na mesma data quando não há timestamp de horário", () => {
        const expenses: ExpenseLike[] = [
          { id: "d1", description: "Livraria Cultura", month: "2026-07", date: "2026-07-22", valueCents: 8990, categoryId: "livros" },
          { id: "d2", description: "Livraria Cultura", month: "2026-07", date: "2026-07-22", valueCents: 8990, categoryId: "livros" },
        ];

        const count = detectDuplicateChargesInMonth(expenses, false);
        expect(count).toBe(2);
      });

      it("SINALIZA cobrança duplicada para serviços de assinatura de valor fixo mesmo em dias diferentes", () => {
        // Netflix cobrada dia 05 e depois cobrada novamente dia 20 de julho (erro de cobrança dupla no mês)
        const netflixCharges: ExpenseLike[] = [
          { id: "n1", description: "Netflix", month: "2026-06", date: "2026-06-05", valueCents: 3990, categoryId: "streaming", categoryName: "Streaming", categoryIcon: "tv" },
          { id: "n2", description: "Netflix", month: "2026-07", date: "2026-07-05", valueCents: 3990, categoryId: "streaming", categoryName: "Streaming", categoryIcon: "tv" },
          { id: "n3", description: "Netflix", month: "2026-07", date: "2026-07-20", valueCents: 3990, categoryId: "streaming", categoryName: "Streaming", categoryIcon: "tv" },
        ];

        const occurrences = detectRecurrences(netflixCharges);
        const sub = occurrences.find((o) => o.name === "Netflix");

        expect(sub).toBeDefined();
        expect(sub?.level).toBe("subscription");
        expect(sub?.duplicateChargesThisMonth).toBe(2);
      });

      it("NÃO sinaliza duplicidade em assinaturas se os valores forem completamente diferentes (mudança de plano)", () => {
        // Usuário pagou R$ 21,90 e depois R$ 55,90 em julho devido a upgrade
        const netflixCharges: ExpenseLike[] = [
          { id: "n1", description: "Netflix", month: "2026-06", date: "2026-06-05", valueCents: 2190, categoryId: "streaming", categoryName: "Streaming", categoryIcon: "tv" },
          { id: "n2", description: "Netflix", month: "2026-07", date: "2026-07-05", valueCents: 2190, categoryId: "streaming", categoryName: "Streaming", categoryIcon: "tv" },
          { id: "n3", description: "Netflix", month: "2026-07", date: "2026-07-20", valueCents: 5590, categoryId: "streaming", categoryName: "Streaming", categoryIcon: "tv" },
        ];

        const occurrences = detectRecurrences(netflixCharges);
        const sub = occurrences.find((o) => o.name === "Netflix");

        expect(sub).toBeDefined();
        // Não é duplicidade de valor fixo, pois 21,90 e 55,90 diferem em >10% da mediana
        expect(sub?.duplicateChargesThisMonth).toBeUndefined();
      });
    });

    describe("Regra de Reajuste: Diferenciação Inflacionária vs Mudança de Plano", () => {
      it("classifica reajuste inflacionário (10% a 30%) com rótulo canônico", () => {
        // Aumento de 15% (R$ 100,00 -> R$ 115,00)
        const adj15 = classifyPriceAdjustment(10000, 11500);
        expect(adj15).toBeDefined();
        expect(adj15?.percentIncrease).toBe(15);
        expect(adj15?.kind).toBe("inflationary");
        expect(adj15?.isInflationary).toBe(true);
        expect(adj15?.isPlanChange).toBe(false);
        expect(adj15?.label).toBe("Reajuste inflacionário");

        // Aumento de 30% (limite superior inflacionário)
        const adj30 = classifyPriceAdjustment(10000, 13000);
        expect(adj30?.kind).toBe("inflationary");
        expect(adj30?.isInflationary).toBe(true);
        expect(adj30?.isPlanChange).toBe(false);
      });

      it("classifica mudança de plano (>= 50%) com rótulo canônico", () => {
        // Aumento de 50% (R$ 20,00 -> R$ 30,00)
        const adj50 = classifyPriceAdjustment(2000, 3000);
        expect(adj50).toBeDefined();
        expect(adj50?.percentIncrease).toBe(50);
        expect(adj50?.kind).toBe("plan_change");
        expect(adj50?.isPlanChange).toBe(true);
        expect(adj50?.isInflationary).toBe(false);
        expect(adj50?.label).toBe("Mudança de plano");

        // Aumento de 80% (upgrade expressivo)
        const adj80 = classifyPriceAdjustment(5000, 9000);
        expect(adj80?.kind).toBe("plan_change");
        expect(adj80?.isPlanChange).toBe(true);
        expect(adj80?.isInflationary).toBe(false);
        expect(adj80?.label).toBe("Mudança de plano");
      });

      it("integra classificação de reajuste diretamente no detectRecurrences", () => {
        // Spotify aumentando de R$ 19,90 para R$ 24,90 (+25% -> inflacionário)
        const occurrences = detectRecurrences([
          { id: "s1", description: "Spotify", month: "2026-06", valueCents: 1990, categoryId: "streaming" },
          { id: "s2", description: "Spotify", month: "2026-07", valueCents: 1990, categoryId: "streaming" },
          { id: "s3", description: "Spotify", month: "2026-08", valueCents: 2490, categoryId: "streaming" }, // +25%
        ]);

        const spotify = occurrences.find((o) => o.name === "Spotify");
        expect(spotify?.priceAdjustment).toBeDefined();
        expect(spotify?.priceAdjustment?.percentIncrease).toBe(25);
        expect(spotify?.priceAdjustment?.kind).toBe("inflationary");
        expect(spotify?.priceAdjustment?.isInflationary).toBe(true);
        expect(spotify?.priceAdjustment?.label).toBe("Reajuste inflacionário");
      });

      it("integra mudança de plano no detectRecurrences quando aumento é >= 50%", () => {
        // Academia de R$ 99,00 para R$ 169,00 (+71% -> mudança de plano)
        const occurrences = detectRecurrences([
          { id: "g1", description: "Smart Fit", month: "2026-06", valueCents: 9900, categoryId: "fitness" },
          { id: "g2", description: "Smart Fit", month: "2026-07", valueCents: 9900, categoryId: "fitness" },
          { id: "g3", description: "Smart Fit", month: "2026-08", valueCents: 16900, categoryId: "fitness" }, // +71%
        ]);

        const gym = occurrences.find((o) => o.name === "Smart Fit");
        expect(gym?.priceAdjustment).toBeDefined();
        expect(gym?.priceAdjustment?.percentIncrease).toBe(71);
        expect(gym?.priceAdjustment?.kind).toBe("plan_change");
        expect(gym?.priceAdjustment?.isPlanChange).toBe(true);
        expect(gym?.priceAdjustment?.label).toBe("Mudança de plano");
      });

      it("ignora aumentos abaixo de 10% ou reduções de preço", () => {
        expect(classifyPriceAdjustment(10000, 10500)).toBeNull(); // +5%
        expect(classifyPriceAdjustment(10000, 10900)).toBeNull(); // +9%
        expect(classifyPriceAdjustment(10000, 9000)).toBeNull(); // -10%
        expect(classifyPriceAdjustment(0, 5000)).toBeNull();
      });
    });
  });

  describe("Higiene Conceitual e Expurgamento do Nível similar (Fase 7 — Tarefa 7.1)", () => {
    it("não gera recorrências para despesas corriqueiras com descrições distintas na mesma categoria", () => {
      const expenses: ExpenseLike[] = [
        { id: "e1", description: "Cinema Cineart", month: "2026-07", valueCents: 4500, categoryId: "lazer" },
        { id: "e2", description: "Show de Teatro", month: "2026-08", valueCents: 5000, categoryId: "lazer" },
        { id: "e3", description: "Parque de Diversões", month: "2026-09", valueCents: 4800, categoryId: "lazer" },
      ];

      const detected = detectRecurrences(expenses);
      expect(detected).toHaveLength(0);
      expect(detected.some((d) => (d.level as string) === "similar" || d.name.includes("similares"))).toBe(false);
    });

    it("calculateRecurringTotals soma exclusivamente subscription e recurring, descartando similar", () => {
      const occurrences = [
        { averageCents: 3500, tier: "can_cut" as const, savingsIfCutCents: 3500, level: "subscription" },
        { averageCents: 12000, tier: "essential" as const, level: "recurring" },
        { averageCents: 8000, tier: "can_cut" as const, savingsIfCutCents: 8000, level: "similar" },
      ];

      const totals = calculateRecurringTotals(occurrences);
      // Apenas 3500 + 12000 = 15500 (ignora os 8000 do similar)
      expect(totals.totalRecurringCents).toBe(15500);
      expect(totals.totalAnnualRecurringCents).toBe(15500 * 12);
      // Economia de corte: apenas os 3500 da assinatura can_cut (ignora 8000 do similar)
      expect(totals.canCutRecurringCents).toBe(3500);
      expect(totals.canCutAnnualCents).toBe(3500 * 12);
    });
  });

  describe("Sanitização Temporal & Concessionárias Brasileiras (Fase 7 — Tarefa 7.2)", () => {
    it("agrupa despesas com meses, referências e competências no nome", () => {
      const expenses: ExpenseLike[] = [
        { id: "c1", description: "Condomínio Jan", month: "2026-01", valueCents: 85000, categoryId: "moradia" },
        { id: "c2", description: "Condomínio Fev", month: "2026-02", valueCents: 85000, categoryId: "moradia" },
        { id: "c3", description: "Condomínio Março", month: "2026-03", valueCents: 85000, categoryId: "moradia" },
      ];

      const detected = detectRecurrences(expenses);
      expect(detected).toHaveLength(1);
      const cond = detected[0];
      expect(cond?.name).toBe("Condomínio");
      expect(cond?.averageCents).toBe(85000);
      expect(cond?.months).toEqual(["2026-01", "2026-02", "2026-03"]);
    });

    it("agrupa despesas com datas no formato MM/AA e MM/AAAA", () => {
      const expenses: ExpenseLike[] = [
        { id: "a1", description: "Aluguel 01/26", month: "2026-01", valueCents: 200000, categoryId: "moradia" },
        { id: "a2", description: "Aluguel 02/26", month: "2026-02", valueCents: 200000, categoryId: "moradia" },
      ];

      const detected = detectRecurrences(expenses);
      expect(detected).toHaveLength(1);
      expect(detected[0]?.name).toBe("Aluguel");
      expect(detected[0]?.averageCents).toBe(200000);
    });

    it("unifica despesas que compartilham a mesma serviceKey (ex.: Netflix Brasil e Netflix Com)", () => {
      const expenses: ExpenseLike[] = [
        { id: "n1", description: "Netflix Brasil", month: "2026-01", valueCents: 5590, categoryId: "lazer" },
        { id: "n2", description: "Netflix Com", month: "2026-02", valueCents: 5590, categoryId: "lazer" },
      ];

      const detected = detectRecurrences(expenses);
      expect(detected).toHaveLength(1);
      const sub = detected[0];
      expect(sub?.level).toBe("subscription");
      expect(sub?.segment).toBe("streaming");
      expect(sub?.tier).toBe("can_cut");
      expect(sub?.averageCents).toBe(5590);
    });

    it("identifica concessionárias públicas de energia, água e gás com tier essential e segment utilities", () => {
      const expenses: ExpenseLike[] = [
        // Energia
        { id: "e1", description: "Enel SP - 01/2026", month: "2026-01", valueCents: 18000, categoryId: "moradia" },
        { id: "e2", description: "Enel SP - 02/2026", month: "2026-02", valueCents: 21000, categoryId: "moradia" },
        // Água
        { id: "s1", description: "Sabesp ref 01", month: "2026-01", valueCents: 9500, categoryId: "moradia" },
        { id: "s2", description: "Sabesp ref 02", month: "2026-02", valueCents: 9800, categoryId: "moradia" },
        // Gás
        { id: "g1", description: "Comgás comp 01/26", month: "2026-01", valueCents: 6200, categoryId: "moradia" },
        { id: "g2", description: "Comgás comp 02/26", month: "2026-02", valueCents: 6400, categoryId: "moradia" },
      ];

      const detected = detectRecurrences(expenses);
      expect(detected.length).toBeGreaterThanOrEqual(3);

      const enel = detected.find((d) => d.name.toLowerCase().includes("enel"));
      expect(enel).toBeDefined();
      expect(enel?.tier).toBe("essential");
      expect(enel?.segment).toBe("utilities");
      expect(enel?.name).toBe("Enel SP");

      const sabesp = detected.find((d) => normalizeText(d.name).includes("sabesp"));
      expect(sabesp).toBeDefined();
      expect(sabesp?.tier).toBe("essential");
      expect(sabesp?.segment).toBe("utilities");
      expect(sabesp?.name).toBe("Sabesp");

      const comgas = detected.find((d) => normalizeText(d.name).includes("comgas"));
      expect(comgas).toBeDefined();
      expect(comgas?.tier).toBe("essential");
      expect(comgas?.segment).toBe("utilities");
      expect(comgas?.name).toBe("Comgás");
    });

    it("sanitiza menções temporais em receitas recorrentes (detectIncomeRecurrences)", () => {
      const incomes: IncomeLike[] = [
        { id: "i1", description: "Salário Jan", month: "2026-01", valueCents: 600000, categoryId: "salario" },
        { id: "i2", description: "Salário Fev", month: "2026-02", valueCents: 600000, categoryId: "salario" },
        { id: "i3", description: "Salário Março", month: "2026-03", valueCents: 600000, categoryId: "salario" },
      ];

      const detected = detectIncomeRecurrences(incomes);
      expect(detected).toHaveLength(1);
      expect(detected[0]?.name).toBe("Salário");
      expect(detected[0]?.averageCents).toBe(600000);
    });
  });

  describe("Correção de Calendário de Vencimentos & Blindagem Antirruído de Alertas (Fase 7 — Tarefa 7.3)", () => {
    describe("estimateNextDueDate com total real de dias do mês", () => {
      it("preserva dia 31 para meses de 31 dias", () => {
        // Julho tem 31 dias
        const result = estimateNextDueDate(31, "2026-06", "2026-07-05");
        expect(result.nextDueDate).toBe("2026-07-31");
      });

      it("limita ao dia 30 para meses de 30 dias", () => {
        // Setembro tem 30 dias
        const result = estimateNextDueDate(31, "2026-08", "2026-09-05");
        expect(result.nextDueDate).toBe("2026-09-30");
      });

      it("limita ao dia 28 em fevereiro de ano comum", () => {
        // Fevereiro 2026 tem 28 dias
        const result = estimateNextDueDate(31, "2026-01", "2026-02-05");
        expect(result.nextDueDate).toBe("2026-02-28");
      });

      it("limita ao dia 29 em fevereiro de ano bissexto", () => {
        // Fevereiro 2024 tem 29 dias (bissexto)
        const result = estimateNextDueDate(31, "2024-01", "2024-02-05");
        expect(result.nextDueDate).toBe("2024-02-29");
      });
    });

    describe("Blindagem Antirruído de Duplicidades", () => {
      it("NÃO sinaliza duplicidade para concessionárias públicas em dias diferentes no mesmo mês", () => {
        const enelCharges: ExpenseLike[] = [
          { id: "e1", description: "Enel", month: "2026-06", date: "2026-06-10", valueCents: 15000, categoryId: "moradia" },
          { id: "e2", description: "Enel", month: "2026-07", date: "2026-07-05", valueCents: 15000, categoryId: "moradia" },
          { id: "e3", description: "Enel", month: "2026-07", date: "2026-07-28", valueCents: 15000, categoryId: "moradia" },
        ];

        const occurrences = detectRecurrences(enelCharges);
        const enel = occurrences.find((o) => normalizeText(o.name).includes("enel"));
        expect(enel).toBeDefined();
        // Concessionárias não possuem valor fixo contratual — duas contas em dias diferentes não é duplicidade de assinatura
        expect(enel?.duplicateChargesThisMonth).toBeUndefined();
      });
    });

    describe("Diferenciação de Reajuste Contratual vs Variação Sazonal de Consumo", () => {
      it("rotula como 'Variação de consumo' para concessionárias do segmento utilities", () => {
        const adj = classifyPriceAdjustment(10000, 12500, "utilities"); // +25%
        expect(adj).toBeDefined();
        expect(adj?.kind).toBe("consumption_variation");
        expect(adj?.label).toBe("Variação de consumo");
        expect(adj?.isConsumptionVariation).toBe(true);
        expect(adj?.isInflationary).toBe(false);
        expect(adj?.isPlanChange).toBe(false);
      });

      it("rotula como 'Reajuste inflacionário' para planos fixos com aumento entre 10% e 30%", () => {
        const adj = classifyPriceAdjustment(10000, 12000, "streaming"); // +20%
        expect(adj).toBeDefined();
        expect(adj?.kind).toBe("inflationary");
        expect(adj?.label).toBe("Reajuste inflacionário");
        expect(adj?.isInflationary).toBe(true);
      });

      it("rotula como 'Mudança de plano' para planos fixos com aumento >= 50%", () => {
        const adj = classifyPriceAdjustment(10000, 16000, "streaming"); // +60%
        expect(adj).toBeDefined();
        expect(adj?.kind).toBe("plan_change");
        expect(adj?.label).toBe("Mudança de plano");
        expect(adj?.isPlanChange).toBe(true);
      });

      it("integra 'Variação de consumo' no detectRecurrences para concessionárias", () => {
        const expenses: ExpenseLike[] = [
          { id: "e1", description: "Enel", month: "2026-05", valueCents: 10000, categoryId: "moradia" },
          { id: "e2", description: "Enel", month: "2026-06", valueCents: 10000, categoryId: "moradia" },
          { id: "e3", description: "Enel", month: "2026-07", valueCents: 13000, categoryId: "moradia" }, // +30%
        ];

        const occurrences = detectRecurrences(expenses);
        const enel = occurrences.find((o) => normalizeText(o.name).includes("enel"));
        expect(enel).toBeDefined();
        expect(enel?.priceAdjustment).toBeDefined();
        expect(enel?.priceAdjustment?.kind).toBe("consumption_variation");
        expect(enel?.priceAdjustment?.label).toBe("Variação de consumo");
      });

      it("anexa o histórico de despesas ordenado do mais recente ao mais antigo em cada ocorrência", () => {
        const expenses: ExpenseLike[] = [
          { id: "e1", description: "Netflix", date: "2026-05-10", month: "2026-05", valueCents: 3990, categoryId: "lazer" },
          { id: "e2", description: "Netflix", date: "2026-07-10", month: "2026-07", valueCents: 3990, categoryId: "lazer" },
          { id: "e3", description: "Netflix", date: "2026-06-10", month: "2026-06", valueCents: 3990, categoryId: "lazer" },
        ];

        const occurrences = detectRecurrences(expenses);
        const netflix = occurrences.find((o) => o.name.toLowerCase().includes("netflix"));
        expect(netflix).toBeDefined();
        expect(netflix?.expenses).toHaveLength(3);
        expect(netflix?.expenses?.[0]?.id).toBe("e2"); // 2026-07-10
        expect(netflix?.expenses?.[1]?.id).toBe("e3"); // 2026-06-10
        expect(netflix?.expenses?.[2]?.id).toBe("e1"); // 2026-05-10
      });

      it("mapeia a forma de pagamento e cartão habitual em cada ocorrência (F22 / Tarefa 7.6)", () => {
        const expenses: ExpenseLike[] = [
          {
            id: "e1",
            description: "Spotify",
            date: "2026-05-15",
            month: "2026-05",
            valueCents: 2190,
            categoryId: "lazer",
            paymentMethod: "credit_card",
            cardId: "card-nubank",
            cardName: "Nubank Ultravioleta",
          },
          {
            id: "e2",
            description: "Spotify",
            date: "2026-06-15",
            month: "2026-06",
            valueCents: 2190,
            categoryId: "lazer",
            paymentMethod: "credit_card",
            cardId: "card-nubank",
            cardName: "Nubank Ultravioleta",
          },
          {
            id: "e3",
            description: "Spotify",
            date: "2026-07-15",
            month: "2026-07",
            valueCents: 2190,
            categoryId: "lazer",
            paymentMethod: "credit_card",
            cardId: "card-inter",
            cardName: "Inter Gold",
          },
        ];

        const occurrences = detectRecurrences(expenses);
        const spotify = occurrences.find((o) => o.name.toLowerCase().includes("spotify"));
        expect(spotify).toBeDefined();
        expect(spotify?.paymentMethod).toBe("credit_card");
        // Nubank teve 2 cobranças contra 1 do Inter -> Nubank é o cartão habitual
        expect(spotify?.cardId).toBe("card-nubank");
        expect(spotify?.cardName).toBe("Nubank Ultravioleta");
      });

      it("detecta despesas descontinuadas como 'lapsed' quando cessaram há 2+ meses (Sabor do Bem / Burger King)", () => {
        const expenses: ExpenseLike[] = [
          {
            id: "e1",
            description: "Almoço Sabor do Bem",
            date: "2026-04-22",
            month: "2026-04",
            valueCents: 9150,
            categoryId: "alimentacao",
          },
          {
            id: "e2",
            description: "Almoço Sabor do Bem",
            date: "2026-05-22",
            month: "2026-05",
            valueCents: 9150,
            categoryId: "alimentacao",
          },
          {
            id: "e3",
            description: "Google AI Pro",
            date: "2026-09-07",
            month: "2026-09",
            valueCents: 6799,
            categoryId: "servicos",
          },
          {
            id: "e4",
            description: "Google AI Pro",
            date: "2026-10-07",
            month: "2026-10",
            valueCents: 6799,
            categoryId: "servicos",
          },
        ];

        // Hoje é 2026-10-22. Sabor do Bem parou em 2026-05 (> M-1).
        const occurrences = detectRecurrences(expenses, { todayISO: "2026-10-22" });

        const saborDoBem = occurrences.find((o) => o.name.includes("Sabor do Bem"));
        expect(saborDoBem).toBeDefined();
        expect(saborDoBem?.lifecycle).toBe("lapsed");
        expect(saborDoBem?.nextDueDate).toBeUndefined();
        expect(saborDoBem?.missingThisMonth).toBe(false);

        const googleAI = occurrences.find((o) => o.name.includes("Google AI"));
        expect(googleAI).toBeDefined();
        expect(googleAI?.lifecycle).toBe("active");
        expect(googleAI?.nextDueDate).toBeDefined();

        // calculateRecurringTotals descarta lapsed e soma apenas despesas ativas
        const totals = calculateRecurringTotals(occurrences);
        expect(totals.totalRecurringCents).toBe(6799); // Apenas Google AI Pro, sem os R$ 91,50 do Sabor do Bem
      });
    });
  });
});
