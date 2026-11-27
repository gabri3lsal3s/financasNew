import { describe, expect, it } from "vitest";
import type { PortfolioAsset } from "@/types";
import { resolveCarouselPortfolioValuation } from "./carousel-valuation";

const makeAsset = (overrides: Partial<PortfolioAsset>): PortfolioAsset => ({
  id: "a-1",
  user_id: "u-1",
  ticker: "PETR4",
  asset_class: "Ações",
  sector: "Petróleo",
  currency: "BRL",
  quantity: 10,
  average_price: 20,
  notes: null,
  score: 8,
  allocation_status: "active",
  last_reviewed_at: null,
  review_frequency_months: 6,
  thesis_summary: null,
  score_criteria: null,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("resolveCarouselPortfolioValuation", () => {
  it("prioriza valueBRL de positionRows sobre custo e inclui caixa positivo uma única vez", () => {
    const acaoA = makeAsset({ id: "a-1", ticker: "PETR4", quantity: 10, average_price: 20 }); // custo 200
    const acaoB = makeAsset({ id: "a-2", ticker: "VALE3", quantity: 10, average_price: 10 }); // custo 100
    const caixaAsset = makeAsset({
      id: "a-cash",
      ticker: "CAIXA",
      asset_class: "Caixa",
      quantity: 500,
      average_price: 1,
    });

    const result = resolveCarouselPortfolioValuation([acaoA, acaoB, caixaAsset], {
      positionRows: [
        { assetId: "a-1", ticker: "PETR4", assetClass: "Ações", valueBRL: 400, isCash: false },
        { assetId: "a-2", ticker: "VALE3", assetClass: "Ações", valueBRL: 100, isCash: false },
        { assetId: "a-cash", ticker: "CAIXA", assetClass: "Caixa", valueBRL: 500, isCash: true },
      ],
      cashBRL: 500,
    });

    expect(result.investedTotalBRL).toBe(500);
    expect(result.cashBRL).toBe(500);
    expect(result.patrimonyTotalBRL).toBe(1000);
    expect(result.cashIncludedInGlobal).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.valueBRL).toBe(400);
  });

  it("aceita renda fixa/total_value com PM zero quando há valueBRL válido e preserva zero legítimo", () => {
    const rf = makeAsset({
      id: "rf-1",
      ticker: "CDB-ITAU",
      asset_class: "Renda Fixa",
      quantity: 1,
      average_price: 0,
    });
    const zeroPos = makeAsset({
      id: "a-zero",
      ticker: "ZERO3",
      quantity: 10,
      average_price: 10,
    });

    const result = resolveCarouselPortfolioValuation([rf, zeroPos], {
      positionRows: [
        { assetId: "rf-1", ticker: "CDB-ITAU", assetClass: "Renda Fixa", valueBRL: 15000, isCash: false },
        { assetId: "a-zero", ticker: "ZERO3", assetClass: "Ações", valueBRL: 0, isCash: false },
      ],
    });

    expect(result.items.find((i) => i.asset.id === "rf-1")?.valueBRL).toBe(15000);
    expect(result.items.find((i) => i.asset.id === "a-zero")?.valueBRL).toBe(0);
    expect(result.investedTotalBRL).toBe(15000);
  });

  it("não inclui caixa negativo no denominador global", () => {
    const acao = makeAsset({ id: "a-1", ticker: "PETR4", quantity: 10, average_price: 50 });
    const result = resolveCarouselPortfolioValuation([acao], {
      positionRows: [{ assetId: "a-1", ticker: "PETR4", assetClass: "Ações", valueBRL: 500, isCash: false }],
      cashBRL: -100,
    });

    expect(result.cashIncludedInGlobal).toBe(false);
    expect(result.patrimonyTotalBRL).toBe(500);
  });
});
