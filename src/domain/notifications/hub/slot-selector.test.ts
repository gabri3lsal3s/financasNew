import { describe, expect, it } from "vitest";
import { selectCarouselSlots, type CarouselSlotCandidate } from "./slot-selector";

describe("slot-selector (Onda 2 · Fase 5)", () => {
  it("limita a Home a 3 posições padrão e ordena deterministicamente por prioridade e relevância", () => {
    const items: CarouselSlotCandidate[] = [
      { id: "c4", canonicalId: "cashflow.surplus", priority: 4, cycleRelevance: 10 },
      { id: "c2", canonicalId: "budget.category_pace.food", priority: 2, cycleRelevance: 85 },
      { id: "c1", canonicalId: "bridge.combined_contribution", priority: 2, cycleRelevance: 95 },
      { id: "c3", canonicalId: "bridge.debt_vs_invest.l1", priority: 3, cycleRelevance: 50 },
    ];

    const res = selectCarouselSlots({
      channel: "home_carousel",
      items,
    });

    expect(res.focusedCriticalMode).toBe(false);
    expect(res.visibleItems.map((i) => i.id)).toEqual(["c1", "c2", "c3"]);
    expect(res.hiddenItems.map((i) => i.id)).toEqual(["c4"]);
    expect(res.hiddenCount).toBe(1);
    expect(res.isSilent).toBe(false);
  });

  it("ativa modo focado (1 slide) na Home quando existe P0 obrigatório ou prioridade <= 1", () => {
    const items: CarouselSlotCandidate[] = [
      { id: "pace", canonicalId: "cashflow.pace", priority: 2 },
      {
        id: "gap",
        canonicalId: "cashflow.cash_gap",
        priority: 1,
        severity: "P0_CRITICAL",
      },
      { id: "surplus", canonicalId: "cashflow.surplus", priority: 4 },
    ];

    const res = selectCarouselSlots({ channel: "home_carousel", items });
    expect(res.focusedCriticalMode).toBe(true);
    expect(res.visibleItems.map((i) => i.id)).toEqual(["gap"]);
    expect(res.hiddenCount).toBe(2);
  });

  it("garante que billing.past_due e trial <= 3d sobrevivam a dispensas no catálogo", () => {
    const futureUntil = Date.now() + 30 * 86_400_000;
    const items: CarouselSlotCandidate[] = [
      {
        id: "past-due",
        canonicalId: "billing.past_due",
        priority: 0,
        severity: "P0_CRITICAL",
        isMandatoryBlocking: true,
      },
      {
        id: "surplus",
        canonicalId: "cashflow.surplus",
        priority: 4,
      },
    ];

    const res = selectCarouselSlots({
      channel: "home_carousel",
      items,
      carouselDismissals: {
        "billing.past_due": {
          preset: "7d",
          dismissedAt: Date.now(),
          dismissedUntil: futureUntil,
        },
        "cashflow.surplus": {
          preset: "7d",
          dismissedAt: Date.now(),
          dismissedUntil: futureUntil,
        },
      },
    });

    expect(res.visibleItems.map((i) => i.id)).toEqual(["past-due"]);
  });

  it("aplica teto de 5 slots em Investimentos com máximo de 2 riscos estruturais", () => {
    const items: CarouselSlotCandidate[] = [
      { id: "r1", canonicalId: "portfolio.risk.single_asset.PETR4", priority: 1, isStructuralRisk: true },
      { id: "r2", canonicalId: "portfolio.risk.macro_sector.bancos", priority: 1.5, isStructuralRisk: true },
      { id: "r3", canonicalId: "portfolio.risk.benchmark_overlap.ibov", priority: 2, isStructuralRisk: true },
      { id: "d1", canonicalId: "portfolio.dividends_available", priority: 2.2 },
      { id: "bridge", canonicalId: "bridge.combined_contribution", priority: 2.5 },
      { id: "gov", canonicalId: "portfolio.governance_review", priority: 3 },
      { id: "disc", canonicalId: "portfolio.discount", priority: 4 },
    ];

    const res = selectCarouselSlots({
      channel: "investments_carousel",
      items,
    });

    expect(res.visibleItems).toHaveLength(5);
    expect(res.visibleItems.map((i) => i.id)).toEqual(["r1", "r2", "d1", "bridge", "gov"]);
    expect(res.hiddenItems.map((i) => i.id)).toEqual(["r3", "disc"]);
  });

  it("aplica supressões de pontes e deduplica aliases e entityRefs equivalentes", () => {
    const items: CarouselSlotCandidate[] = [
      {
        id: "combined",
        canonicalId: "bridge.combined_contribution",
        priority: 2,
        suppressCanonicalIds: ["cashflow.surplus_aporte", "portfolio.idle_cash"],
      },
      { id: "surplus-alias", canonicalId: "cashflow.surplus", priority: 4 },
      { id: "idle-cash", canonicalId: "portfolio.idle_cash", priority: 5 },
      {
        id: "loan-1",
        canonicalId: "bridge.debt_vs_invest.l1",
        priority: 2.5,
        entityRefs: ["loan:l1"],
      },
      {
        id: "loan-dup",
        canonicalId: "advisor.debt:l1",
        priority: 3,
        entityRefs: ["loan:l1"],
      },
    ];

    const res = selectCarouselSlots({
      channel: "home_carousel",
      items,
    });

    expect(res.visibleItems.map((i) => i.id)).toEqual(["combined", "loan-1"]);
    expect(res.suppressedIds).toEqual(["cashflow.surplus", "portfolio.idle_cash"]);
  });

  it("retorna silêncio intencional quando todos os candidatos são filtrados", () => {
    const res = selectCarouselSlots({
      channel: "home_carousel",
      items: [
        {
          id: "inv-only",
          canonicalId: "portfolio.drift",
          priority: 3,
          channels: ["investments_carousel"],
        },
      ],
    });

    expect(res.visibleItems).toEqual([]);
    expect(res.isSilent).toBe(true);
    expect(res.hiddenCount).toBe(0);
  });
});
