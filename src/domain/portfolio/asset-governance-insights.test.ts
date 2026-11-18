import { describe, expect, it } from "vitest";
import {
  generateAssetGovernanceInsights,
  type GovernanceAssetInput,
} from "./asset-governance-insights";

const refDate = new Date("2026-11-17T12:00:00Z");

const makeAsset = (overrides: Partial<GovernanceAssetInput> & Pick<GovernanceAssetInput, "id" | "ticker">): GovernanceAssetInput => ({
  assetClass: "Ações",
  sector: "Bancos",
  currentValueBRL: 10000,
  currentPrice: 30,
  averageCost: 30,
  score: 8,
  allocation_status: "active",
  last_reviewed_at: "2026-10-01T00:00:00Z", // ~47 dias atrás
  review_frequency_months: 6,
  thesis_summary: "Tese sólida",
  ...overrides,
});

describe("domain/portfolio/asset-governance-insights (§F41)", () => {
  it("Gatilho 1: detecta ativo com revisão periódica vencida (> 180 dias)", () => {
    const assets: GovernanceAssetInput[] = [
      makeAsset({
        id: "a1",
        ticker: "ITUB4",
        last_reviewed_at: "2026-03-01T00:00:00Z", // ~261 dias atrás (> 180)
        review_frequency_months: 6,
      }),
      makeAsset({
        id: "a2",
        ticker: "BBAS3",
        last_reviewed_at: "2026-10-01T00:00:00Z", // ~47 dias atrás
      }),
    ];

    const result = generateAssetGovernanceInsights({ assets, referenceDate: refDate });

    expect(result.summary.overdueCount).toBe(1);
    const overdue = result.insights.find((i) => i.kind === "review_overdue");
    expect(overdue).toBeDefined();
    expect(overdue?.ticker).toBe("ITUB4");
    expect(overdue?.severity).toBe("warning");
  });

  it("Gatilho 2: detecta ativo em quarentena prolongada (> 90 dias)", () => {
    const assets: GovernanceAssetInput[] = [
      makeAsset({
        id: "q1",
        ticker: "OIBR3",
        allocation_status: "quarantine",
        last_reviewed_at: "2026-06-01T00:00:00Z", // ~169 dias em quarentena (> 90)
      }),
    ];

    const result = generateAssetGovernanceInsights({ assets, referenceDate: refDate });

    expect(result.summary.quarantineCount).toBe(1);
    const qInsight = result.insights.find((i) => i.kind === "quarantine_followup");
    expect(qInsight).toBeDefined();
    expect(qInsight?.ticker).toBe("OIBR3");
    expect(qInsight?.title).toContain("Quarentena prolongada");
  });

  it("Gatilho 3: detecta oportunidade em ativo de nota alta com desconto ≥ 20% do PM", () => {
    const assets: GovernanceAssetInput[] = [
      makeAsset({
        id: "op1",
        ticker: "VALE3",
        score: 9, // Nota alta
        averageCost: 80,
        currentPrice: 60, // 25% de desconto frente ao PM (60 vs 80)
      }),
    ];

    const result = generateAssetGovernanceInsights({ assets, referenceDate: refDate });

    expect(result.summary.opportunityCount).toBe(1);
    const opInsight = result.insights.find((i) => i.kind === "discount_opportunity");
    expect(opInsight).toBeDefined();
    expect(opInsight?.discountPct).toBe(25);
    expect(opInsight?.severity).toBe("positive");
  });

  it("Gatilho 4: detecta risco de hiperconcentração em ativo de nota baixa (≤ 4 e > 5% da carteira)", () => {
    const assets: GovernanceAssetInput[] = [
      makeAsset({
        id: "r1",
        ticker: "RISK3",
        score: 3, // Nota baixa
        currentValueBRL: 15000, // 15% do total de 100k
      }),
      makeAsset({
        id: "ok1",
        ticker: "SAFE3",
        score: 9,
        currentValueBRL: 85000,
      }),
    ];

    const result = generateAssetGovernanceInsights({
      assets,
      totalPortfolioBRL: 100000,
      referenceDate: refDate,
    });

    expect(result.summary.lowScoreRiskCount).toBe(1);
    const riskInsight = result.insights.find((i) => i.kind === "low_score_overweight");
    expect(riskInsight).toBeDefined();
    expect(riskInsight?.ticker).toBe("RISK3");
    expect(riskInsight?.allocationPct).toBe(15);
    expect(riskInsight?.severity).toBe("critical");
  });

  it("Consolidação Anti-Fadiga: agrupa múltiplos alertas de revisão em 1 card consolidado (Salvaguarda S6)", () => {
    const assets: GovernanceAssetInput[] = [
      makeAsset({ id: "a1", ticker: "ITUB4", last_reviewed_at: "2026-01-01T00:00:00Z" }),
      makeAsset({ id: "a2", ticker: "BBDC4", last_reviewed_at: "2026-01-01T00:00:00Z" }),
      makeAsset({ id: "a3", ticker: "SANB11", last_reviewed_at: "2026-01-01T00:00:00Z" }),
    ];

    const result = generateAssetGovernanceInsights({ assets, referenceDate: refDate });

    expect(result.summary.overdueCount).toBe(3);
    expect(result.consolidatedReviewAlert).toBeDefined();
    expect(result.consolidatedReviewAlert?.title).toBe("3 ativos com revisão pendente");
    expect(result.consolidatedReviewAlert?.id).toBe("gov-consolidated-overdue");
  });

  it("retorna zero insights para carteira saudável e em dia", () => {
    const assets: GovernanceAssetInput[] = [
      makeAsset({
        id: "a1",
        ticker: "WEGE3",
        score: 10,
        averageCost: 40,
        currentPrice: 42,
        currentValueBRL: 50000,
        last_reviewed_at: "2026-11-01T00:00:00Z",
      }),
    ];

    const result = generateAssetGovernanceInsights({
      assets,
      totalPortfolioBRL: 50000,
      referenceDate: refDate,
    });

    expect(result.insights).toHaveLength(0);
    expect(result.summary.totalInsights).toBe(0);
    expect(result.consolidatedReviewAlert).toBeNull();
    expect(result.consolidatedUpcomingAlert).toBeNull();
    expect(result.consolidatedUnscoredAlert).toBeNull();
  });

  it("detecta revisões próximas do vencimento (≤ 30 dias restantes) e consolida com tickers", () => {
    const assets: GovernanceAssetInput[] = [
      makeAsset({
        id: "u1",
        ticker: "ITUB4",
        last_reviewed_at: "2026-06-05T12:00:00Z", // ~165 dias atrás, faltam 15 dias para 180
        review_frequency_months: 6,
      }),
      makeAsset({
        id: "u2",
        ticker: "WEGE3",
        last_reviewed_at: "2026-05-26T12:00:00Z", // ~175 dias atrás, faltam 5 dias para 180
        review_frequency_months: 6,
      }),
    ];

    const result = generateAssetGovernanceInsights({ assets, referenceDate: refDate });

    expect(result.summary.overdueCount).toBe(0);
    expect(result.summary.upcomingReviewCount).toBe(2);
    expect(result.consolidatedUpcomingAlert).toBeDefined();
    expect(result.consolidatedUpcomingAlert?.tickers).toEqual(["WEGE3", "ITUB4"]);
    expect(result.consolidatedUpcomingAlert?.daysUntilReview).toBe(5);
  });

  it("detecta ativos sem nota definida e agrupa em consolidatedUnscoredAlert", () => {
    const assets: GovernanceAssetInput[] = [
      makeAsset({ id: "n1", ticker: "PETR4", score: null, last_reviewed_at: "2026-11-01T00:00:00Z" }),
      makeAsset({ id: "n2", ticker: "VALE3", score: null, last_reviewed_at: "2026-11-01T00:00:00Z" }),
    ];

    const result = generateAssetGovernanceInsights({ assets, referenceDate: refDate });

    expect(result.summary.unscoredCount).toBe(2);
    expect(result.consolidatedUnscoredAlert).toBeDefined();
    expect(result.consolidatedUnscoredAlert?.tickers).toEqual(["PETR4", "VALE3"]);
  });
});
