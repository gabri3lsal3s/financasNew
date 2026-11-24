import { describe, expect, it } from "vitest";
import { calculateSurplusCapacity } from "@/domain/overview/surplus";
import { dailyBudget, endOfMonthProjection, spendingPace } from "@/domain/projection";
import {
  buildUserFinancialContext,
  type ContextCategoryLike,
  type ContextExpenseLike,
} from "./financial-context";
import { buildScopedOneOffKey, buildTxOneOffKey } from "./learning-graph";

const CATEGORIES: ContextCategoryLike[] = [
  { id: "cat-moradia", name: "Moradia", icon: "moradia", type: "expense" },
  { id: "cat-mercado", name: "Mercado", icon: "mercado", type: "expense" },
  { id: "cat-lazer", name: "Lazer", icon: "lazer", type: "expense" },
  { id: "cat-compras", name: "Compras", icon: "compras", type: "expense" },
  { id: "cat-assinaturas", name: "Assinaturas", icon: "assinaturas", type: "expense" },
];

describe("UserFinancialContext — Portão de Qualidade da Fase 1 (Cenários 1–10)", () => {
  it("Cenário 1 (Cold Start — caso da imagem): dia 23, 1 despesa R$ 50 sem renda e sem orçamento → zero alarme", () => {
    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-23",
      monthIncomes: [],
      monthExpenses: [
        {
          id: "exp-1",
          date: "2026-11-23",
          value: 50,
          category_id: "cat-lazer",
          description: "Café",
        },
      ],
      categories: CATEGORIES,
    });

    expect(ctx.maturity).toBe("cold_start");
    expect(ctx.referenceBudgetCents).toBe(0);
    expect(ctx.referenceBudgetSource).toBe("none");

    const pace = spendingPace({
      spentCents: ctx.lens.consumption.netExpenseCents,
      monthlyBudgetCents: ctx.referenceBudgetCents,
      dayOfMonth: ctx.dayOfMonth,
      daysInMonth: ctx.daysInMonth,
    });
    expect(pace.active).toBe(false);
    expect(pace.spentPercent).toBe(0);
    expect(pace.ahead).toBe(false);

    const proj = endOfMonthProjection({
      phase: "current",
      incomesCents: ctx.lens.consumption.operatingIncomeCents,
      referenceBudgetCents: ctx.referenceBudgetCents,
      investmentsCents: 0,
      fixedPaidCents: ctx.lens.consumption.fixedPaidCents,
      pendingFixedCents: ctx.lens.liquidity.pendingRecurringExpensesCents,
      oneOffAndTripCents: ctx.lens.consumption.oneOffAndTripCents,
      variableExpensesCents: ctx.lens.consumption.variableExpenseCents,
      historicalVariableMedianCents: ctx.lens.consumption.historicalVariableMedianCents,
      dayOfMonth: ctx.dayOfMonth,
      daysInMonth: ctx.daysInMonth,
    });
    expect(proj.onTrack).toBeNull();
    expect(proj.projectedExpensesCents).toBeNull();
    expect(proj.surplusCents).toBeNull();

    const daily = dailyBudget({
      phase: "current",
      incomesCents: ctx.lens.consumption.operatingIncomeCents,
      referenceBudgetCents: ctx.referenceBudgetCents,
      investmentsCents: 0,
      expensesCents: ctx.lens.consumption.netExpenseCents,
      dayOfMonth: ctx.dayOfMonth,
      daysInMonth: ctx.daysInMonth,
    });
    expect(daily.dailyCents).toBeNull();
  });

  it("Cenário 2 (Novo com Orçamentos, Sem Renda): usa soma dos orçamentos (R$ 2.000) como base provisória", () => {
    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-15",
      monthIncomes: [],
      monthExpenses: [
        { id: "e1", date: "2026-11-05", value: 250, category_id: "cat-mercado", description: "Mercado" },
        { id: "e2", date: "2026-11-10", value: 150, category_id: "cat-lazer", description: "Cinema" },
      ],
      categories: CATEGORIES,
      learningInput: {
        budgets: [
          { category_id: "cat-mercado", month: "2026-11", limit: 1500 },
          { category_id: "cat-lazer", month: "2026-11", limit: 500 },
        ],
      },
    });

    expect(ctx.maturity).toBe("awaiting_income");
    expect(ctx.referenceBudgetSource).toBe("category_budgets");
    expect(ctx.referenceBudgetCents).toBe(200_000);
    expect(ctx.isProvisionalReference).toBe(true);

    const pace = spendingPace({
      spentCents: ctx.lens.consumption.netExpenseCents,
      monthlyBudgetCents: ctx.referenceBudgetCents,
      dayOfMonth: ctx.dayOfMonth,
      daysInMonth: ctx.daysInMonth,
    });
    expect(pace.active).toBe(true);
    expect(pace.spentPercent).toBeCloseTo(20, 2);
    expect(pace.ahead).toBe(false);
  });

  it("Cenário 3 (Antigo em Virada de Mês sem Salário): usa renda histórica (R$ 6.000) como base provisória", () => {
    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-04",
      monthIncomes: [],
      historicalIncomes: [
        { date: "2026-08-05", value: 6000 },
        { date: "2026-09-05", value: 6000 },
        { date: "2026-10-05", value: 6000 },
      ],
      monthExpenses: [
        { id: "e1", date: "2026-11-02", value: 300, category_id: "cat-mercado", description: "Feira" },
      ],
      categories: CATEGORIES,
    });

    expect(ctx.maturity).toBe("awaiting_income");
    expect(ctx.referenceBudgetSource).toBe("expected_income");
    expect(ctx.referenceBudgetCents).toBe(600_000);
    expect(ctx.isProvisionalReference).toBe(true);
  });

  it("Cenário 4 (Recebimento Quinzenal / Fracionado): combina 1ª parcela (R$ 2.400) + 2ª parcela prevista (R$ 3.600) = R$ 6.000", () => {
    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-18",
      monthIncomes: [{ id: "inc-1", date: "2026-11-15", value: 2400 }],
      historicalIncomes: [
        { date: "2026-08-15", value: 2400 },
        { date: "2026-08-30", value: 3600 },
        { date: "2026-09-15", value: 2400 },
        { date: "2026-09-30", value: 3600 },
        { date: "2026-10-15", value: 2400 },
        { date: "2026-10-30", value: 3600 },
      ],
      monthExpenses: [
        { id: "e1", date: "2026-11-05", value: 1800, category_id: "cat-moradia", description: "Aluguel" },
        { id: "e2", date: "2026-11-12", value: 400, category_id: "cat-mercado", description: "Mercado" },
      ],
      categories: CATEGORIES,
    });

    expect(ctx.learning.paydayProfile.pattern).toBe("biweekly");
    expect(ctx.learning.paydayProfile.confidence).toBeGreaterThanOrEqual(0.6);
    expect(ctx.lens.liquidity.expectedUpcomingInflowsCents).toBe(360_000);
    expect(ctx.referenceBudgetSource).toBe("current_plus_expected_income");
    expect(ctx.referenceBudgetCents).toBe(600_000);
    expect(ctx.isProvisionalReference).toBe(true);
  });

  it("Cenário 5 (Pico Variável no Dia 2 — Shrinkage Quadrático): R$ 700 no dia 2 com mediana histórica R$ 1.800 → ~R$ 1.978", () => {
    const pastMonth = (m: string): ContextExpenseLike[] => [
      { id: `m-${m}`, date: `${m}-10`, value: 1800, category_id: "cat-mercado", description: "Mercado" },
    ];

    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-02",
      monthIncomes: [{ id: "inc-nov", date: "2026-11-01", value: 5000 }],
      monthExpenses: [
        { id: "e-day2", date: "2026-11-02", value: 700, category_id: "cat-mercado", description: "Supermercado mensal" },
      ],
      historicalExpensesByMonth: [pastMonth("2026-10"), pastMonth("2026-09"), pastMonth("2026-08")],
      categories: CATEGORIES,
    });

    expect(ctx.lens.consumption.variableExpenseCents).toBe(70_000);
    expect(ctx.lens.consumption.historicalVariableMedianCents).toBe(180_000);

    const proj = endOfMonthProjection({
      phase: "current",
      incomesCents: ctx.lens.consumption.operatingIncomeCents,
      referenceBudgetCents: ctx.referenceBudgetCents,
      investmentsCents: 0,
      fixedPaidCents: ctx.lens.consumption.fixedPaidCents,
      pendingFixedCents: ctx.lens.liquidity.pendingRecurringExpensesCents,
      oneOffAndTripCents: ctx.lens.consumption.oneOffAndTripCents,
      variableExpensesCents: ctx.lens.consumption.variableExpenseCents,
      historicalVariableMedianCents: ctx.lens.consumption.historicalVariableMedianCents,
      dayOfMonth: 2,
      daysInMonth: 30,
    });

    // w = (2/14)^2 = 4/196 = 0.02040816...
    // extrapolated = 70_000 * 30 / 2 = 1_050_000
    // blended = round(0.02040816 * 1_050_000 + 0.97959184 * 180_000) = round(21_428.57 + 176_326.53) = 197_755 (~R$ 1.977,55)
    expect(proj.projectedVariableCents).toBe(197_755);
    expect(proj.projectedExpensesCents).toBe(197_755);
    expect(proj.onTrack).toBe(true);
  });

  it("Cenário 6 (Pagamento Pesado Fixo no Dia 4): Aluguel R$ 2.200 entra 1x sem multiplicar por 30 dias", () => {
    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-04",
      monthIncomes: [{ id: "inc-1", date: "2026-11-01", value: 6000 }],
      monthExpenses: [
        { id: "e-aluguel", date: "2026-11-04", value: 2200, category_id: "cat-moradia", description: "Aluguel" },
        { id: "e-cafe", date: "2026-11-04", value: 50, category_id: "cat-lazer", description: "Café" },
      ],
      historicalExpensesByMonth: [
        [{ id: "h1", date: "2026-10-10", value: 1200, category_id: "cat-mercado", description: "Mercado" }],
      ],
      categories: CATEGORIES,
    });

    expect(ctx.lens.consumption.fixedPaidCents).toBe(220_000);
    expect(ctx.lens.consumption.variableExpenseCents).toBe(5_000);

    const proj = endOfMonthProjection({
      phase: "current",
      incomesCents: 600_000,
      investmentsCents: 0,
      fixedPaidCents: ctx.lens.consumption.fixedPaidCents,
      variableExpensesCents: ctx.lens.consumption.variableExpenseCents,
      historicalVariableMedianCents: ctx.lens.consumption.historicalVariableMedianCents,
      dayOfMonth: 4,
      daysInMonth: 30,
    });

    // Fixo (220.000) entra 1x + variável suavizado (~113.265) → projeção ~R$ 3.332,65 (bem abaixo dos R$ 6.000!)
    expect(proj.projectedExpensesCents).toBeLessThan(350_000);
    expect(proj.onTrack).toBe(true);
  });

  it("Cenário 7 (Outliers `tx_one_off`, `one_off:YYYY-MM` e `trip_id`): entram no saldo real sem inflar burn rate", () => {
    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-15",
      monthIncomes: [{ id: "inc-1", date: "2026-11-05", value: 8000 }],
      monthExpenses: [
        { id: "exp-nb", date: "2026-11-05", value: 3000, category_id: "cat-compras", description: "Notebook" },
        { id: "exp-trip", date: "2026-11-08", value: 900, category_id: "cat-lazer", description: "Passeio", trip_id: "trip-1" },
        { id: "exp-oficina", date: "2026-11-10", value: 400, category_id: "cat-compras", description: "Oficina" },
        { id: "exp-var", date: "2026-11-12", value: 300, category_id: "cat-mercado", description: "Mercado" },
      ],
      categories: CATEGORIES,
      learningInput: {
        feedbackEntries: [
          { occurrenceKey: buildTxOneOffKey("exp-nb"), decision: "one_off", createdAt: "2026-11-06T10:00:00Z" },
          { occurrenceKey: buildScopedOneOffKey("2026-11", "oficina"), decision: "one_off", createdAt: "2026-11-10T10:00:00Z" },
          // one_off do mês anterior NÃO pode contaminar novembro
          { occurrenceKey: "recurring:mercado", decision: "one_off", createdAt: "2026-10-10T10:00:00Z" },
        ],
      },
    });

    expect(ctx.lens.consumption.oneOffAndTripCents).toBe(430_000); // 3000 + 900 + 400
    expect(ctx.lens.consumption.variableExpenseCents).toBe(30_000); // Apenas Mercado R$ 300
    expect(ctx.lens.consumption.netExpenseCents).toBe(460_000);

    // No dia 15 de 30 (w = 1), variável (300) projeta 600 + oneOffAndTrip (4300) = 4900 (NÃO 9200!)
    const proj = endOfMonthProjection({
      phase: "current",
      incomesCents: 800_000,
      investmentsCents: 0,
      fixedPaidCents: ctx.lens.consumption.fixedPaidCents,
      oneOffAndTripCents: ctx.lens.consumption.oneOffAndTripCents,
      variableExpensesCents: ctx.lens.consumption.variableExpenseCents,
      dayOfMonth: 15,
      daysInMonth: 30,
    });
    expect(proj.projectedExpensesCents).toBe(490_000);
    expect(proj.onTrack).toBe(true);
  });

  it("Cenário 8A (Estorno [REFUND] no mesmo mês): exclui da renda operacional e abate exatamente o bucket correspondente", () => {
    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-15",
      monthIncomes: [
        { id: "inc-sal", date: "2026-11-05", value: 5000, source_ref: null },
        { id: "inc-ref", date: "2026-11-12", value: 800, source_ref: "[REFUND]pay-1", description: "Estorno Loja X" },
      ],
      monthExpenses: [
        { id: "e1", date: "2026-11-10", value: 800, category_id: "cat-compras", payment_method: "credit_card", card_id: "c1", description: "Loja X" },
        { id: "e2", date: "2026-11-11", value: 500, category_id: "cat-mercado", description: "Mercado" },
      ],
      categories: CATEGORIES,
    });

    expect(ctx.lens.consumption.operatingIncomeCents).toBe(500_000); // R$ 5.000 (exclui estorno)
    expect(ctx.lens.consumption.refundsNeutralizedCents).toBe(80_000);
    expect(ctx.lens.consumption.priorCycleRefundCreditCents).toBe(0);
    expect(ctx.lens.consumption.variableExpenseCents).toBe(50_000); // Loja X neutralizada; sobra apenas Mercado R$ 500
    expect(ctx.lens.consumption.netExpenseCents).toBe(50_000);

    // Invariante exata de partição
    const c = ctx.lens.consumption;
    expect(c.netExpenseCents).toBe(
      Math.max(0, c.fixedPaidCents + c.oneOffAndTripCents + c.variableExpenseCents - c.priorCycleRefundCreditCents),
    );
  });

  it("Cenário 8B (Estorno [REFUND] Cross-Month): isola em priorCycleRefundCreditCents sem distorcer variableExpenseCents", () => {
    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-15",
      monthIncomes: [
        { id: "inc-sal", date: "2026-11-05", value: 5000, source_ref: null },
        // Estorno de R$ 1.200 de compra feita em Outubro (nenhuma despesa compatível em Novembro)
        { id: "inc-ref-oct", date: "2026-11-08", value: 1200, source_ref: "[REFUND]pay-oct", description: "Estorno Passagem Outubro" },
      ],
      monthExpenses: [
        { id: "e1", date: "2026-11-05", value: 400, category_id: "cat-mercado", description: "Mercado" },
        { id: "e2", date: "2026-11-10", value: 300, category_id: "cat-lazer", description: "Restaurante" },
      ],
      categories: CATEGORIES,
    });

    expect(ctx.lens.consumption.operatingIncomeCents).toBe(500_000);
    expect(ctx.lens.consumption.refundsNeutralizedCents).toBe(0);
    expect(ctx.lens.consumption.priorCycleRefundCreditCents).toBe(120_000);
    // variableExpenseCents permanece intacto em R$ 700 (não vira R$ 0 gerando falsa celebração de economia!)
    expect(ctx.lens.consumption.variableExpenseCents).toBe(70_000);
    // netExpenseCents abate o crédito até o piso 0
    expect(ctx.lens.consumption.netExpenseCents).toBe(0);

    const c = ctx.lens.consumption;
    expect(c.netExpenseCents).toBe(
      Math.max(0, c.fixedPaidCents + c.oneOffAndTripCents + c.variableExpenseCents - c.priorCycleRefundCreditCents),
    );
  });

  it("Cenário 9 & 10 (Proteção de Fixos Pendentes + Trava Inteligente de Reserva vs. Override Externo)", () => {
    // Salário R$ 5.000 caiu dia 5; Aluguel (R$ 2.000) + Internet (R$ 150) ainda vão vencer dia 10
    const ctxIncompleteReserve = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-06",
      monthIncomes: [{ id: "inc-1", date: "2026-11-05", value: 5000 }],
      monthExpenses: [{ id: "e1", date: "2026-11-05", value: 350, category_id: "cat-mercado", description: "Mercado" }],
      categories: CATEGORIES,
      recurringCommitments: [
        { key: "formal:aluguel", amountCents: 200_000, isFormal: true, alreadyPaidThisMonth: false },
        { key: "sub:internet", amountCents: 15_000, isFormal: false, alreadyPaidThisMonth: false },
      ],
      liquidity: {
        hasCheckpoint: true,
        realCashBalanceCents: 465_000,
        committedObligationsCents: 0,
        safeToSpendCents: 465_000,
      },
      wealth: {
        hasInvestmentsAccess: true,
        emergencyReserveCents: 600_000, // R$ 6.000 (cobre 2 meses de R$ 3.000)
        baselineMonthlyExpensesCents: 300_000,
        emergencyTargetMonths: 6, // Meta R$ 18.000 → gap R$ 12.000
      },
    });

    expect(ctxIncompleteReserve.lens.liquidity.pendingRecurringExpensesCents).toBe(215_000);
    expect(ctxIncompleteReserve.lens.wealth.emergencyMonthsCovered).toBe(2);
    expect(ctxIncompleteReserve.lens.wealth.emergencyGapCents).toBe(1_200_000);
    expect(ctxIncompleteReserve.lens.wealth.isEmergencyFundComplete).toBe(false);

    // Sobra deduz os R$ 2.150 de fixos pendentes: 5000 - 350 - 2150 = R$ 2.500
    const surplusReserve = calculateSurplusCapacity({
      incomeCents: ctxIncompleteReserve.lens.consumption.operatingIncomeCents,
      expenseCents: ctxIncompleteReserve.lens.consumption.netExpenseCents,
      pendingRecurringObligationsCents: ctxIncompleteReserve.lens.liquidity.pendingRecurringExpensesCents,
      safeToSpendCents: ctxIncompleteReserve.lens.liquidity.safeToSpendCents,
      emergencyGapCents: ctxIncompleteReserve.lens.wealth.emergencyGapCents,
      hasExternalEmergencyFund: ctxIncompleteReserve.lens.wealth.hasExternalEmergencyFund,
    });
    expect(surplusReserve.suggestedAporteCents).toBe(250_000);
    expect(surplusReserve.allocationIntent).toBe("emergency_fund");
    expect(surplusReserve.suggestedEmergencyAllocationCents).toBe(250_000);

    // Mesmo cenário com override limpo `hasExternalEmergencyFund: true` → libera carteira
    const ctxExternalOverride = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-06",
      monthIncomes: [{ id: "inc-1", date: "2026-11-05", value: 5000 }],
      monthExpenses: [{ id: "e1", date: "2026-11-05", value: 350, category_id: "cat-mercado", description: "Mercado" }],
      categories: CATEGORIES,
      recurringCommitments: [
        { key: "formal:aluguel", amountCents: 200_000, isFormal: true, alreadyPaidThisMonth: false },
        { key: "sub:internet", amountCents: 15_000, isFormal: false, alreadyPaidThisMonth: false },
      ],
      liquidity: {
        hasCheckpoint: true,
        realCashBalanceCents: 465_000,
        committedObligationsCents: 0,
        safeToSpendCents: 465_000,
      },
      wealth: {
        hasInvestmentsAccess: true,
        emergencyReserveCents: 600_000,
        baselineMonthlyExpensesCents: 300_000,
        emergencyTargetMonths: 6,
        hasExternalEmergencyFund: true,
      },
    });

    expect(ctxExternalOverride.lens.wealth.isEmergencyFundComplete).toBe(true);
    expect(ctxExternalOverride.lens.wealth.emergencyGapCents).toBe(0);

    const surplusOverride = calculateSurplusCapacity({
      incomeCents: ctxExternalOverride.lens.consumption.operatingIncomeCents,
      expenseCents: ctxExternalOverride.lens.consumption.netExpenseCents,
      pendingRecurringObligationsCents: ctxExternalOverride.lens.liquidity.pendingRecurringExpensesCents,
      safeToSpendCents: ctxExternalOverride.lens.liquidity.safeToSpendCents,
      emergencyGapCents: ctxExternalOverride.lens.wealth.emergencyGapCents,
      hasExternalEmergencyFund: ctxExternalOverride.lens.wealth.hasExternalEmergencyFund,
    });
    expect(surplusOverride.suggestedAporteCents).toBe(250_000);
    expect(surplusOverride.allocationIntent).toBe("portfolio_aporte");
    expect(surplusOverride.suggestedEmergencyAllocationCents).toBe(0);
  });

  it("isola currentMonthOneOffKeys ao apurar historicalVariableMedianCents nos meses M-1..M-3", () => {
    const pastMonth = (m: string): ContextExpenseLike[] => [
      { id: `m-${m}`, date: `${m}-10`, value: 1800, category_id: "cat-mercado", description: "Mercado" },
    ];

    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-10",
      monthIncomes: [{ id: "inc-nov", date: "2026-11-01", value: 6000 }],
      monthExpenses: [
        { id: "e-nov-merc", date: "2026-11-05", value: 900, category_id: "cat-mercado", description: "Mercado" },
        { id: "e-nov-lazer", date: "2026-11-08", value: 200, category_id: "cat-lazer", description: "Cinema" },
      ],
      historicalExpensesByMonth: [pastMonth("2026-10"), pastMonth("2026-09"), pastMonth("2026-08")],
      categories: CATEGORIES,
      learningInput: {
        feedbackEntries: [
          {
            occurrenceKey: buildScopedOneOffKey("2026-11", "mercado"),
            decision: "one_off",
            createdAt: "2026-11-06T10:00:00Z",
          },
        ],
      },
    });

    // No mês corrente, Mercado é isolado como pontual; nos meses passados M-1..M-3, a mediana R$ 1.800 permanece intacta
    expect(ctx.lens.consumption.oneOffAndTripCents).toBe(90_000);
    expect(ctx.lens.consumption.variableExpenseCents).toBe(20_000);
    expect(ctx.lens.consumption.historicalVariableMedianCents).toBe(180_000);
  });

  it("neutraliza estorno parcial [REFUND] pela descrição sem exigir category_id nem igualdade exata de valor", () => {
    const ctx = buildUserFinancialContext({
      month: "2026-11",
      todayISO: "2026-11-15",
      monthIncomes: [
        { id: "inc-sal", date: "2026-11-05", value: 5000, source_ref: null },
        { id: "inc-ref-part", date: "2026-11-12", value: 200, source_ref: "[REFUND]pay-part", description: "Estorno Loja X" },
      ],
      monthExpenses: [
        { id: "e1", date: "2026-11-10", value: 800, category_id: "cat-compras", description: "Loja X" },
      ],
      categories: CATEGORIES,
    });

    expect(ctx.lens.consumption.operatingIncomeCents).toBe(500_000);
    expect(ctx.lens.consumption.refundsNeutralizedCents).toBe(20_000);
    expect(ctx.lens.consumption.priorCycleRefundCreditCents).toBe(0);
    expect(ctx.lens.consumption.variableExpenseCents).toBe(60_000);
    expect(ctx.lens.consumption.netExpenseCents).toBe(60_000);

    const c = ctx.lens.consumption;
    expect(c.netExpenseCents).toBe(
      Math.max(0, c.fixedPaidCents + c.oneOffAndTripCents + c.variableExpenseCents - c.priorCycleRefundCreditCents),
    );
  });
});
