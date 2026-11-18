import { describe, expect, it } from "vitest";
import type { GroupTarget, PortfolioAsset } from "@/types";
import {
  buildAporteSimulationViewModel,
  buildBatchAportePayload,
  type AportePositionRowInput,
} from "./aporte-execution-mapper";
import { FALLBACK_USD_RATE } from "./valuation";

describe("aporte-execution-mapper", () => {
  const baseRows: AportePositionRowInput[] = [
    {
      assetId: "a1",
      ticker: "PETR4",
      assetClass: "Ações",
      sector: "Petróleo, Gás e Combustíveis",
      currency: "BRL",
      priceBRL: 40,
      usdRate: 1,
      valueBRL: 4000,
      isCash: false,
    },
    {
      assetId: "a2",
      ticker: "VOO",
      assetClass: "Internacional",
      sector: "S&P 500",
      currency: "USD",
      priceBRL: 500 * FALLBACK_USD_RATE,
      usdRate: FALLBACK_USD_RATE,
      valueBRL: 1000 * FALLBACK_USD_RATE,
      isCash: false,
    },
    {
      assetId: "cash-1",
      ticker: "CAIXA",
      assetClass: "Caixa",
      currency: "BRL",
      priceBRL: 1,
      usdRate: 1,
      valueBRL: 1000,
      isCash: true,
    },
  ];

  const rawAssets: PortfolioAsset[] = [
    {
      id: "a1",
      user_id: "u1",
      ticker: "PETR4",
      asset_class: "Ações",
      quantity: 100,
      average_price: 35,
      currency: "BRL",
      score: 8,
      allocation_status: "active",
    },
    {
      id: "a2",
      user_id: "u1",
      ticker: "VOO",
      asset_class: "Internacional",
      quantity: 2,
      average_price: 400,
      currency: "USD",
      score: 9,
      allocation_status: "active",
    },
  ];

  const classTargets: GroupTarget[] = [
    { id: "c1", user_id: "u1", name: "Ações", group_type: "class", target_percentage: 60 },
    { id: "c2", user_id: "u1", name: "Internacional", group_type: "class", target_percentage: 40 },
  ];

  it("filtra CAIXA e constrói rotas simuladas quando há poder de compra", () => {
    const vm = buildAporteSimulationViewModel({
      totalPurchasingCents: 100_000,
      positionRows: baseRows,
      rawAssets,
      rawClassTargets: classTargets,
      rawSectorTargets: [],
    });

    expect(vm.nonCashRows).toHaveLength(2);
    expect(vm.result).not.toBeNull();
    expect(vm.eligibleRoutes.length).toBeGreaterThanOrEqual(1);
    expect(vm.routes[0]?.rawScore).toBeDefined();
  });

  it("converte itens USD pela cotação do ativo e segrega cashUsed no lote", () => {
    const payload = buildBatchAportePayload({
      items: [
        { assetId: "a1", ticker: "PETR4", quantity: 10, priceBRL: 40, allocatedBRL: 400 },
        {
          assetId: "a2",
          ticker: "VOO",
          quantity: 1,
          priceBRL: 500 * FALLBACK_USD_RATE,
          allocatedBRL: 500 * FALLBACK_USD_RATE,
        },
      ],
      positionRows: baseRows,
      cashSelectedCents: 50_000,
      positionCashBRL: 1000,
      date: "2026-08-15",
    });

    expect(payload.items[0]).toEqual({ asset_id: "a1", quantity: 10, price: 40, total: 400 });
    expect(payload.items[1]).toEqual({ asset_id: "a2", quantity: 1, price: 500, total: 500 });
    expect(payload.cashUsed).toBe(500);
    expect(payload.notes).toContain("Aporte composto (2 ativos");
  });
});
