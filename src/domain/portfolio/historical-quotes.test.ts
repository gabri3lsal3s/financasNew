import { describe, expect, it } from "vitest";
import { resolveHistoricalQuotePriority } from "./historical-quotes";
import type { MonthlyPriceRow } from "@/types";

describe("resolveHistoricalQuotePriority", () => {
  it("prioritizes saved manual monthly price over API and other sources", () => {
    const savedPrice: MonthlyPriceRow = {
      id: "quote-1",
      user_id: "user-1",
      ticker: "PETR4",
      month: "2026-02",
      price: 38.5,
      currency: "BRL",
      source: "manual",
      created_at: "2026-02-28T10:00:00Z",
      updated_at: "2026-02-28T10:00:00Z",
    };

    const result = resolveHistoricalQuotePriority({
      ticker: "petr4",
      currency: "BRL",
      savedMonthlyPrice: savedPrice,
      apiClosePrice: 37.9,
      lastTransactionPriceInMonth: 36.0,
      currentLivePrice: 40.0,
    });

    expect(result).toEqual({
      ticker: "PETR4",
      price: 38.5,
      currency: "BRL",
      source: "manual",
      isEstimate: false,
      badgeLabel: "Manual",
    });
  });

  it("prioritizes saved API monthly price when no manual override exists", () => {
    const savedPrice: MonthlyPriceRow = {
      id: "quote-2",
      user_id: "user-1",
      ticker: "VALE3",
      month: "2026-02",
      price: 61.25,
      currency: "BRL",
      source: "api",
      created_at: "2026-02-28T10:00:00Z",
      updated_at: "2026-02-28T10:00:00Z",
    };

    const result = resolveHistoricalQuotePriority({
      ticker: "VALE3",
      savedMonthlyPrice: savedPrice,
      apiClosePrice: 62.0,
      lastTransactionPriceInMonth: 59.0,
    });

    expect(result).toEqual({
      ticker: "VALE3",
      price: 61.25,
      currency: "BRL",
      source: "api",
      isEstimate: false,
      badgeLabel: "Oficial API",
    });
  });

  it("uses API close price when nothing is saved in database", () => {
    const result = resolveHistoricalQuotePriority({
      ticker: "ITUB4",
      apiClosePrice: 34.8,
      lastTransactionPriceInMonth: 33.5,
      currentLivePrice: 35.0,
    });

    expect(result).toEqual({
      ticker: "ITUB4",
      price: 34.8,
      currency: "BRL",
      source: "api",
      isEstimate: false,
      badgeLabel: "Oficial API",
    });
  });

  it("falls back to last transaction price in month when API is unavailable", () => {
    const result = resolveHistoricalQuotePriority({
      ticker: "WEGE3",
      apiClosePrice: null,
      lastTransactionPriceInMonth: 52.1,
      currentLivePrice: 55.0,
    });

    expect(result).toEqual({
      ticker: "WEGE3",
      price: 52.1,
      currency: "BRL",
      source: "fallback",
      isEstimate: true,
      badgeLabel: "Sugerida",
    });
  });

  it("falls back to current live price when no transaction occurred in the month", () => {
    const result = resolveHistoricalQuotePriority({
      ticker: "BBAS3",
      apiClosePrice: null,
      lastTransactionPriceInMonth: null,
      currentLivePrice: 28.45,
    });

    expect(result).toEqual({
      ticker: "BBAS3",
      price: 28.45,
      currency: "BRL",
      source: "fallback",
      isEstimate: true,
      badgeLabel: "Sugerida",
    });
  });

  it("returns zero price estimate when no quote or price references exist", () => {
    const result = resolveHistoricalQuotePriority({
      ticker: "UNKNOWN",
    });

    expect(result).toEqual({
      ticker: "UNKNOWN",
      price: 0,
      currency: "BRL",
      source: "fallback",
      isEstimate: true,
      badgeLabel: "Sugerida",
    });
  });

  it("respects USD currency and rounds prices to 4 decimal places", () => {
    const result = resolveHistoricalQuotePriority({
      ticker: "AAPL",
      currency: "USD",
      apiClosePrice: 228.45678,
    });

    expect(result.currency).toBe("USD");
    expect(result.price).toBe(228.4568);
    expect(result.badgeLabel).toBe("Oficial API");
  });
});
