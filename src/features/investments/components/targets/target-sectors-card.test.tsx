import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TargetSectorsCard } from "./target-sectors-card";
import type { PortfolioPositionRow } from "@/state";

describe("TargetSectorsCard — Isolamento Estrito de Setores e Zero Duplicação", () => {
  it("não duplica ativos em 'Imobiliário / Papel e CRI' quando o ativo possui outro setor explicitamente preenchido", () => {
    // Cenário idêntico ao do usuário:
    // 2 ativos de Papel e CRI, 5 de Logística e 4 de Renda Urbana (todos FIIs com final 11)
    const positionRows: PortfolioPositionRow[] = [
      // 2 ativos de Papel e CRI reais
      {
        assetId: "p1",
        ticker: "MXRF11",
        assetClass: "FIIs",
        sector: "Imobiliário / Papel e CRI",
        valueBRL: 1000,
        currency: "BRL",
        quantity: 100,
        averageCost: 10,
        totalCost: 1000,
        totalCostBRL: 1000,
        averageCostBRL: 10,
        dividends: 0,
        priceQuote: 10,
        priceBRL: 10,
        usdRate: 1,
        source: "manual",
        pct: 10,
        unrealizedPnl: 0,
        unrealizedPct: 0,
        totalReturnPnl: 0,
        totalReturnPct: 0,
        isCash: false,
        pricingMode: "unit_price",
      },
      {
        assetId: "p2",
        ticker: "KNCR11",
        assetClass: "FIIs",
        sector: "Imobiliário / Papel e CRI",
        valueBRL: 1000,
        currency: "BRL",
        quantity: 10,
        averageCost: 100,
        totalCost: 1000,
        totalCostBRL: 1000,
        averageCostBRL: 100,
        dividends: 0,
        priceQuote: 100,
        priceBRL: 100,
        usdRate: 1,
        source: "manual",
        pct: 10,
        unrealizedPnl: 0,
        unrealizedPct: 0,
        totalReturnPnl: 0,
        totalReturnPct: 0,
        isCash: false,
        pricingMode: "unit_price",
      },
      // 5 ativos de Logística (terminados em 11)
      ...["HGLG11", "BTLG11", "XPLG11", "VILG11", "ALZR11"].map((ticker, idx) => ({
        assetId: `log_${idx}`,
        ticker,
        assetClass: "FIIs",
        sector: "Imobiliário / Logística",
        valueBRL: 1000,
        currency: "BRL" as const,
        quantity: 10,
        averageCost: 100,
        totalCost: 1000,
        totalCostBRL: 1000,
        averageCostBRL: 100,
        dividends: 0,
        priceQuote: 100,
        priceBRL: 100,
        usdRate: 1,
        source: "manual" as const,
        pct: 10,
        unrealizedPnl: 0,
        unrealizedPct: 0,
        totalReturnPnl: 0,
        totalReturnPct: 0,
        isCash: false,
        pricingMode: "unit_price" as const,
      })),
      // 4 ativos de Renda Urbana (terminados em 11)
      ...["HGRU11", "TGAR11", "TRXF11", "GARE11"].map((ticker, idx) => ({
        assetId: `urb_${idx}`,
        ticker,
        assetClass: "FIIs",
        sector: "Imobiliário / Renda Urbana",
        valueBRL: 1000,
        currency: "BRL" as const,
        quantity: 10,
        averageCost: 100,
        totalCost: 1000,
        totalCostBRL: 1000,
        averageCostBRL: 100,
        dividends: 0,
        priceQuote: 100,
        priceBRL: 100,
        usdRate: 1,
        source: "manual" as const,
        pct: 10,
        unrealizedPnl: 0,
        unrealizedPct: 0,
        totalReturnPnl: 0,
        totalReturnPct: 0,
        isCash: false,
        pricingMode: "unit_price" as const,
      })),
    ];

    const availableSectors = [
      "Imobiliário / Papel e CRI",
      "Imobiliário / Logística",
      "Imobiliário / Renda Urbana",
    ];

    render(
      <TargetSectorsCard
        classes={["FIIs"]}
        activeSectorClass="FIIs"
        availableSectors={availableSectors}
        storedSectorTargets={new Map()}
        positionRows={positionRows}
        sectorTargetOf={() => 33.3}
        sectorSum={{ sum: 100, error: null }}
        onSelectSectorClass={vi.fn()}
        onDistributeSectorsEqually={vi.fn()}
        onResetSectorsZero={vi.fn()}
        onSectorTargetChange={vi.fn()}
      />,
    );

    // Papel e CRI deve ter EXATAMENTE 2 ativos (e NUNCA 7)
    expect(screen.getByText("2 ativo(s)")).toBeInTheDocument();

    // Logística deve ter EXATAMENTE 5 ativos
    expect(screen.getByText("5 ativo(s)")).toBeInTheDocument();

    // Renda Urbana deve ter EXATAMENTE 4 ativos
    expect(screen.getByText("4 ativo(s)")).toBeInTheDocument();

    // 2 ativos de Papel e CRI em 11 ativos totais (R$ 2.000 de R$ 11.000) = 18,2% da classe (e NUNCA 56,6%)
    expect(screen.getByText("18,2%")).toBeInTheDocument();
  });
});
