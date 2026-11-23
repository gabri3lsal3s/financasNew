import { describe, expect, it } from "vitest";
import type { CanonicalFxMetadata } from "./canonical-types";
import {
  evaluateStaleQuoteGuard,
  formatFxSourceLabel,
  formatMarketReferenceTimestampBR,
} from "./stale-quote-guard";

const freshFx: CanonicalFxMetadata = {
  rate: 5.71,
  source: "api",
  provider: "bcb_ptax",
  fxRateAt: "2026-06-15T21:00:00.000Z",
  fetchedAt: "2026-06-15T21:05:00.000Z",
  isFallback: false,
};

describe("domain/portfolio/stale-quote-guard", () => {
  it("formata corretamente os rótulos reais de procedência do câmbio e timestamps BRT", () => {
    expect(formatFxSourceLabel(freshFx)).toBe("PTAX Oficial BCB");
    expect(formatFxSourceLabel({ ...freshFx, provider: "yahoo" })).toBe("Yahoo Finance");
    expect(formatFxSourceLabel({ ...freshFx, provider: "awesomeapi" })).toBe("AwesomeAPI");
    expect(formatFxSourceLabel({ ...freshFx, source: "manual", provider: "manual" })).toBe("Câmbio Manual");
    expect(formatFxSourceLabel({ ...freshFx, source: "closing_saved" })).toBe("Fechamento Salvo");
    expect(formatFxSourceLabel({ ...freshFx, source: "fallback", isFallback: true })).toBe(
      "Taxa Estimada (Fallback)",
    );
    expect(formatFxSourceLabel(null)).toBe("Taxa Estimada (Fallback)");

    expect(formatMarketReferenceTimestampBR("2026-06-15T20:30:00.000Z")).toBe("15/06/2026 17:30");
    expect(formatMarketReferenceTimestampBR(null)).toBeNull();
  });

  it("detecta missing_or_fallback, post_trade_stale (D+0) e stale_market_data (> 1 dia útil)", () => {
    const now = new Date("2026-06-16T15:00:00.000Z"); // Terça 12:00 BRT; último pregão fechado = segunda 2026-06-15

    const res = evaluateStaleQuoteGuard({
      now,
      fxMetadata: freshFx,
      rows: [
        {
          assetId: "a-d0",
          ticker: "PETR4",
          assetClass: "Ações",
          currency: "BRL",
          quantity: 100,
          priceBRL: 38.5,
          source: "api",
          isEstimate: false,
          marketPriceAt: "2026-06-15T20:55:00.000Z",
          provider: "yahoo",
        },
        {
          assetId: "a-miss",
          ticker: "WEGE3",
          assetClass: "Ações",
          currency: "BRL",
          quantity: 50,
          priceBRL: 42.0,
          source: "fallback",
          isEstimate: true,
        },
        {
          assetId: "a-stale",
          ticker: "VALE3",
          assetClass: "Ações",
          currency: "BRL",
          quantity: 40,
          priceBRL: 61.0,
          source: "api",
          isEstimate: false,
          marketPriceAt: "2026-06-11T20:55:00.000Z", // Quinta (2 dias úteis atrás: Fri 12 + Mon 15)
          provider: "yahoo",
        },
        {
          assetId: "a-fresh",
          ticker: "ITUB4",
          assetClass: "Ações",
          currency: "BRL",
          quantity: 80,
          priceBRL: 33.0,
          source: "api",
          isEstimate: false,
          marketPriceAt: "2026-06-15T20:55:00.000Z",
          provider: "yahoo",
        },
      ],
      transactions: [
        { asset_id: "a-d0", type: "buy", date: "2026-06-16" },
        { asset_id: "a-fresh", type: "buy", date: "2026-06-10" },
      ],
    });

    expect(res.postTradeStaleTickers).toEqual(["PETR4"]);
    expect(res.fallbackTickers).toEqual(["WEGE3"]);
    expect(res.staleMarketTickers).toEqual(["VALE3"]);
    expect(res.hasPostTradeStale).toBe(true);
    expect(res.hasFallback).toBe(true);
    expect(res.hasStaleMarketData).toBe(true);
    expect(res.hasAnyIssue).toBe(true);
    expect(res.fxWarning).toBeNull();
    expect(res.issueByTicker["PETR4"]?.kind).toBe("post_trade_stale");
    expect(res.issueByTicker["WEGE3"]?.kind).toBe("missing_or_fallback");
    expect(res.issueByTicker["VALE3"]?.kind).toBe("stale_market_data");
    expect(res.issueByTicker["ITUB4"]).toBeUndefined();
  });

  it("ignora ativos manuais, Caixa, Renda Fixa privada e Tesouro Direto", () => {
    const now = new Date("2026-06-16T15:00:00.000Z");
    const res = evaluateStaleQuoteGuard({
      now,
      fxMetadata: freshFx,
      rows: [
        {
          assetId: "c1",
          ticker: "CAIXA",
          assetClass: "Caixa",
          currency: "BRL",
          quantity: 5000,
          priceBRL: 1,
          source: "fallback",
          isEstimate: true,
          isCash: true,
          pricingMode: "cash",
        },
        {
          assetId: "rf1",
          ticker: "CDB-INTER",
          assetClass: "Renda Fixa",
          currency: "BRL",
          quantity: 1,
          priceBRL: 10000,
          source: "api",
          pricingMode: "total_value",
        },
        {
          assetId: "td1",
          ticker: "TESOURO SELIC 2029",
          assetClass: "Tesouro Direto",
          currency: "BRL",
          quantity: 2,
          priceBRL: 15000,
          source: "fallback",
          isEstimate: true,
        },
        {
          assetId: "m1",
          ticker: "MGLU3",
          assetClass: "Ações",
          currency: "BRL",
          quantity: 100,
          priceBRL: 10,
          source: "manual",
          marketPriceAt: "2026-05-01T10:00:00.000Z",
        },
      ],
      transactions: [{ asset_id: "m1", type: "buy", date: "2026-06-16" }],
    });

    expect(res.issues).toEqual([]);
    expect(res.hasAnyIssue).toBe(false);
    expect(res.fxWarning).toBeNull();
  });

  it("respeita calendário independente EUA vs Brasil em feriado nacional BR (20/11)", () => {
    // Sexta 2026-11-20 é Consciência Negra (B3 fechada, NYSE aberta);
    // Na segunda 2026-11-23 às 11h NY (16h UTC), último fechamento US foi 2026-11-20 e B3 foi 2026-11-19.
    const now = new Date("2026-11-23T16:00:00.000Z");

    const res = evaluateStaleQuoteGuard({
      now,
      fxMetadata: {
        rate: 5.75,
        source: "api",
        provider: "bcb_ptax",
        fxRateAt: "2026-11-19T20:00:00.000Z",
        fetchedAt: "2026-11-19T20:05:00.000Z",
        isFallback: false,
      },
      rows: [
        {
          assetId: "br1",
          ticker: "PETR4",
          assetClass: "Ações",
          currency: "BRL",
          quantity: 100,
          priceBRL: 38,
          source: "api",
          marketPriceAt: "2026-11-19T20:55:00.000Z", // Último pregão B3 válido
        },
        {
          assetId: "us1",
          ticker: "AAPL",
          assetClass: "Internacional",
          currency: "USD",
          quantity: 10,
          priceBRL: 1200,
          source: "api",
          marketPriceAt: "2026-11-19T20:55:00.000Z", // 1 pregão US atrás (2026-11-20), dentro do limite <= 1
        },
        {
          assetId: "us2",
          ticker: "MSFT",
          assetClass: "Internacional",
          currency: "USD",
          quantity: 10,
          priceBRL: 2000,
          source: "api",
          marketPriceAt: "2026-11-18T20:55:00.000Z", // 2 pregões US atrás (19 e 20) -> stale!
        },
      ],
    });

    expect(res.staleMarketTickers).toEqual(["MSFT"]);
    expect(res.fxWarning).toBeNull();
  });

  it("emite fxWarning para custódia USD com fallback ou PTAX defasada e silencia para carteira apenas BRL", () => {
    const now = new Date("2026-06-16T15:00:00.000Z");

    const brlOnly = evaluateStaleQuoteGuard({
      now,
      fxMetadata: { rate: 5.25, source: "fallback", provider: null, fxRateAt: null, fetchedAt: null, isFallback: true },
      rows: [
        {
          ticker: "PETR4",
          currency: "BRL",
          quantity: 10,
          priceBRL: 38,
          source: "api",
          marketPriceAt: "2026-06-15T20:55:00.000Z",
        },
      ],
    });
    expect(brlOnly.fxWarning).toBeNull();

    const usdWithFallback = evaluateStaleQuoteGuard({
      now,
      fxMetadata: { rate: 5.25, source: "fallback", provider: null, fxRateAt: null, fetchedAt: null, isFallback: true },
      rows: [
        {
          ticker: "AAPL",
          currency: "USD",
          quantity: 5,
          priceBRL: 1100,
          source: "api",
          marketPriceAt: "2026-06-15T20:00:00.000Z",
        },
      ],
    });
    expect(usdWithFallback.fxWarning).toContain("fallback");

    const usdWithStaleFx = evaluateStaleQuoteGuard({
      now,
      fxMetadata: {
        rate: 5.65,
        source: "api",
        provider: "bcb_ptax",
        fxRateAt: "2026-06-11T16:11:00.000Z",
        fetchedAt: "2026-06-11T16:15:00.000Z",
        isFallback: false,
      },
      rows: [
        {
          ticker: "AAPL",
          currency: "USD",
          quantity: 5,
          priceBRL: 1100,
          source: "api",
          marketPriceAt: "2026-06-15T20:00:00.000Z",
        },
      ],
    });
    expect(usdWithStaleFx.fxWarning).toContain("defasada");
  });
});
