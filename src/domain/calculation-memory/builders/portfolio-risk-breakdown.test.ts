import { describe, expect, it } from "vitest";
import { DEFAULT_PORTFOLIO_RISK_POLICY } from "@/domain/portfolio/portfolio-risk-policy";
import { buildPortfolioRiskBreakdown } from "./portfolio-risk-breakdown";

describe("buildPortfolioRiskBreakdown (Fase 2B)", () => {
  it("monta memória de concentração em ativo único com fallback anotado e copyText", () => {
    const b = buildPortfolioRiskBreakdown({
      kind: "asset",
      asOf: "2026-11-27",
      totalCents: 100_000,
      constituents: [{ assetId: "a-1", ticker: "PETR4", valueCents: 40_000, source: "position" }],
      fallbackTickers: ["CDB-X"],
      policy: DEFAULT_PORTFOLIO_RISK_POLICY,
      itemId: "a-1",
      ticker: "PETR4",
      weightPct: 40,
      limitPct: 15,
    });

    expect(b.result.rawValue).toBe(40);
    expect(b.unit).toBe("percent");
    expect(b.notes?.[0]).toContain("CDB-X");
    expect(b.copyText).toContain("PETR4");
  });

  it("monta memória de emissor privado FGC com vencedora e aviso prudencial", () => {
    const b = buildPortfolioRiskBreakdown({
      kind: "issuer",
      asOf: "2026-11-27",
      totalCents: 100_000_000,
      constituents: [
        { assetId: "rf-1", ticker: "CDB-MASTER", valueCents: 26_000_000, source: "position" },
      ],
      policy: DEFAULT_PORTFOLIO_RISK_POLICY,
      issuerKey: "banco_master",
      issuerLabel: "Banco Master",
      exposureCents: 26_000_000,
      rfCents: 50_000_000,
      classPct: 52,
      globalPct: 26,
      breachedLimit: "fgc_absolute",
    });

    expect(b.result.rawValue).toBe(26_000_000);
    expect(b.unit).toBe("currency");
    expect(b.notes?.[0]).toContain("FGC");
  });

  it("monta memória de Nef com unidade count e contribuições w_i^2", () => {
    const b = buildPortfolioRiskBreakdown({
      kind: "nef",
      asOf: "2026-11-27",
      totalCents: 100_000,
      constituents: [],
      policy: DEFAULT_PORTFOLIO_RISK_POLICY,
      classCents: 50_000,
      weights: [
        { ticker: "PETR4", weight: 0.8, weightSq: 0.64 },
        { ticker: "VALE3", weight: 0.2, weightSq: 0.04 },
      ],
      hhi: 0.68,
      nef: 1.47,
    });

    expect(b.unit).toBe("count");
    expect(b.result.rawValue).toBe(1.47);
    expect(b.result.formattedValue).toContain("1,47");
  });
});
