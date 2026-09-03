import { describe, expect, it } from "vitest";
import { filterPeriodRedemptions } from "./period-redemptions";

describe("filterPeriodRedemptions — Resgates e Vendas no Período com Dedução de IR", () => {
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
    {
      id: "asset-lci",
      ticker: "LCI-CAIXA",
      name: "LCI Caixa Imobiliária",
      asset_class: "Renda Fixa",
      sector: "Imobiliário / LCI",
      currency: "BRL",
      average_price: 0,
      fixed_income_metadata: {
        base_date: "2026-09-02",
        rate_type: "cdi" as const,
        base_value: 0,
        rate_value: 95,
        is_tax_exempt: true,
        maturity_date: "2026-09-02",
        initial_investment_date: "2026-01-10",
        initial_investment_value: 2000.0,
      },
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
    {
      id: "tx-4",
      asset_id: "asset-lci",
      type: "sell",
      date: "2026-09-02",
      quantity: 1,
      price: 2150.0,
      total: 2150.0,
    },
  ];

  it("calcula dedução de IR para CDB tributável (alíquota 20% após 187 dias)", () => {
    const result = filterPeriodRedemptions({
      transactions,
      assets,
      mode: "month",
      month: "2026-09",
    });

    const cdb = result.find((r) => r.ticker === "CDB-FACTA");
    expect(cdb).toBeDefined();
    expect(cdb).toMatchObject({
      id: "tx-1",
      assetId: "asset-cdb",
      ticker: "CDB-FACTA",
      assetClass: "Renda Fixa",
      redemptionDate: "2026-09-02",
      appliedCostBRL: 1236.27,
      grossRedeemedValueBRL: 1342.31,
      taxAmountBRL: 21.21,
      taxRatePct: 20,
      redeemedValueBRL: 1321.10,
      realizedPnlBRL: 84.83,
      finalReturnPct: 6.86,
    });
  });

  it("não deduz IR para ativo isento (LCI)", () => {
    const result = filterPeriodRedemptions({
      transactions,
      assets,
      mode: "month",
      month: "2026-09",
    });

    const lci = result.find((r) => r.ticker === "LCI-CAIXA");
    expect(lci).toBeDefined();
    expect(lci).toMatchObject({
      id: "tx-4",
      ticker: "LCI-CAIXA",
      appliedCostBRL: 2000.0,
      grossRedeemedValueBRL: 2150.0,
      taxAmountBRL: 0,
      taxRatePct: null,
      redeemedValueBRL: 2150.0,
      realizedPnlBRL: 150.0,
      finalReturnPct: 7.5,
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
      appliedCostBRL: 350.0,
      redeemedValueBRL: 400.0,
      realizedPnlBRL: 50.0,
      finalReturnPct: 14.29,
    });
  });
});
