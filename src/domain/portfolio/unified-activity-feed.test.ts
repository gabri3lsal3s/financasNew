import { describe, expect, it } from "vitest";
import type {
  PortfolioAsset,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioTransaction,
} from "@/types";
import {
  buildUnifiedActivityTimeline,
  computeActivityMonthStats,
  filterActivityItems,
  mapActivitiesToExportRows,
} from "./unified-activity-feed";

describe("unified-activity-feed", () => {
  const assets: PortfolioAsset[] = [
    {
      id: "a-1",
      user_id: "u1",
      ticker: "PETR4",
      asset_class: "Ações",
      quantity: 100,
      average_price: 35,
      currency: "BRL",
    },
    {
      id: "a-cash",
      user_id: "u1",
      ticker: "CAIXA",
      asset_class: "Caixa",
      quantity: 1000,
      average_price: 1,
      currency: "BRL",
    },
  ];
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const txs: PortfolioTransaction[] = [
    { id: "tx-1", user_id: "u1", asset_id: "a-1", type: "buy", date: "2026-08-05", quantity: 10, price: 38, total: 380 },
    { id: "tx-cash", user_id: "u1", asset_id: "a-cash", type: "buy", date: "2026-08-06", quantity: 500, price: 1, total: 500 },
  ];
  const contributions: PortfolioContribution[] = [
    { id: "c-1", user_id: "u1", asset_id: "a-1", date: "2026-08-05", amount: 380, notes: "Aporte PETR4" },
    { id: "c-2", user_id: "u1", asset_id: "a-cash", date: "2026-08-07", amount: 250, notes: "Depósito" },
  ];
  const dividends: PortfolioDividend[] = [
    { id: "d-1", user_id: "u1", asset_id: "a-1", date: "2026-08-20", amount: 50 },
  ];

  it("unifica timeline ignorando pseudo-compras de CAIXA e deduplicando aportes cobertos", () => {
    const list = buildUnifiedActivityTimeline({
      transactions: txs,
      contributions,
      dividends,
      assetMap,
    });

    expect(list).toHaveLength(3);
    expect(list.some((i) => i.id === "tx-cash")).toBe(false);
    expect(list.some((i) => i.id === "contrib-c-1")).toBe(false);
    expect(list.some((i) => i.id === "contrib-c-2")).toBe(true);
  });

  it("computa estatísticas do mês, filtra por tipo e mapeia CSV corretamente", () => {
    const list = buildUnifiedActivityTimeline({
      transactions: txs,
      contributions,
      dividends,
      assetMap,
    });
    const stats = computeActivityMonthStats({
      monthActivities: list,
      contributions,
      month: "2026-08",
      assetMap,
      usdRate: 5.25,
    });

    expect(stats.boughtCents).toBe(38_000);
    expect(stats.dividendsCents).toBe(5_000);
    expect(stats.contributionsCents).toBe(63_000);

    const onlyContribs = filterActivityItems({
      monthActivities: list,
      filterType: "contribution",
      selectedClass: "all",
      selectedSector: "all",
      search: "",
    });
    expect(onlyContribs).toHaveLength(2);

    const exportRows = mapActivitiesToExportRows(list);
    expect(exportRows.some((r) => r.type === "Aporte em Caixa")).toBe(true);
    expect(exportRows.some((r) => r.type === "Compra")).toBe(true);
  });
});
