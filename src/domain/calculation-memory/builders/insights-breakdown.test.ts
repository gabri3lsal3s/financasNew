import { describe, expect, it } from "vitest";
import { buildPaceProjectionBreakdown, buildSmartAdvisorBreakdown } from "./insights-breakdown";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";

describe("buildSmartAdvisorBreakdown", () => {
  it("deve montar breakdown completo para reajuste de preço (price_adj)", () => {
    const insight: SmartAdvisorInsight = {
      id: "price_adj:netflix",
      themeKey: "price_adj:netflix",
      priority: 3,
      category: "savings",
      title: "Reajuste em Netflix",
      description: "Netflix aumentou 25% (de R$ 40,00 para R$ 50,00).",
      iconName: "trending-down",
      metadata: {
        percentIncrease: 25,
        valueCents: 5000,
      },
    };

    const breakdown = buildSmartAdvisorBreakdown(insight);

    expect(breakdown.title).toBe("Memória do Reajuste de Assinatura");
    expect(breakdown.result.unit).toBe("percent");
    expect(breakdown.result.rawValue).toBe(25);
    expect(breakdown.steps).toHaveLength(4);
    expect(breakdown.steps[0]?.rawValue).toBe(4000); // 5000 / 1.25 = 4000
    expect(breakdown.steps[1]?.rawValue).toBe(5000);
    expect(breakdown.steps[2]?.rawValue).toBe(1000); // 10,00 mensal
    expect(breakdown.steps[3]?.rawValue).toBe(12000); // 120,00 anual
    expect(breakdown.copyText).toContain("Percentual de Reajuste: 25,0%");
  });

  it("deve montar breakdown completo para cobranças duplicadas (dup)", () => {
    const insight: SmartAdvisorInsight = {
      id: "dup:spotify",
      themeKey: "dup:spotify",
      priority: 1,
      category: "critical",
      title: "Cobrança duplicada detectada",
      description: "Identificamos 2 cobranças de Spotify no mês atual.",
      iconName: "alert-triangle",
      metadata: {
        duplicateCount: 2,
        valueCents: 3490,
      },
    };

    const breakdown = buildSmartAdvisorBreakdown(insight);

    expect(breakdown.title).toBe("Memória de Cobrança Duplicada");
    expect(breakdown.result.unit).toBe("currency");
    expect(breakdown.result.rawValue).toBe(3490); // 1 duplicidade
    expect(breakdown.steps[1]?.rawValue).toBe(2);
    expect(breakdown.steps[2]?.rawValue).toBe(6980);
  });

  it("deve montar breakdown com burn rate diário para hábito de consumo (habit)", () => {
    const insight: SmartAdvisorInsight = {
      id: "habit:delivery",
      themeKey: "habit:delivery",
      priority: 3,
      category: "savings",
      title: "Hábito frequente: Delivery e refeições",
      description: "Você realizou 8 despesas neste mês totalizando R$ 450,00.",
      iconName: "trending-down",
      metadata: {
        valueCents: 45000,
        annualSavingsCents: 540000,
      },
    };

    const breakdown = buildSmartAdvisorBreakdown(insight, {
      dayOfMonth: 15,
      daysInMonth: 30,
    });

    expect(breakdown.title).toBe("Memória do Hábito de Consumo");
    expect(breakdown.steps[0]?.rawValue).toBe(45000);
    expect(breakdown.steps[1]?.rawValue).toBe(3000); // 45000 / 15 = 3000 (R$ 30,00/dia)
    expect(breakdown.steps[2]?.rawValue).toBe(90000); // 3000 * 30 = 90000
    expect(breakdown.steps[3]?.rawValue).toBe(540000);
  });

  it("deve montar breakdown para teto familiar estourado", () => {
    const insight: SmartAdvisorInsight = {
      id: "household:ceiling_exceeded",
      themeKey: "household:ceiling_exceeded",
      priority: 1,
      category: "critical",
      title: "Teto familiar estourado",
      description: "A casa ultrapassou o teto em R$ 500,00.",
      iconName: "alert-triangle",
      metadata: {
        valueCents: 550000,
      },
    };

    const breakdown = buildSmartAdvisorBreakdown(insight, {
      currentPeriodCents: 500000,
    });

    expect(breakdown.title).toBe("Memória do Teto Familiar");
    expect(breakdown.result.rawValue).toBe(50000);
    expect(breakdown.steps[0]?.rawValue).toBe(550000);
    expect(breakdown.steps[1]?.rawValue).toBe(500000);
    expect(breakdown.steps[2]?.rawValue).toBe(50000);
  });

  it("deve montar breakdown pro-rata quando comparando períodos equivalentes (AUD-05)", () => {
    const insight: SmartAdvisorInsight = {
      id: "anomaly:restaurants",
      themeKey: "anomaly:restaurants",
      priority: 3,
      category: "savings",
      title: "Aumento em Restaurantes",
      description: "Você gastou 50% a mais do que no mesmo período do mês passado.",
      iconName: "trending-down",
    };

    const breakdown = buildSmartAdvisorBreakdown(insight, {
      dayOfMonth: 10,
      previousPeriodCents: 20000,
      currentPeriodCents: 30000,
    });

    expect(breakdown.title).toBe("Memória da Comparação Pro-Rata");
    expect(breakdown.result.unit).toBe("percent");
    expect(breakdown.result.rawValue).toBe(50);
    expect(breakdown.periodLabel).toBe("Primeiros 10 dias");
    expect(breakdown.steps[0]?.rawValue).toBe(20000);
    expect(breakdown.steps[1]?.rawValue).toBe(30000);
    expect(breakdown.steps[2]?.rawValue).toBe(10000);
    expect(breakdown.steps[3]?.rawValue).toBe(3000); // 30000 / 10 = 3000/dia
  });

  it("buildPaceProjectionBreakdown detalha base, fixos (1x), suavização e nota entre lentes", () => {
    const breakdown = buildPaceProjectionBreakdown({
      month: "2026-08",
      referenceBudgetCents: 600000,
      referenceBudgetSource: "expected_income",
      isProvisionalReference: true,
      fixedPaidCents: 220000,
      pendingFixedCents: 30000,
      oneOffAndTripCents: 50000,
      projectedVariableCents: 180000,
      historicalVariableMedianCents: 180000,
      blendedWeight: 0.25,
      refundsNeutralizedCents: 10000,
      priorCycleRefundCreditCents: 0,
      investmentCents: 40000,
      projectedSurplusCents: 80000,
      dailyCents: 6500,
      dayOfMonth: 7,
      daysInMonth: 31,
    });

    expect(breakdown.id).toBe("pace-projection-2026-08");
    expect(breakdown.steps.some((s) => s.label.includes("Base Provisória") && s.rawValue === 600000)).toBe(true);
    expect(breakdown.steps.some((s) => s.label.includes("Fixas") && s.rawValue === 220000)).toBe(true);
    expect(breakdown.steps.some((s) => s.label.includes("Pendentes") && s.rawValue === 30000)).toBe(true);
    expect(breakdown.steps.some((s) => s.label.includes("Pontuais") && s.rawValue === 50000)).toBe(true);
    expect(breakdown.steps.some((s) => s.hint?.includes("Suavização quadrática"))).toBe(true);
    expect(breakdown.result.rawValue).toBe(80000);
    expect(breakdown.notes?.some((n) => n.includes("Lente Consumo (competência)"))).toBe(true);
    expect(breakdown.notes?.some((n) => n.includes("neutralização"))).toBe(true);
  });
});
