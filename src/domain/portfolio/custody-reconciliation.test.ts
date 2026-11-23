import { describe, expect, it } from "vitest";
import { calculateCustodyReconciliation } from "./custody-reconciliation";

describe("domain/portfolio/custody-reconciliation", () => {
  it("mantém ETFs B3 (IVVB11/WRLD11) na Custódia Brasil BRL e consolida ativos USD no Exterior", () => {
    const summary = calculateCustodyReconciliation({
      rows: [
        {
          ticker: "IVVB11",
          currency: "BRL",
          quantity: 10,
          valueBRL: 3450.12,
          priceQuote: 345.012,
        },
        {
          ticker: "PETR4",
          currency: "BRL",
          quantity: 100,
          valueBRL: 3820.0,
          priceQuote: 38.2,
        },
        {
          ticker: "AAPL",
          currency: "USD",
          quantity: 5,
          valueBRL: 6423.75,
          priceQuote: 225.0,
          usdRate: 5.71,
        },
        {
          ticker: "CAIXA",
          currency: "BRL",
          quantity: 1000,
          valueBRL: 1000.0,
          isCash: true,
        },
      ],
      totalBRL: 14693.87,
      fxMetadata: {
        rate: 5.71,
        source: "api",
        provider: "bcb_ptax",
        fxRateAt: "2026-06-15T21:00:00.000Z",
        fetchedAt: "2026-06-15T21:05:00.000Z",
        isFallback: false,
      },
    });

    expect(summary.hasForeignCustody).toBe(true);
    expect(summary.custodyForeignAssetsCount).toBe(1);
    expect(summary.custodyBrazilAssetsCount).toBe(3); // IVVB11 + PETR4 + CAIXA
    expect(summary.custodyForeignUSDCents).toBe(112500); // US$ 1,125.00
    expect(summary.custodyForeignBRLCents).toBe(642375); // R$ 6.423,75
    expect(summary.custodyBrazilCents).toBe(827012); // R$ 8.270,12
    expect(summary.closingPatrimonyCents).toBe(1469387);
    expect(summary.custodyBrazilCents + summary.custodyForeignBRLCents).toBe(
      summary.closingPatrimonyCents,
    );
    expect(summary.fxRateUsed).toBe(5.71);
    expect(summary.fxSourceLabel).toBe("PTAX Oficial BCB");
    expect(summary.roundingAdjustmentCents).toBe(0);
  });

  it("garante invariante exato em centavos e registra ajuste quando há diferença de arredondamento", () => {
    const summary = calculateCustodyReconciliation({
      rows: [
        {
          ticker: "VOO",
          currency: "USD",
          quantity: 3.3333,
          valueBRL: 9517.23,
          priceQuote: 500.1234,
        },
        {
          ticker: "PETR4",
          currency: "BRL",
          quantity: 50,
          valueBRL: 1925.4,
        },
      ],
      cashBRL: 500.0,
      totalBRL: 11942.65, // 2 centavos de diferença de arredondamento sintético
      fxMetadata: {
        rate: 5.71,
        source: "api",
        provider: "yahoo",
        fxRateAt: "2026-06-15T21:00:00.000Z",
        fetchedAt: "2026-06-15T21:05:00.000Z",
        isFallback: false,
      },
    });

    expect(summary.closingPatrimonyCents).toBe(1194265);
    expect(summary.custodyBrazilCents + summary.custodyForeignBRLCents).toBe(
      summary.closingPatrimonyCents,
    );
    expect(summary.roundingAdjustmentCents).toBe(2);
    expect(summary.fxSourceLabel).toBe("Yahoo Finance");
  });

  it("trata carteira 100% Brasil sem ativos USD mantendo hasForeignCustody = false", () => {
    const summary = calculateCustodyReconciliation({
      rows: [
        { ticker: "BOVA11", currency: "BRL", quantity: 10, valueBRL: 1300 },
        { ticker: "IVVB11", currency: "BRL", quantity: 10, valueBRL: 3400 },
      ],
      totalBRL: 4700,
    });

    expect(summary.hasForeignCustody).toBe(false);
    expect(summary.custodyForeignAssetsCount).toBe(0);
    expect(summary.custodyForeignUSDCents).toBe(0);
    expect(summary.custodyForeignBRLCents).toBe(0);
    expect(summary.custodyBrazilCents).toBe(470000);
    expect(summary.custodyBrazilPct).toBe(100);
  });
});
