import { describe, expect, it } from "vitest";
import type { PortfolioAsset } from "@/types";
import { evaluatePortfolioStructuralRisk } from "./portfolio-risk-policy";

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

describe("evaluatePortfolioStructuralRisk (Fase 2A)", () => {
  it("escolhe o maior violador em ordem invertida e emite contagem +N sem depender de break", () => {
    const a1 = makeAsset({ id: "a-1", ticker: "ITUB4", quantity: 10, average_price: 10 }); // 100 -> 20%
    const a2 = makeAsset({ id: "a-2", ticker: "VALE3", quantity: 10, average_price: 10 }); // 100 -> 45%
    const a3 = makeAsset({ id: "a-3", ticker: "WEGE3", quantity: 10, average_price: 10 }); // 100 -> 35%

    const alerts = evaluatePortfolioStructuralRisk([a1, a2, a3], undefined, {
      positionRows: [
        { assetId: "a-1", ticker: "ITUB4", assetClass: "Ações", valueBRL: 200, isCash: false },
        { assetId: "a-2", ticker: "VALE3", assetClass: "Ações", valueBRL: 450, isCash: false },
        { assetId: "a-3", ticker: "WEGE3", assetClass: "Ações", valueBRL: 350, isCash: false },
      ],
    });

    const single = alerts.find((a) => a.type === "single_asset_concentration");
    expect(single).toBeDefined();
    expect(single?.metadata?.ticker).toBe("VALE3");
    expect(single?.metadata?.extraCount).toBe(2);
    expect(single?.description).toContain("45,0%");
  });

  it("usa tetos de policy (15%/40%) e inclui caixa positivo no denominador global", () => {
    const acaoA = makeAsset({ id: "a-1", ticker: "PETR4", quantity: 10, average_price: 20 });
    const acaoB = makeAsset({ id: "a-2", ticker: "VALE3", quantity: 10, average_price: 10 });

    const alerts = evaluatePortfolioStructuralRisk([acaoA, acaoB], undefined, {
      positionRows: [
        { assetId: "a-1", ticker: "PETR4", assetClass: "Ações", valueBRL: 400, isCash: false },
        { assetId: "a-2", ticker: "VALE3", assetClass: "Ações", valueBRL: 100, isCash: false },
      ],
      cashBRL: 500,
    });

    const single = alerts.find((a) => a.type === "single_asset_concentration");
    expect(single?.metadata?.weightPct).toBeCloseTo(40, 2);
    expect(single?.metadata?.thresholdPct).toBe(15);
  });

  it("detecta emissor privado por teto global e por FGC absoluto mesmo com PM zero", () => {
    const cdb = makeAsset({
      id: "rf-1",
      ticker: "CDB-MASTER",
      asset_class: "Renda Fixa",
      quantity: 1,
      average_price: 0,
    });
    const tesouro = makeAsset({
      id: "rf-2",
      ticker: "TESOURO-SELIC",
      asset_class: "Renda Fixa",
      quantity: 1,
      average_price: 0,
    });

    const alerts = evaluatePortfolioStructuralRisk([cdb, tesouro], undefined, {
      positionRows: [
        { assetId: "rf-1", ticker: "CDB-MASTER", assetClass: "Renda Fixa", valueBRL: 260_000, isCash: false },
        { assetId: "rf-2", ticker: "TESOURO-SELIC", assetClass: "Renda Fixa", valueBRL: 1_000_000, isCash: false },
      ],
    });

    const issuerAlert = alerts.find((a) => a.type === "private_issuer_fgc");
    expect(issuerAlert).toBeDefined();
    expect(issuerAlert?.metadata?.exceedsFgc).toBe(true);
    expect(issuerAlert?.description.toLowerCase()).toContain("exposição estimada");
  });
});
