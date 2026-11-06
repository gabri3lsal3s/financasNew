import { describe, it, expect } from "vitest";
import {
  reconcileHouseholdSpending,
  calculateTotalSpentCents,
  calculateTotalIncomeCents,
  evaluateHouseholdHealth,
  resolveTargetRatios,
  calculateFairSharesCents,
  calculateHouseholdPace,
  auditPostSettlementActivity,
  validateHouseholdReconciliationInvariants,
  sanitizeCents,
  getDaysInMonth,
  resolveCompetenceMonthParts,
  type ReconciliationMemberInput,
  type ReconciliationExpenseInput,
  type ReconciliationSettlementInput,
} from "./reconciliation";

describe("reconciliation — Motor Puro de Reconciliação Familiar em Centavos", () => {
  // =========================================================================
  // 1. Sanitização e Totalização em Centavos
  // =========================================================================
  describe("1. Sanitização e Totalização em Centavos", () => {
    it("sanitiza valores inválidos, negativos ou NaN para zero centavos", () => {
      expect(sanitizeCents(undefined)).toBe(0);
      expect(sanitizeCents(null)).toBe(0);
      expect(sanitizeCents(Number.NaN)).toBe(0);
      expect(sanitizeCents(-500)).toBe(0);
      expect(sanitizeCents(1250.4)).toBe(1250);
      expect(sanitizeCents(1250.6)).toBe(1251);
    });

    it("soma corretamente lista de despesas da casa em centavos inteiros", () => {
      const expenses: ReconciliationExpenseInput[] = [
        { id: "e1", user_id: "u1", amount_cents: 35000, date: "2026-11-01" }, // R$ 350,00
        { id: "e2", user_id: "u2", amount_cents: 12550, date: "2026-11-02" }, // R$ 125,50
        { id: "e3", user_id: "u1", amount_cents: 7450, date: "2026-11-03" }, // R$ 74,50
      ];

      expect(calculateTotalSpentCents(expenses)).toBe(55000); // R$ 550,00
    });

    it("retorna zero para despesas vazias", () => {
      expect(calculateTotalSpentCents([])).toBe(0);
    });

    it("calcula total de receitas compartilhadas e fluxo de caixa da casa", () => {
      const incomes = [
        { user_id: "u1", amount_cents: 500000 }, // R$ 5.000,00
        { user_id: "u2", amount_cents: 400000 }, // R$ 4.000,00
      ];

      expect(calculateTotalIncomeCents(incomes)).toBe(900000);
      expect(calculateTotalIncomeCents([])).toBe(0);
      expect(calculateTotalIncomeCents(undefined)).toBe(0);
    });
  });

  // =========================================================================
  // 2. Avaliação de Saúde do Teto Orçamentário da Casa
  // =========================================================================
  describe("2. Avaliação de Saúde do Teto Orçamentário", () => {
    const ceilingCents = 1000000; // R$ 10.000,00

    it("avalia como 'comfort' quando os gastos são inferiores a 75% do teto", () => {
      const health = evaluateHouseholdHealth(500000, ceilingCents); // 50%
      expect(health.status).toBe("comfort");
      expect(health.spent_percentage).toBe(50.0);
      expect(health.display_spent_percentage).toBe("50,0%");
      expect(health.is_exceeded).toBe(false);
      expect(health.is_near_limit).toBe(false);
    });

    it("avalia como 'warning' na faixa entre 75% e 90%", () => {
      const health = evaluateHouseholdHealth(750000, ceilingCents); // 75%
      expect(health.status).toBe("warning");
      expect(health.spent_percentage).toBe(75.0);
      expect(health.status_label).toBe("Atenção ao teto");
      expect(health.is_near_limit).toBe(true);
      expect(health.is_exceeded).toBe(false);
    });

    it("avalia como 'danger' na faixa entre 90% e 100%", () => {
      const health = evaluateHouseholdHealth(950000, ceilingCents); // 95%
      expect(health.status).toBe("danger");
      expect(health.spent_percentage).toBe(95.0);
      expect(health.status_label).toBe("Alerta crítico");
      expect(health.is_near_limit).toBe(true);
      expect(health.is_exceeded).toBe(false);
    });

    it("avalia como 'exceeded' quando os gastos superam 100% do teto", () => {
      const health = evaluateHouseholdHealth(1050000, ceilingCents); // 105%
      expect(health.status).toBe("exceeded");
      expect(health.spent_percentage).toBe(105.0);
      expect(health.status_label).toBe("Teto ultrapassado");
      expect(health.is_near_limit).toBe(true);
      expect(health.is_exceeded).toBe(true);
    });

    it("trata defensivamente teto zero sem produzir divisão por zero ou NaN", () => {
      const zeroHealth = evaluateHouseholdHealth(0, 0);
      expect(zeroHealth.status).toBe("comfort");
      expect(zeroHealth.spent_percentage).toBe(0);

      const spentWithoutCeiling = evaluateHouseholdHealth(25000, 0);
      expect(spentWithoutCeiling.status).toBe("exceeded");
      expect(spentWithoutCeiling.status_label).toBe("Sem teto definido");
    });
  });

  // =========================================================================
  // 3. Proporções Alvo e Divisão Justa (Fair Shares)
  // =========================================================================
  describe("3. Proporções Alvo e Divisão Justa (Fair Share Math)", () => {
    const memberA: ReconciliationMemberInput = {
      user_id: "usr_a",
      display_name: "Gabriel",
      split_ratio: 0.6,
      income_cents: 600000,
    };
    const memberB: ReconciliationMemberInput = {
      user_id: "usr_b",
      display_name: "Mariana",
      split_ratio: 0.4,
      income_cents: 400000,
    };

    it("divide equitativamente 50/50 na regra 'equal'", () => {
      const targets = resolveTargetRatios([memberA, memberB], "equal");
      expect(targets).toHaveLength(2);
      expect(targets[0]?.target_ratio).toBe(0.5);
      expect(targets[1]?.target_ratio).toBe(0.5);
    });

    it("resolve proporções relativas na regra 'proportional' por split_ratio", () => {
      const targets = resolveTargetRatios([memberA, memberB], "proportional");
      expect(targets[0]?.target_ratio).toBeCloseTo(0.6, 5);
      expect(targets[1]?.target_ratio).toBeCloseTo(0.4, 5);
    });

    it("resolve proporções pela renda declarada caso split_ratio não esteja definido", () => {
      const m1: ReconciliationMemberInput = { user_id: "u1", income_cents: 800000 }; // 8k (80%)
      const m2: ReconciliationMemberInput = { user_id: "u2", income_cents: 200000 }; // 2k (20%)

      const targets = resolveTargetRatios([m1, m2], "proportional");
      expect(targets[0]?.target_ratio).toBeCloseTo(0.8, 5);
      expect(targets[1]?.target_ratio).toBeCloseTo(0.2, 5);
    });

    it("divide centavos exatos em 50/50 com resto euclidiano sem perder centavos (Hamilton-Hare)", () => {
      const targets = [
        { user_id: "usr_a", target_ratio: 0.5 },
        { user_id: "usr_b", target_ratio: 0.5 },
      ];

      // R$ 100,01 = 10001 centavos (número ímpar)
      const shares = calculateFairSharesCents(10001, targets);
      const shareA = shares.usr_a ?? 0;
      const shareB = shares.usr_b ?? 0;
      expect(shareA + shareB).toBe(10001);
      expect(Math.abs(shareA - shareB)).toBe(1);
    });

    it("divide centavos entre 3 participantes garantindo soma estrita", () => {
      const targets = [
        { user_id: "u1", target_ratio: 1 / 3 },
        { user_id: "u2", target_ratio: 1 / 3 },
        { user_id: "u3", target_ratio: 1 / 3 },
      ];

      // 100 centavos / 3 = 33,333...
      const shares = calculateFairSharesCents(100, targets);
      const s1 = shares.u1 ?? 0;
      const s2 = shares.u2 ?? 0;
      const s3 = shares.u3 ?? 0;
      expect(s1 + s2 + s3).toBe(100);
      expect(s1).toBe(34);
      expect(s2).toBe(33);
      expect(s3).toBe(33);
    });

    it("distribui centavos proporcionalmente (60/40) para R$ 100,01 com o maior resto", () => {
      const targets = [
        { user_id: "usr_a", target_ratio: 0.6 },
        { user_id: "usr_b", target_ratio: 0.4 },
      ];

      // 10001 * 0.6 = 6000.6 (floor 6000, rem 0.6)
      // 10001 * 0.4 = 4000.4 (floor 4000, rem 0.4)
      // usr_a tem maior resto -> recebe 6001, usr_b recebe 4000
      const shares = calculateFairSharesCents(10001, targets);
      const shareA = shares.usr_a ?? 0;
      const shareB = shares.usr_b ?? 0;
      expect(shareA).toBe(6001);
      expect(shareB).toBe(4000);
      expect(shareA + shareB).toBe(10001);
    });
  });

  // =========================================================================
  // 4. Projeção de Ritmo Diário da Casa (Daily Run-Rate)
  // =========================================================================
  describe("4. Projeção de Ritmo Diário da Casa", () => {
    it("calcula dias no mês corretamente incluindo anos bissextos", () => {
      expect(getDaysInMonth(2026, 1)).toBe(28); // Fevereiro 2026 (não-bissexto)
      expect(getDaysInMonth(2028, 1)).toBe(29); // Fevereiro 2028 (bissexto)
      expect(getDaysInMonth(2026, 10)).toBe(30); // Novembro 2026
      expect(getDaysInMonth(2026, 11)).toBe(31); // Dezembro 2026
    });

    it("decompõe strings de competência 'YYYY-MM'", () => {
      const parts = resolveCompetenceMonthParts("2026-11");
      expect(parts.year).toBe(2026);
      expect(parts.monthIndex).toBe(10);
      expect(parts.formattedMonth).toBe("2026-11");
    });

    it("projeta gastos no ritmo atual para o final do mês", () => {
      // Dia 15 de Novembro (30 dias no mês). Gasto acumulado: R$ 3.000,00 (300.000 centavos)
      // Teto: R$ 5.000,00 (500.000 centavos)
      // Ritmo: 300.000 / 15 = 20.000 centavos/dia (R$ 200/dia)
      // Projeção mês: 20.000 * 30 = 600.000 centavos (R$ 6.000,00) -> Estouros de R$ 1.000,00
      const projection = calculateHouseholdPace(300000, 500000, {
        month: "2026-11",
        referenceDate: "2026-11-15T12:00:00Z",
      });

      expect(projection.days_in_month).toBe(30);
      expect(projection.day_of_month).toBe(15);
      expect(projection.days_remaining).toBe(15);
      expect(projection.daily_pace_cents).toBe(20000);
      expect(projection.projected_month_end_cents).toBe(600000);
      expect(projection.projected_difference_cents).toBe(100000);
      expect(projection.is_projected_to_exceed).toBe(true);
      // Dia estimado de estouro: 500.000 / 20.000 = dia 25
      expect(projection.projected_exhaustion_day).toBe(25);
    });

    it("retorna null para dia de esgotamento quando o ritmo está abaixo do teto", () => {
      // Dia 10 de Novembro. Gasto: R$ 1.000,00 (100.000 centavos). Teto: R$ 6.000,00 (600.000 centavos)
      // Ritmo: 10.000 centavos/dia. Projeção: 300.000 centavos. Não estoura.
      const projection = calculateHouseholdPace(100000, 600000, {
        month: "2026-11",
        referenceDate: "2026-11-10T12:00:00Z",
      });

      expect(projection.is_projected_to_exceed).toBe(false);
      expect(projection.projected_exhaustion_day).toBeNull();
    });
  });

  // =========================================================================
  // 5. Salvaguarda F5: Auditoria de Despesas Pós-Acerto
  // =========================================================================
  describe("5. Salvaguarda F5: Auditoria de Despesas Pós-Acerto", () => {
    const settlement: ReconciliationSettlementInput = {
      settled_at: "2026-11-15T18:00:00Z",
      amount_cents: 15000,
    };

    it("não aponta pendências quando não há acerto registrado no mês", () => {
      const audit = auditPostSettlementActivity([
        { id: "e1", user_id: "u1", amount_cents: 5000, date: "2026-11-10" },
      ], null);

      expect(audit.has_post_settlement_expenses).toBe(false);
      expect(audit.post_settlement_spent_cents).toBe(0);
      expect(audit.post_settlement_expenses_count).toBe(0);
    });

    it("identifica despesas adicionadas após o fechamento do acerto", () => {
      const expenses: ReconciliationExpenseInput[] = [
        {
          id: "e1",
          user_id: "u1",
          amount_cents: 8000,
          date: "2026-11-10",
          created_at: "2026-11-10T10:00:00Z", // antes
        },
        {
          id: "e2",
          user_id: "u2",
          amount_cents: 4500,
          date: "2026-11-16",
          created_at: "2026-11-16T09:00:00Z", // após
        },
        {
          id: "e3",
          user_id: "u1",
          amount_cents: 3200,
          date: "2026-11-17",
          created_at: "2026-11-17T14:30:00Z", // após
        },
      ];

      const audit = auditPostSettlementActivity(expenses, settlement);

      expect(audit.has_post_settlement_expenses).toBe(true);
      expect(audit.post_settlement_expenses_count).toBe(2);
      expect(audit.post_settlement_spent_cents).toBe(7700); // 4500 + 3200
      expect(audit.post_settlement_expenses.map((e) => e.id)).toEqual(["e2", "e3"]);
    });
  });

  // =========================================================================
  // 6. Orquestrador reconcileHouseholdSpending e Invariantes Sagradas
  // =========================================================================
  describe("6. Orquestrador reconcileHouseholdSpending e Invariantes", () => {
    it("reconcilia orçamento de casal 50/50 e valida balanço de soma-zero", () => {
      const members: ReconciliationMemberInput[] = [
        { user_id: "gabriel", display_name: "Gabriel", role: "owner" },
        { user_id: "mariana", display_name: "Mariana", role: "member" },
      ];

      // Gabriel pagou R$ 600,00 (60.000 centavos)
      // Mariana pagou R$ 200,00 (20.000 centavos)
      // Total da casa: R$ 800,00 (80.000 centavos)
      // Teto da casa: R$ 1.000,00 (100.000 centavos)
      const expenses: ReconciliationExpenseInput[] = [
        { id: "e1", user_id: "gabriel", amount_cents: 40000, date: "2026-11-05", description: "Supermercado" },
        { id: "e2", user_id: "gabriel", amount_cents: 20000, date: "2026-11-06", description: "Energia Elétrica" },
        { id: "e3", user_id: "mariana", amount_cents: 20000, date: "2026-11-07", description: "Farmácia" },
      ];

      const result = reconcileHouseholdSpending({
        monthly_ceiling_cents: 100000,
        members,
        expenses,
        options: {
          month: "2026-11",
          splitRule: "equal",
          referenceDate: "2026-11-15T12:00:00Z",
        },
      });

      // Validação das métricas da casa
      expect(result.month).toBe("2026-11");
      expect(result.monthly_ceiling_cents).toBe(100000);
      expect(result.total_spent_cents).toBe(80000);
      expect(result.remaining_ceiling_cents).toBe(20000);
      expect(result.health.status).toBe("warning"); // 80% do teto
      expect(result.health.spent_percentage).toBe(80.0);

      // Validação dos membros
      expect(result.members).toHaveLength(2);

      const gabrielSummary = result.members.find((m) => m.user_id === "gabriel")!;
      const marianaSummary = result.members.find((m) => m.user_id === "mariana")!;

      expect(gabrielSummary.spent_cents).toBe(60000);
      expect(gabrielSummary.percentage_of_spent).toBe(75.0);
      expect(gabrielSummary.display_percentage_of_spent).toBe("75,0%");
      expect(gabrielSummary.fair_share_cents).toBe(40000); // 50% de 80.000
      expect(gabrielSummary.net_balance_cents).toBe(20000); // Credor de R$ 200,00
      expect(gabrielSummary.is_creditor).toBe(true);
      expect(gabrielSummary.is_debtor).toBe(false);
      expect(gabrielSummary.is_top_spender).toBe(true);
      expect(result.top_spender_id).toBe("gabriel");

      expect(marianaSummary.spent_cents).toBe(20000);
      expect(marianaSummary.percentage_of_spent).toBe(25.0);
      expect(marianaSummary.display_percentage_of_spent).toBe("25,0%");
      expect(marianaSummary.fair_share_cents).toBe(40000); // 50% de 80.000
      expect(marianaSummary.net_balance_cents).toBe(-20000); // Devedora de R$ 200,00
      expect(marianaSummary.is_creditor).toBe(false);
      expect(marianaSummary.is_debtor).toBe(true);
      expect(marianaSummary.is_top_spender).toBe(false);

      // Invariante Sagrada: Soma dos saldos líquidos fecha rigorosamente em zero
      expect(gabrielSummary.net_balance_cents + marianaSummary.net_balance_cents).toBe(0);

      // Invariante Sagrada: Soma das cotas devidas é igual ao total gasto
      expect(gabrielSummary.fair_share_cents + marianaSummary.fair_share_cents).toBe(result.total_spent_cents);

      // Auditoria formal
      const validation = validateHouseholdReconciliationInvariants(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("reconcilia rateio proporcional com divisão assimétrica de rendas", () => {
      // Gabriel ganha R$ 6.000 (60%), Mariana ganha R$ 4.000 (40%)
      const members: ReconciliationMemberInput[] = [
        { user_id: "gabriel", display_name: "Gabriel", income_cents: 600000 },
        { user_id: "mariana", display_name: "Mariana", income_cents: 400000 },
      ];

      // Gasto total: R$ 1.000,00 (100.000 centavos)
      // Gabriel deve pagar 60% = 60.000 centavos
      // Mariana deve pagar 40% = 40.000 centavos
      // Mas Mariana pagou tudo (100.000 centavos) e Gabriel pagou 0
      const expenses: ReconciliationExpenseInput[] = [
        { id: "e1", user_id: "mariana", amount_cents: 100000, date: "2026-11-10" },
      ];

      const result = reconcileHouseholdSpending({
        monthly_ceiling_cents: 150000,
        members,
        expenses,
        options: {
          month: "2026-11",
          splitRule: "proportional",
        },
      });

      const gabriel = result.members.find((m) => m.user_id === "gabriel")!;
      const mariana = result.members.find((m) => m.user_id === "mariana")!;

      expect(gabriel.fair_share_cents).toBe(60000);
      expect(gabriel.net_balance_cents).toBe(-60000); // Gabriel deve pagar 600,00 para Mariana
      expect(gabriel.is_debtor).toBe(true);

      expect(mariana.fair_share_cents).toBe(40000);
      expect(mariana.net_balance_cents).toBe(60000); // Mariana tem 600,00 a receber
      expect(mariana.is_creditor).toBe(true);

      const validation = validateHouseholdReconciliationInvariants(result);
      expect(validation.valid).toBe(true);
    });

    it("lida defensivamente com despesa paga por usuário convidado não cadastrado", () => {
      const members: ReconciliationMemberInput[] = [
        { user_id: "usr_regular", display_name: "Morador" },
      ];

      const expenses: ReconciliationExpenseInput[] = [
        { id: "e1", user_id: "usr_regular", amount_cents: 5000, date: "2026-11-01" },
        { id: "e2", user_id: "usr_guest", amount_cents: 3000, date: "2026-11-02" },
      ];

      const result = reconcileHouseholdSpending({
        monthly_ceiling_cents: 20000,
        members,
        expenses,
      });

      expect(result.total_spent_cents).toBe(8000);
      expect(result.members).toHaveLength(2);
      expect(result.members.some((m) => m.user_id === "usr_guest")).toBe(true);

      const validation = validateHouseholdReconciliationInvariants(result);
      expect(validation.valid).toBe(true);
    });

    it("lida com lista de despesas vazia sem erro e mantém balanço zerado", () => {
      const members: ReconciliationMemberInput[] = [
        { user_id: "u1", display_name: "Gabriel" },
        { user_id: "u2", display_name: "Mariana" },
      ];

      const result = reconcileHouseholdSpending({
        monthly_ceiling_cents: 50000,
        members,
        expenses: [],
      });

      expect(result.total_spent_cents).toBe(0);
      expect(result.remaining_ceiling_cents).toBe(50000);
      expect(result.is_balanced).toBe(true);
      expect(result.top_spender_id).toBeNull();

      const validation = validateHouseholdReconciliationInvariants(result);
      expect(validation.valid).toBe(true);
    });

    it("reconcilia sob regra 'combined' (Finanças Conjuntas) com saldos devedor/credor zerados", () => {
      const members: ReconciliationMemberInput[] = [
        { user_id: "u1", display_name: "Gabriel" },
        { user_id: "u2", display_name: "Mariana" },
      ];

      const expenses: ReconciliationExpenseInput[] = [
        { id: "e1", user_id: "u1", amount_cents: 60000, date: "2026-11-01", description: "Aluguel" },
        { id: "e2", user_id: "u2", amount_cents: 20000, date: "2026-11-02", description: "Feira" },
      ];

      const result = reconcileHouseholdSpending({
        monthly_ceiling_cents: 100000,
        members,
        expenses,
        options: {
          splitRule: "combined",
        },
      });

      expect(result.total_spent_cents).toBe(80000);
      expect(result.remaining_ceiling_cents).toBe(20000);
      expect(result.split_rule_applied).toBe("combined");
      expect(result.is_balanced).toBe(true);

      const m1 = result.members.find((m) => m.user_id === "u1")!;
      const m2 = result.members.find((m) => m.user_id === "u2")!;

      // No modo combinado, cota devida é igual ao gasto, sem devedores ou credores
      expect(m1.spent_cents).toBe(60000);
      expect(m1.fair_share_cents).toBe(60000);
      expect(m1.net_balance_cents).toBe(0);
      expect(m1.is_creditor).toBe(false);
      expect(m1.is_debtor).toBe(false);
      expect(m1.is_balanced).toBe(true);

      expect(m2.spent_cents).toBe(20000);
      expect(m2.fair_share_cents).toBe(20000);
      expect(m2.net_balance_cents).toBe(0);
      expect(m2.is_creditor).toBe(false);
      expect(m2.is_debtor).toBe(false);
      expect(m2.is_balanced).toBe(true);

      // Invariantes estritas devem ser 100% satisfeitas
      const validation = validateHouseholdReconciliationInvariants(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("validador detecta violação intencional de invariantes", () => {
      const validResult = reconcileHouseholdSpending({
        monthly_ceiling_cents: 50000,
        members: [{ user_id: "u1", display_name: "Gabriel" }],
        expenses: [{ id: "e1", user_id: "u1", amount_cents: 10000, date: "2026-11-01" }],
      });

      // Simula corrupção de dados
      const corrupted = {
        ...validResult,
        total_spent_cents: 9999, // diverge dos membros (10000)
      };

      const check = validateHouseholdReconciliationInvariants(corrupted);
      expect(check.valid).toBe(false);
      expect(check.errors.length).toBeGreaterThan(0);
      expect(check.errors[0]).toContain("Invariante violada");
    });
  });
});
