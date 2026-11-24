import { describe, expect, it } from "vitest";
import {
  buildScopedOneOffKey,
  buildTxOneOffKey,
  buildUnifiedLearningGraph,
  estimateUpcomingCycleInflowsCents,
  inferPaydayProfile,
  stripOccurrencePrefix,
} from "./learning-graph";

describe("UnifiedLearningGraph (PLANO MESTRE FASE 1)", () => {
  it("isola `tx_one_off:<expenseId>` em oneOffExpenseIds sem poluir ignoredKeys", () => {
    const key = buildTxOneOffKey("exp-notebook-1");
    const graph = buildUnifiedLearningGraph({
      referenceMonth: "2026-11",
      feedbackEntries: [
        { occurrenceKey: key, decision: "one_off", createdAt: "2026-11-10T12:00:00Z" },
      ],
    });

    expect(graph.oneOffExpenseIds.has("exp-notebook-1")).toBe(true);
    expect(graph.ignoredKeys.size).toBe(0);
    expect(graph.activeFeedbackMap[key]).toBe("one_off");
  });

  it("respeita escopo mensal explícito (`one_off:YYYY-MM:<slug>`) e expira na virada do mês", () => {
    const keyNov = buildScopedOneOffKey("2026-11", "habit:cat-lazer:viagem");
    const keyOct = buildScopedOneOffKey("2026-10", "sub:netflix");

    const graphNov = buildUnifiedLearningGraph({
      referenceMonth: "2026-11",
      feedbackEntries: [
        { occurrenceKey: keyNov, decision: "one_off", createdAt: "2026-11-05T10:00:00Z" },
        { occurrenceKey: keyOct, decision: "one_off", createdAt: "2026-10-12T10:00:00Z" },
      ],
    });

    expect(graphNov.currentMonthOneOffKeys.has("habit:cat-lazer:viagem")).toBe(true);
    expect(graphNov.currentMonthOneOffKeys.has("sub:netflix")).toBe(false);
    expect(graphNov.activeFeedbackMap["sub:netflix"]).toBeUndefined();
  });

  it("aplica fallback legado de `one_off` baseado em `created_at.slice(0, 7)` (expira em mês seguinte)", () => {
    const graphNov = buildUnifiedLearningGraph({
      referenceMonth: "2026-11",
      feedbackEntries: [
        { occurrenceKey: "recurring:oficina", decision: "one_off", createdAt: "2026-11-03T15:00:00Z" },
        { occurrenceKey: "recurring:dentista", decision: "one_off", createdAt: "2026-10-20T15:00:00Z" },
      ],
    });

    expect(graphNov.currentMonthOneOffKeys.has("recurring:oficina")).toBe(true);
    expect(graphNov.currentMonthOneOffKeys.has("oficina")).toBe(true);
    expect(graphNov.currentMonthOneOffKeys.has("recurring:dentista")).toBe(false);
    expect(graphNov.currentMonthOneOffKeys.has("dentista")).toBe(false);
  });

  it("propaga decisões `essential`, `ignored`, orçamentos com herança e aliases de merchantLearning", () => {
    const graph = buildUnifiedLearningGraph({
      referenceMonth: "2026-11",
      feedbackEntries: [
        { occurrenceKey: "sub:smartfit", decision: "essential", createdAt: "2026-09-01T10:00:00Z" },
        { occurrenceKey: "sub:hbo", decision: "already_cancelled", createdAt: "2026-09-10T10:00:00Z" },
      ],
      budgets: [
        { category_id: "cat-delivery", month: "2026-10", limit: 600 }, // herdado para 2026-11
        { category_id: "cat-mercado", month: "2026-11", limit: 1500 },
      ],
      merchantLearning: {
        tax_123: {
          friendlyName: "Feira do Sábado",
          rawAliases: ["PAG*JoseSilva", "feira sabado"],
        },
      },
    });

    expect(graph.essentialKeys.has("sub:smartfit")).toBe(true);
    expect(graph.essentialKeys.has("smartfit")).toBe(true);
    expect(graph.ignoredKeys.has("sub:hbo")).toBe(true);
    expect(graph.budgetedCategoryLimits.get("cat-delivery")).toBe(60_000);
    expect(graph.budgetedCategoryLimits.get("cat-mercado")).toBe(150_000);
    expect(graph.merchantAliasMap.get("pag*josesilva")).toBe("feira do sabado");
    expect(stripOccurrencePrefix("sub:SmartFit")).toBe("smartfit");
  });

  it("infere PaydayProfile CLT início do mês (`start_of_month`) excluindo [REFUND]", () => {
    const profile = inferPaydayProfile(
      [
        { date: "2026-08-05", value: 6000, source_ref: null },
        { date: "2026-09-05", value: 6000, source_ref: null },
        { date: "2026-10-06", value: 6000, source_ref: null },
        { date: "2026-10-20", value: 1500, source_ref: "[REFUND]pay-1" },
      ],
      "2026-11",
    );

    expect(profile.pattern).toBe("start_of_month");
    expect(profile.expectedMonthlyIncomeCents).toBe(600_000);
    expect(profile.typicalIncomeDays).toEqual([5]);
    expect(profile.confidence).toBeGreaterThanOrEqual(0.8);
    expect(profile.monthsAnalyzed).toBe(3);
  });

  it("infere PaydayProfile quinzenal/fracionado (`biweekly`) e estima parcela restante no ciclo", () => {
    const profile = inferPaydayProfile(
      [
        { date: "2026-08-15", value: 2400, source_ref: null },
        { date: "2026-08-30", value: 3600, source_ref: null },
        { date: "2026-09-15", value: 2400, source_ref: null },
        { date: "2026-09-30", value: 3600, source_ref: null },
        { date: "2026-10-15", value: 2400, source_ref: null },
        { date: "2026-10-30", value: 3600, source_ref: null },
      ],
      "2026-11",
    );

    expect(profile.pattern).toBe("biweekly");
    expect(profile.typicalIncomeDays).toEqual([15, 30]);
    expect(profile.expectedMonthlyIncomeCents).toBe(600_000);
    expect(profile.confidence).toBeGreaterThanOrEqual(0.8);

    // No dia 18, recebeu a 1ª parcela de R$ 2.400; ainda falta a parcela do dia 30 (R$ 3.600)
    const upcoming = estimateUpcomingCycleInflowsCents({
      paydayProfile: profile,
      operatingIncomeSoFarCents: 240_000,
      dayOfMonth: 18,
      daysInMonth: 30,
    });
    expect(upcoming).toBe(360_000);
  });

  it("indexa assinaturas aprendidas (`learnedServices`) e `semanticTagIndex` a partir do merchantLearning", () => {
    const graph = buildUnifiedLearningGraph({
      referenceMonth: "2026-11",
      merchantLearning: {
        tax_pet: {
          friendlyName: "Clube Petlove",
          rawAliases: ["PETLOVE ASSINAT", "petlove clube"],
          serviceSegment: "other",
          cutTier: "can_cut",
          isLearnedSubscription: true,
          semanticTags: ["pet", "racao", "assinatura"],
        },
      },
    });

    expect(graph.learnedServices.get("petlove assinat")?.isSubscription).toBe(true);
    expect(graph.learnedServices.get("clube petlove")?.tier).toBe("can_cut");
    expect(graph.semanticTagIndex.get("racao")).toContain("clube petlove");
  });
});
