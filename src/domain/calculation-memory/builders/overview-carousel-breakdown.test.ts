import { describe, expect, it } from "vitest";
import {
  buildBillImpactBreakdown,
  buildBudgetCategoryPaceBreakdown,
  buildCombinedContributionBreakdown,
  buildDebtVsInvestBreakdown,
  buildGoalProgressBreakdown,
  buildMonthlyContributionConsistencyBreakdown,
  buildSplitPendingBreakdown,
} from "./overview-carousel-breakdown";

describe("overview-carousel-breakdown (Fases 2B & 5)", () => {
  it("monta progresso de meta respeitando 1 centavo faltante e ritmo diário", () => {
    const b = buildGoalProgressBreakdown({
      shareId: "g-1",
      goalTitle: "Reserva",
      asOf: "2026-11-27",
      deadline: "2026-11-28",
      targetCents: 10_000,
      currentCents: 9_999,
      source: "composição ao vivo",
      remainingCents: 1,
      remainingDays: 1,
      requiredDailyCents: 1,
      stage: "final_stretch",
    });

    expect(b.result.rawValue).toBe(1);
    expect(b.steps.some((s) => s.label.includes("Ritmo Diário"))).toBe(true);
  });

  it("monta rachas pendentes sem inventar participantes em item legado", () => {
    const b = buildSplitPendingBreakdown({
      items: [
        {
          id: "s-1",
          title: "Jantar",
          source: "share",
          expenseCents: 10_000,
          pendingCents: 5_000,
          parts: [{ participantId: "p-1", amountCents: 5_000, settledCents: 0 }],
        },
        {
          id: "debt_1",
          title: "Legado",
          source: "legacy_debt",
          expenseCents: 4_000,
          pendingCents: 2_000,
          parts: [],
        },
      ],
      pendingCents: 7_000,
      count: 2,
    });

    expect(b.result.rawValue).toBe(7_000);
    expect(b.notes?.[0]).toContain("sem inferir participantes");
  });

  it("buildCombinedContributionBreakdown soma sobra + caixa e exclui proventos pendentes", () => {
    const b = buildCombinedContributionBreakdown({
      asOf: "2026-11-27",
      month: "2026-11",
      surplusCents: 30_000,
      brokerageCashCents: 12_000,
      combinedCents: 42_000,
      minTicketCents: 10_000,
      pendingDividendsCount: 2,
      pendingDividendsBRLCents: 5_500,
      eligibleClass: "Ações",
    });

    expect(b.unit).toBe("currency");
    expect(b.result.rawValue).toBe(42_000);
    expect(b.steps).toHaveLength(2);
    expect(b.steps[0]?.hint).toContain("Ações");
    expect(b.notes?.some((n) => n.includes("não são somados"))).toBe(true);
    expect(b.notes?.some((n) => n.includes("2 provento(s)"))).toBe(true);
    expect(b.copyText).toContain("420,00");
  });

  it("buildDebtVsInvestBreakdown formata taxa em pt-BR sem prometer retorno", () => {
    const b = buildDebtVsInvestBreakdown({
      loanId: "loan-1",
      loanName: "Empréstimo Pessoal",
      interestRateMonthlyPct: 2.35,
      thresholdRateMonthlyPct: 1.5,
      pendingInstallmentsCount: 8,
      remainingDebtCents: 120_000,
      availableSurplusCents: 35_000,
      availableBrokerageCashCents: 60_000,
      asOf: "2026-11-27",
    });

    expect(b.unit).toBe("percent");
    expect(b.result.rawValue).toBe(2.35);
    expect(b.result.formattedValue).toBe("2,35% a.m.");
    expect(b.steps[0]?.formattedValue).toBe("2,35% a.m.");
    expect(b.notes?.[0]).toContain("sem estimativa de retorno garantido");
    expect(b.copyText).toContain("2,35% a.m.");
  });

  it("buildBillImpactBreakdown demonstra recomposição da base pré-reserva em pt-BR", () => {
    const b = buildBillImpactBreakdown({
      cardId: "card-1",
      cardName: "Nubank",
      competenceMonth: "2026-11",
      dueDate: "2026-12-05",
      billBalanceCents: 40_000,
      safeToSpendCents: 60_000,
      alreadyDeductedCents: 40_000,
      baseLiquidityCents: 100_000,
      impactPct: 40.0,
      thresholdPct: 35,
    });

    expect(b.unit).toBe("percent");
    expect(b.result.rawValue).toBe(40);
    expect(b.result.formattedValue).toBe("40,0%");
    expect(b.steps.some((s) => s.rawValue === 100_000)).toBe(true);
    expect(b.copyText).toContain("40,0%");
  });

  it("buildBudgetCategoryPaceBreakdown expõe uso percentual e dias decorridos", () => {
    const b = buildBudgetCategoryPaceBreakdown({
      categoryId: "cat-1",
      categoryName: "Mercado",
      month: "2026-11",
      spentCents: 85_000,
      limitCents: 100_000,
      usedPct: 85.0,
      dayOfMonth: 12,
      daysInMonth: 30,
      elapsedPct: 40.0,
      remainingCents: 15_000,
    });

    expect(b.unit).toBe("percent");
    expect(b.result.rawValue).toBe(85);
    expect(b.result.formattedValue).toBe("85,0%");
    expect(b.steps.some((s) => s.rawValue === 15_000)).toBe(true);
    expect(b.copyText).toContain("85,0%");
  });

  it("buildMonthlyContributionConsistencyBreakdown destaca sobra pronta e dia do mês", () => {
    const b = buildMonthlyContributionConsistencyBreakdown({
      month: "2026-11",
      dayOfMonth: 24,
      daysInMonth: 30,
      suggestedAporteCents: 45_000,
      realizedContributionsCents: 0,
      minDayThreshold: 22,
      minSurplusCents: 20_000,
    });

    expect(b.unit).toBe("currency");
    expect(b.result.rawValue).toBe(45_000);
    expect(b.exclusions?.[0]).toContain("Marco Zero");
    expect(b.copyText).toContain("450,00");
  });
});
