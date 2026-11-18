import { describe, expect, it } from "vitest";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";
import { computeMonthlyDarfReport } from "./darf-reconstitution";

describe("computeMonthlyDarfReport", () => {
  const exitedAsset: PortfolioAsset = {
    id: "asset-exited",
    user_id: "user-1",
    ticker: "KNRI11",
    asset_class: "FIIs",
    quantity: 0,
    average_price: 0,
    currency: "BRL",
    notes: null,
  };

  it("reconstitui PM histórico com subscrições e desdobramentos para apurar DARF de FIIs", () => {
    const txs: PortfolioTransaction[] = [
      {
        id: "tx-sub",
        user_id: "user-1",
        asset_id: "asset-exited",
        type: "subscription",
        date: "2026-08-02",
        quantity: 10,
        price: 100,
        total: 1000,
      },
      {
        id: "tx-split",
        user_id: "user-1",
        asset_id: "asset-exited",
        type: "split",
        date: "2026-08-05",
        quantity: 2,
        price: 0,
        total: 0,
      },
      {
        id: "tx-sell",
        user_id: "user-1",
        asset_id: "asset-exited",
        type: "sell",
        date: "2026-08-10",
        quantity: 20,
        price: 70,
        total: 1400,
      },
    ];

    const report = computeMonthlyDarfReport({
      month: "2026-08",
      assets: [exitedAsset],
      transactions: txs,
    });

    expect(report.salesCount).toBe(1);
    expect(report.darf.shouldPayDarf).toBe(true);
    expect(report.darf.fiiGrossProfitCents).toBe(40_000);
    expect(report.darf.totalTaxDueCents).toBe(8_000);
  });

  it("retorna salesCount zerado e sem DARF quando não há vendas no mês", () => {
    const report = computeMonthlyDarfReport({
      month: "2026-08",
      assets: [exitedAsset],
      transactions: [],
    });

    expect(report.salesCount).toBe(0);
    expect(report.darf.shouldPayDarf).toBe(false);
    expect(report.darf.totalTaxDueCents).toBe(0);
  });
});
