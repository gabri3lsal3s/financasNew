import { describe, expect, it } from "vitest";
import { filterPeriodRedemptions } from "./period-redemptions";

describe("filterPeriodRedemptions — Resgates e Vendas no Período", () => {
  const assets = [
    {
      id: "asset-cdb",
      ticker: "CDB-FACTA",
      name: "CDB Facta Financeira",
      asset_class: "Renda Fixa",
      sector: "Pós-fixado (Selic / CDI)",
      currency: "BRL",
      average_price: 0,
      fixed_income_metadata: {
        base_date: "2026-09-02",
        rate_type: "cdi" as const,
        base_value: 0,
        rate_value: 120,
        is_tax_exempt: false,
        maturity_date: "2026-09-02",
        initial_investment_date: "2026-02-27",
        initial_investment_value: 1236.27,
      },
    },
    {
      id: "asset-petr",
      ticker: "PETR4",
      name: "Petrobras PN",
      asset_class: "Ações",
      sector: "Petróleo e Gás",
      currency: "BRL",
      average_price: 35.0,
    },
  ];

  const transactions = [
    {
      id: "tx-1",
      asset_id: "asset-cdb",
      type: "sell",
      date: "2026-09-02",
      quantity: 1,
      price: 1342.31,
      total: 1342.31,
    },
    {
      id: "tx-2",
      asset_id: "asset-petr",
      type: "sell",
      date: "2026-08-15",
      quantity: 10,
      price: 40.0,
      total: 400.0,
    },
    {
      id: "tx-3",
      asset_id: "asset-petr",
      type: "buy",
      date: "2026-09-01",
      quantity: 50,
      price: 35.0,
      total: 1750.0,
    },
  ];

  it("filtra apenas os resgates do mês selecionado (2026-09)", () => {
    const result = filterPeriodRedemptions({
      transactions,
      assets,
      mode: "month",
      month: "2026-09",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "tx-1",
      assetId: "asset-cdb",
      ticker: "CDB-FACTA",
      assetClass: "Renda Fixa",
      redemptionDate: "2026-09-02",
      quantity: 1,
      appliedCostBRL: 1236.27,
      redeemedValueBRL: 1342.31,
      realizedPnlBRL: 106.04,
      finalReturnPct: 8.58,
    });
  });

  it("filtra resgates do mês anterior (2026-08)", () => {
    const result = filterPeriodRedemptions({
      transactions,
      assets,
      mode: "month",
      month: "2026-08",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "tx-2",
      ticker: "PETR4",
      assetClass: "Ações",
      redemptionDate: "2026-08-15",
      appliedCostBRL: 350.0,
      redeemedValueBRL: 400.0,
      realizedPnlBRL: 50.0,
      finalReturnPct: 14.29,
    });
  });

  it("retorna array vazio quando não houver vendas no período", () => {
    const result = filterPeriodRedemptions({
      transactions,
      assets,
      mode: "month",
      month: "2026-07",
    });

    expect(result).toEqual([]);
  });

  it("filtra por ano quando o modo for year", () => {
    const result = filterPeriodRedemptions({
      transactions,
      assets,
      mode: "year",
      year: 2026,
    });

    expect(result).toHaveLength(2);
    // Ordenado decrescente pela data (02/09 antes de 15/08)
    expect(result[0]?.redemptionDate).toBe("2026-09-02");
    expect(result[1]?.redemptionDate).toBe("2026-08-15");
  });
});
