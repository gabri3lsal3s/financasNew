import { describe, expect, it } from "vitest";
import {
  buildDividendCarouselBreakdown,
  buildPortfolioCarouselBreakdown,
} from "./portfolio-carousel-breakdown";

describe("buildPortfolioCarouselBreakdown & buildDividendCarouselBreakdown (Fase 2B)", () => {
  it("monta drift com classe sem meta e desconto em moeda nativa USD", () => {
    const drift = buildPortfolioCarouselBreakdown({
      kind: "drift",
      investableCents: 50_000,
      classes: [{ name: "Ações", valueCents: 40_000, targetPct: 100, diffPp: -20 }],
      unallocatedClassesBRL: 100,
      unallocatedClassNames: ["Cripto"],
      tolerancePp: 5,
    });
    expect(drift.result.rawValue).toBe(-20);
    expect(drift.steps.some((s) => s.label.includes("Cripto"))).toBe(true);

    const discount = buildPortfolioCarouselBreakdown({
      kind: "discount",
      ticker: "AAPL",
      currency: "USD",
      quote: 160,
      ceiling: 200,
      quoteSource: "api",
      score: 9,
      discountPct: 20,
    });
    expect(discount.steps[0]?.formattedValue).toContain("US$");
    expect(discount.result.rawValue).toBe(20);
  });

  it("soma apenas eventos incluídos em proventos e preserva nota de evento sem data", () => {
    const b = buildDividendCarouselBreakdown({
      kind: "monthly",
      asOf: "2026-11-27",
      month: "2026-11",
      fxRate: 5.0,
      items: [
        {
          key: "d1",
          ticker: "AAPL",
          currency: "USD",
          quantityOnComDate: 10,
          grossRate: 1,
          netRate: 0.7,
          taxPct: 30,
          taxSource: "US 30%",
          paymentDate: null,
          nativeNetCents: 700,
          netBRLCents: 3500,
          included: true,
        },
        {
          key: "d2",
          ticker: "PETR4",
          currency: "BRL",
          quantityOnComDate: 10,
          grossRate: 1,
          netRate: 1,
          taxPct: 0,
          taxSource: "Isento",
          paymentDate: "2026-12-10",
          nativeNetCents: 1000,
          netBRLCents: 1000,
          included: false,
          reason: "pagamento em outro mês",
        },
      ],
      count: 1,
      totalBRLCents: 3500,
    });

    expect(b.result.rawValue).toBe(3500);
    expect(b.exclusions).toHaveLength(1);
    expect(b.notes?.some((n) => n.includes("Sem data") || n.includes("sem data"))).toBe(true);
  });
});
