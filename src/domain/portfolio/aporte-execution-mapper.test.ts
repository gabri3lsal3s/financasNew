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
    expect(vm.routes[0]?.reasonKind).toBeDefined();
    expect(vm.routes[0]?.reasonLabel).toBeDefined();
  });

  it("detecta conflito de qualidade vs alocação para ativo com nota baixa", () => {
    const lowScoreAssets: PortfolioAsset[] = [
      {
        ...rawAssets[0]!,
        score: 3,
      },
    ];
    const vm = buildAporteSimulationViewModel({
      totalPurchasingCents: 50_000,
      positionRows: [baseRows[0]!],
      rawAssets: lowScoreAssets,
      rawClassTargets: [{ id: "c1", user_id: "u1", name: "Ações", group_type: "class", target_percentage: 100 }],
      rawSectorTargets: [],
    });

    expect(vm.routes[0]?.hasQualityConflict).toBe(true);
    expect(vm.routes[0]?.qualityConflictDetail).toContain("Nota de convicção baixa (3/10)");
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
    expect(payload.batchId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("respeita batchId explícito e aplica overrides inline de quantidade e preço", () => {
    const customBatchId = "11111111-2222-3333-4444-555555555555";
    const payload = buildBatchAportePayload({
      items: [
        { assetId: "a1", ticker: "PETR4", quantity: 10, priceBRL: 40, allocatedBRL: 400 },
        { assetId: "a2", ticker: "VOO", quantity: 1, priceBRL: 500 * FALLBACK_USD_RATE, allocatedBRL: 500 * FALLBACK_USD_RATE },
      ],
      positionRows: baseRows,
      cashSelectedCents: 0,
      positionCashBRL: 1000,
      date: "2026-08-15",
      batchId: customBatchId,
      quantityOverrides: { a1: 15, a2: 0 },
      priceOverrides: { a1: 42 },
    });

    expect(payload.batchId).toBe(customBatchId);
    // a2 com quantidade 0 foi excluído do envio da ordem
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toEqual({
      asset_id: "a1",
      quantity: 15,
      price: 42,
      total: 630,
    });
    expect(payload.totalAmount).toBe(630);
    expect(payload.cashUsed).toBeUndefined();
    expect(payload.notes).toContain("Aporte inteligente (1 ativos)");
  });

  it("não debita Caixa quando cashSelectedCents é 0, mesmo com valor alto", () => {
    const payload = buildBatchAportePayload({
      items: [
        { assetId: "a1", ticker: "PETR4", quantity: 10, priceBRL: 40, allocatedBRL: 400 },
      ],
      positionRows: baseRows,
      cashSelectedCents: 0,
      positionCashBRL: 5000,
      date: "2026-08-15",
      quantityOverrides: { a1: 50 },
    });

    expect(payload.totalAmount).toBe(2000);
    expect(payload.cashUsed).toBeUndefined();
  });

  it("propaga metadados de teto prudencial e headroom para as rotas simuladas", () => {
    const vm = buildAporteSimulationViewModel({
      totalPurchasingCents: 500_000,
      positionRows: baseRows,
      rawAssets,
      rawClassTargets: classTargets,
      rawSectorTargets: [],
      policy: {
        defaultAssetCeilingPct: 15,
      },
    });

    expect(vm.routes.length).toBeGreaterThan(0);
    for (const route of vm.routes) {
      expect(route.headroomBRL).toBeDefined();
      expect(typeof route.headroomBRL).toBe("number");
      expect(typeof route.isConstrainedByCeiling).toBe("boolean");
    }
    expect(Array.isArray(vm.pausedAssets)).toBe(true);
    expect(Array.isArray(vm.overflowEvents)).toBe(true);
  });

  it("pausa ativo com nota <= 5 quando há tese avaliada (last_reviewed_at) e alternativa melhor na classe", () => {
    const assetsWithReview: PortfolioAsset[] = [
      {
        id: "klbn4",
        user_id: "u1",
        ticker: "KLBN4",
        asset_class: "Ações",
        sector: "Papel e Celulose",
        quantity: 100,
        average_price: 4,
        currency: "BRL",
        score: 5, // Nota 5 (limiar de corte)
        allocation_status: "active",
        last_reviewed_at: "2026-01-10",
        score_criteria: { dividendo: true },
      },
      {
        id: "vale3",
        user_id: "u1",
        ticker: "VALE3",
        asset_class: "Ações",
        sector: "Mineração",
        quantity: 50,
        average_price: 60,
        currency: "BRL",
        score: 8, // Alternativa melhor na classe
        allocation_status: "active",
        last_reviewed_at: "2026-02-01",
      },
    ];

    const rows: AportePositionRowInput[] = [
      {
        assetId: "klbn4",
        ticker: "KLBN4",
        assetClass: "Ações",
        sector: "Papel e Celulose",
        currency: "BRL",
        priceBRL: 4.5,
        usdRate: 1,
        valueBRL: 450,
        isCash: false,
      },
      {
        assetId: "vale3",
        ticker: "VALE3",
        assetClass: "Ações",
        sector: "Mineração",
        currency: "BRL",
        priceBRL: 60,
        usdRate: 1,
        valueBRL: 3000,
        isCash: false,
      },
    ];

    const vm = buildAporteSimulationViewModel({
      totalPurchasingCents: 65_143, // R$ 651,43
      positionRows: rows,
      rawAssets: assetsWithReview,
      rawClassTargets: [{ id: "c1", user_id: "u1", name: "Ações", group_type: "class", target_percentage: 100 }],
      rawSectorTargets: [],
    });

    // KLBN4 com nota 5 deve estar pausado em pausedAssets e NÃO receber alocação nas rotas ativas
    const pausedKlbn = vm.pausedAssets.find((p) => p.ticker === "KLBN4");
    expect(pausedKlbn).toBeDefined();
    expect(pausedKlbn?.reason).toBe("quality_lock");

    const klbnRoute = vm.routes.find((r) => r.ticker === "KLBN4");
    expect(klbnRoute).toBeUndefined();
  });

  it("calcula diversificationImpact projetando Nef e diluição do maior ativo", () => {
    const vm = buildAporteSimulationViewModel({
      totalPurchasingCents: 100_000,
      positionRows: baseRows,
      rawAssets,
      rawClassTargets: classTargets,
      rawSectorTargets: [],
    });

    expect(vm.diversificationImpact).not.toBeNull();
    expect(vm.diversificationImpact?.currentNef).toBeGreaterThan(0);
    expect(vm.diversificationImpact?.projectedNef).toBeGreaterThan(0);
    expect(typeof vm.diversificationImpact?.currentTopAssetSharePct).toBe("number");
    expect(typeof vm.diversificationImpact?.projectedTopAssetSharePct).toBe("number");
  });
});
