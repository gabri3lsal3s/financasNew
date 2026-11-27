import { describe, expect, it } from "vitest";
import type { Budget, Category, Debt, Expense, Loan, PortfolioContribution } from "@/types";
import type { Trip } from "@/types/trips";
import {
  evaluateBillImpactBridge,
  evaluateBudgetCategoryPaceBridge,
  evaluateCombinedContributionBridge,
  evaluateDataHygieneReviewBridge,
  evaluateDebtVsInvestBridge,
  evaluateHomeCashGapForInvestments,
  evaluateHomeSurplusForInvestments,
  evaluateMonthlyContributionConsistencyBridge,
  evaluatePortfolioDiscountForHome,
  evaluatePortfolioIdleCashForHome,
  evaluateTripSettlementPendingBridge,
} from "./bridge-evaluators";
import { selectCarouselSlots } from "./slot-selector";

describe("bridge-evaluators (Onda 2 · Fase 5)", () => {
  it("1. bridge.combined_contribution soma sobra + caixa sem incluir proventos pendentes e suprime redundantes", () => {
    // Ausência de metas elegíveis omite ponte
    expect(
      evaluateCombinedContributionBridge({
        asOf: "2026-11-27",
        month: "2026-11",
        isCurrentMonth: true,
        allocationIntent: "portfolio_aporte",
        suggestedAporteCents: 30_000,
        brokerageCashCents: 10_000,
        hasEligibleDeficitTarget: false,
      }),
    ).toBeNull();

    // Limite abaixo do minTicket omite
    expect(
      evaluateCombinedContributionBridge({
        asOf: "2026-11-27",
        month: "2026-11",
        isCurrentMonth: true,
        allocationIntent: "portfolio_aporte",
        suggestedAporteCents: 30_000,
        brokerageCashCents: 9_999,
        hasEligibleDeficitTarget: true,
      }),
    ).toBeNull();

    // Fusão exata: R$ 300 sobra + R$ 100 caixa = R$ 400 (R$ 50 em proventos pendentes NÃO somados)
    const bridge = evaluateCombinedContributionBridge({
      asOf: "2026-11-27",
      month: "2026-11",
      isCurrentMonth: true,
      allocationIntent: "portfolio_aporte",
      suggestedAporteCents: 30_000,
      brokerageCashCents: 10_000,
      hasEligibleDeficitTarget: true,
      eligibleClass: "Ações",
      pendingDividendsCount: 2,
      pendingDividendsBRLCents: 5_000,
    });

    expect(bridge).not.toBeNull();
    expect(bridge?.amountCents).toBe(40_000);
    expect(bridge?.targetRoute).toBe(
      "/investments?tab=rebalancear&view=simulador&valor=30000&usarCaixa=1",
    );
    expect(bridge?.breakdown?.result.rawValue).toBe(40_000);
    expect(bridge?.suppressCanonicalIds).toContain("cashflow.surplus");
    expect(bridge?.suppressCanonicalIds).toContain("portfolio.idle_cash");
  });

  it("2. bridge.debt_vs_invest cruza Loan.interest_rate_monthly com parcela pagável ativa via installment_group_id", () => {
    const loans: Loan[] = [
      {
        id: "loan-low",
        user_id: "u1",
        name: "Financiamento Baixo",
        loan_type: "personal",
        principal_amount: 1000,
        interest_rate_monthly: 1.49,
        amortization_system: "price",
        total_installments: 12,
        start_date: "2026-01-01",
        installment_group_id: "grp-low",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "loan-paid",
        user_id: "u1",
        name: "Quitado",
        loan_type: "personal",
        principal_amount: 1000,
        interest_rate_monthly: 3.5,
        amortization_system: "price",
        total_installments: 1,
        start_date: "2026-01-01",
        installment_group_id: "grp-paid",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "loan-high",
        user_id: "u1",
        name: "Crédito Caro",
        loan_type: "personal",
        principal_amount: 2000,
        interest_rate_monthly: 2.1,
        amortization_system: "price",
        total_installments: 10,
        start_date: "2026-01-01",
        installment_group_id: "grp-high",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const debts: Debt[] = [
      {
        id: "d-low",
        user_id: "u1",
        type: "payable",
        name: "Baixo 1/12",
        amount: 100,
        due_date: "2026-12-10",
        paid_at: null,
        installment_group_id: "grp-low",
      } as Debt,
      {
        id: "d-paid",
        user_id: "u1",
        type: "payable",
        name: "Quitado 1/1",
        amount: 100,
        due_date: "2026-11-10",
        paid_at: "2026-11-10",
        installment_group_id: "grp-paid",
      } as Debt,
      {
        id: "d-high",
        user_id: "u1",
        type: "payable",
        name: "Caro 2/10",
        amount: 250,
        due_date: "2026-12-15",
        paid_at: null,
        installment_group_id: "grp-high",
      } as Debt,
    ];

    // Cache ausente de loans omite sem erro
    expect(
      evaluateDebtVsInvestBridge({
        asOf: "2026-11-27",
        debts,
        loans: undefined,
        allocationIntent: "portfolio_aporte",
        suggestedAporteCents: 25_000,
      }),
    ).toBeNull();

    // Sobra < 200 e caixa < 500 omite
    expect(
      evaluateDebtVsInvestBridge({
        asOf: "2026-11-27",
        debts,
        loans,
        allocationIntent: "portfolio_aporte",
        suggestedAporteCents: 19_999,
        brokerageCashCents: 49_999,
      }),
    ).toBeNull();

    const card = evaluateDebtVsInvestBridge({
      asOf: "2026-11-27",
      debts,
      loans,
      allocationIntent: "portfolio_aporte",
      suggestedAporteCents: 25_000,
      brokerageCashCents: 0,
    });

    expect(card?.canonicalId).toBe("bridge.debt_vs_invest.loan-high");
    expect(card?.targetRoute).toBe("/dividas?type=loans&q=loan-high");
    expect(card?.breakdown?.result.formattedValue).toBe("2,10% a.m.");
  });

  it("3. cashflow.bill_impact recompõe parcela já deduzida da fatura e respeita opt-in", () => {
    const bill = {
      key: "bill_closed:c1:2026-11",
      cardId: "c1",
      cardName: "Nubank",
      competenceMonth: "2026-11",
      closingDate: "2026-11-25",
      dueDate: "2026-12-05",
      balanceCents: 35_000,
      targetRoute: "/cartoes?card=c1&month=2026-11",
    };

    // Sem opt-in omite
    expect(
      evaluateBillImpactBridge({
        isCurrentMonth: true,
        billClosingEnabled: false,
        hasLiquidityContext: true,
        safeToSpendCents: 65_000,
        closedBills: [bill],
        cycleInvoices: [
          { cardId: "c1", cardName: "Nubank", cardColor: null, competenceMonth: "2026-11", dueDate: "2026-12-05", saldoCents: 35_000 },
        ],
      }),
    ).toBeNull();

    // Base <= 0 (safeToSpend = -50_000 + deducted = 35_000 => -15_000) omite
    expect(
      evaluateBillImpactBridge({
        isCurrentMonth: true,
        billClosingEnabled: true,
        hasLiquidityContext: true,
        safeToSpendCents: -50_000,
        closedBills: [bill],
        cycleInvoices: [
          { cardId: "c1", cardName: "Nubank", cardColor: null, competenceMonth: "2026-11", dueDate: "2026-12-05", saldoCents: 35_000 },
        ],
      }),
    ).toBeNull();

    // 35_000 / (65_000 + 35_000) = exatamente 35% -> dispara
    const triggered = evaluateBillImpactBridge({
      isCurrentMonth: true,
      billClosingEnabled: true,
      hasLiquidityContext: true,
      safeToSpendCents: 65_000,
      closedBills: [bill],
      cycleInvoices: [
        { cardId: "c1", cardName: "Nubank", cardColor: null, competenceMonth: "2026-11", dueDate: "2026-12-05", saldoCents: 35_000 },
      ],
    });
    expect(triggered?.canonicalId).toBe("cashflow.bill_impact.c1.2026-11");
    expect(triggered?.breakdown?.result.rawValue).toBeCloseTo(35, 3);
    expect(triggered?.targetRoute).toBe("/cartoes?card=c1&month=2026-11");
  });

  it("4. budget.category_pace exige >=80% sem arredondar e dia/dias <60%, deduplicando estouros", () => {
    const categories: Category[] = [
      { id: "c-food", user_id: "u1", type: "expense", name: "Mercado", icon: null, color: null, is_reserved: false, is_active: true },
      { id: "c-over", user_id: "u1", type: "expense", name: "Lazer", icon: null, color: null, is_reserved: false, is_active: true },
    ];
    const budgets: Budget[] = [
      { id: "b1", user_id: "u1", category_id: "c-food", month: "2026-11", limit: 1000 },
      { id: "b2", user_id: "u1", category_id: "c-over", month: "2026-11", limit: 500 },
    ];
    const expenses: Expense[] = [
      {
        id: "e1",
        user_id: "u1",
        value: 800,
        date: "2026-11-10",
        category_id: "c-food",
        payment_method: "pix",
        card_id: null,
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: null,
        report_weight: 1,
        base_amount: 800,
        description: "Supermercado",
        created_at: "2026-11-10T10:00:00Z",
      },
      {
        id: "e2",
        user_id: "u1",
        value: 600,
        date: "2026-11-11",
        category_id: "c-over",
        payment_method: "pix",
        card_id: null,
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: null,
        report_weight: 1,
        base_amount: 600,
        description: "Show",
        created_at: "2026-11-11T10:00:00Z",
      },
    ];

    // Dia 18/30 = 60% -> não pode disparar
    expect(
      evaluateBudgetCategoryPaceBridge({
        month: "2026-11",
        isCurrentMonth: true,
        dayOfMonth: 18,
        daysInMonth: 30,
        budgets,
        expenses,
        categories,
      }),
    ).toBeNull();

    // Dia 17/30 (< 60%), 80% exato -> dispara c-food e ignora c-over (já estourado)
    const hit = evaluateBudgetCategoryPaceBridge({
      month: "2026-11",
      isCurrentMonth: true,
      dayOfMonth: 17,
      daysInMonth: 30,
      budgets,
      expenses,
      categories,
    });
    expect(hit?.canonicalId).toBe("budget.category_pace.c-food");
    expect(hit?.targetRoute).toBe("/orcamentos?tab=limits&mes=2026-11&categoria=c-food");
  });

  it("5. bridge.monthly_contribution_consistency ignora Marco Zero e suprime após aporte real", () => {
    const marcoZero: PortfolioContribution[] = [
      {
        id: "c0",
        user_id: "u1",
        asset_id: null,
        date: "2026-11-01",
        amount: 5000,
        notes: "Marco Zero inicial",
      },
    ];
    const realContrib: PortfolioContribution[] = [
      ...marcoZero,
      { id: "c1", user_id: "u1", asset_id: "a1", date: "2026-11-15", amount: 300, notes: "Aporte" },
    ];

    // Dia 21 não dispara
    expect(
      evaluateMonthlyContributionConsistencyBridge({
        month: "2026-11",
        isCurrentMonth: true,
        dayOfMonth: 21,
        daysInMonth: 30,
        allocationIntent: "portfolio_aporte",
        suggestedAporteCents: 25_000,
        contributions: marcoZero,
      }),
    ).toBeNull();

    // Dia 22 sem aporte real (apenas Marco Zero) -> dispara
    const hit = evaluateMonthlyContributionConsistencyBridge({
      month: "2026-11",
      isCurrentMonth: true,
      dayOfMonth: 22,
      daysInMonth: 30,
      allocationIntent: "portfolio_aporte",
      suggestedAporteCents: 25_000,
      contributions: marcoZero,
    });
    expect(hit?.canonicalId).toBe("bridge.monthly_contribution_consistency");
    expect(hit?.targetRoute).toBe("/investments?tab=rebalancear&view=simulador&valor=25000");

    // Com aporte real no mês -> resolve
    expect(
      evaluateMonthlyContributionConsistencyBridge({
        month: "2026-11",
        isCurrentMonth: true,
        dayOfMonth: 25,
        daysInMonth: 30,
        allocationIntent: "portfolio_aporte",
        suggestedAporteCents: 25_000,
        contributions: realContrib,
      }),
    ).toBeNull();
  });

  it("6. trip.settlement_pending só usa detalhe quente, não gera os_push e destaca saldo pessoal", () => {
    const trip: Trip = {
      id: "trip-1",
      host_user_id: "u1",
      title: "Bariloche",
      destination: "ARG",
      start_date: "2026-10-01",
      end_date: "2026-10-10",
      status: "settling",
      currency: "BRL",
      public_token: "tok",
      passcode_hash: null,
      cover_photo_url: null,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-12T00:00:00Z",
    };

    // Sem detalhe quente no cache -> omite sem erro
    expect(
      evaluateTripSettlementPendingBridge({
        trips: [trip],
        warmTripDetailsById: new Map(),
        currentUserId: "u1",
        today: "2026-11-27",
      }),
    ).toBeNull();

    const warm = new Map([
      [
        "trip-1",
        {
          trip,
          totalExpensesCents: 100_000,
          members: [
            { id: "m1", trip_id: "trip-1", name: "Eu", user_id: "u1", pix_key: null, pix_key_type: null, is_host: true, created_at: "2026-10-01T00:00:00Z" },
            { id: "m2", trip_id: "trip-1", name: "Ana", user_id: "u2", pix_key: null, pix_key_type: null, is_host: false, created_at: "2026-10-01T00:00:00Z" },
          ],
          balances: [
            { memberId: "m1", name: "Eu", totalPaidCents: 70_000, totalOwedCents: 50_000, settlementsPaidCents: 0, settlementsReceivedCents: 0, netBalanceCents: 20_000 },
            { memberId: "m2", name: "Ana", totalPaidCents: 30_000, totalOwedCents: 50_000, settlementsPaidCents: 0, settlementsReceivedCents: 0, netBalanceCents: -20_000 },
          ],
        },
      ],
    ]);

    const res = evaluateTripSettlementPendingBridge({
      trips: [trip],
      warmTripDetailsById: warm,
      currentUserId: "u1",
      today: "2026-11-27",
    });

    expect(res?.canonicalId).toBe("trip.settlement_pending.trip-1");
    expect(res?.hubNotification.channels).not.toContain("os_push");
    expect(res?.severity).toBe("P2_ADVISORY");
    expect(res?.targetRoute).toBe("/viagens/trip-1?tab=settlements&member=m1");
    expect(res?.breakdown?.result.rawValue).toBe(20_000);
  });

  it("7. data.hygiene_review não confunde categoria histórica ausente do catálogo filtrado e exige >= 5 pendentes", () => {
    const categories: Category[] = [
      { id: "cat-uncat", user_id: "u1", type: "expense", name: "Sem categoria", icon: null, color: null, is_reserved: false, is_active: true },
      { id: "cat-ok", user_id: "u1", type: "expense", name: "Alimentação", icon: null, color: null, is_reserved: false, is_active: true },
    ];
    const buildExp = (id: string, category_id: string): Expense => ({
      id,
      user_id: "u1",
      value: 20,
      date: "2026-11-10",
      category_id,
      payment_method: "pix",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 20,
      description: `Item ${id}`,
      created_at: "2026-11-10T10:00:00Z",
    });

    // 4 pendentes + 3 com categoria histórica (ausente do catálogo) -> NÃO dispara
    expect(
      evaluateDataHygieneReviewBridge({
        month: "2026-11",
        isCurrentMonth: true,
        categories,
        expenses: [
          buildExp("e1", "cat-uncat"),
          buildExp("e2", "cat-uncat"),
          buildExp("e3", ""),
          buildExp("e4", "cat-uncat"),
          buildExp("h1", "legacy-hidden-id"),
          buildExp("h2", "legacy-hidden-id"),
          buildExp("h3", "legacy-hidden-id"),
        ],
      }),
    ).toBeNull();

    // 5 pendentes verificáveis -> dispara com ?ids=
    const hit = evaluateDataHygieneReviewBridge({
      month: "2026-11",
      isCurrentMonth: true,
      categories,
      expenses: [
        buildExp("e1", "cat-uncat"),
        buildExp("e2", "cat-uncat"),
        buildExp("e3", ""),
        buildExp("e4", "cat-uncat"),
        buildExp("e5", "cat-uncat"),
      ],
    });
    expect(hit?.canonicalId).toBe("data.hygiene_review");
    expect(hit?.targetRoute).toBe("/transacoes?mes=2026-11&ids=e1%2Ce2%2Ce3%2Ce4%2Ce5");
  });

  it("projeções direcionais Carteira <-> Home respeitam limites, dispensa e resolução", () => {
    expect(
      evaluatePortfolioIdleCashForHome({
        brokerageCashBRL: 499.99,
        hasEligibleDeficitTarget: true,
      }),
    ).toBeNull();

    expect(
      evaluatePortfolioDiscountForHome({
        discountInsights: [
          {
            id: "disc-1",
            kind: "discount_opportunity",
            severity: "positive",
            title: "PETR4 com desconto",
            description: "Margem de 20%",
            ticker: "PETR4",
            discountPct: 20,
          },
        ],
        allocationIntent: "emergency_fund",
        suggestedAporteCents: 30_000,
      }),
    ).toBeNull();

    const criticalGap = evaluateHomeCashGapForInvestments({
      isCurrentMonth: true,
      cashGapResult: {
        isCashGapDetected: true,
        severity: "critical",
        gapDate: "2026-11-29",
        daysUntilGap: 2,
        maxDeficitCents: 40_000,
        nextInflowDate: null,
        causingObligations: [],
        recommendationMessage: "Déficit previsto em 2 dias.",
        runway: [],
      },
    });
    expect(criticalGap?.canonicalId).toBe("cashflow.cash_gap");

    const surplusCard = evaluateHomeSurplusForInvestments({
      isCurrentMonth: true,
      allocationIntent: "portfolio_aporte",
      suggestedAporteCents: 30_000,
      hasCashGapCritical: false,
    });
    expect(surplusCard?.targetRoute).toBe(
      "/investments?tab=rebalancear&view=simulador&valor=30000",
    );

    // Furo crítico na carteira suprime sobra via selectCarouselSlots
    const slotRes = selectCarouselSlots({
      channel: "investments_carousel",
      items: [
        ...(criticalGap ? [{ ...criticalGap, id: criticalGap.canonicalId }] : []),
        ...(surplusCard ? [{ ...surplusCard, id: surplusCard.canonicalId }] : []),
      ],
    });
    expect(slotRes.visibleItems.map((i) => i.canonicalId)).toEqual(["cashflow.cash_gap"]);
  });
});
