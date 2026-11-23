import { describe, expect, it } from "vitest";
import {
  classifyTickerMarket,
  getLastBusinessDayOfMonth,
  getLastMarketCloseUtc,
  getUsMarketHolidays,
  isBusinessDayForMarket,
  isMarketClosedForMonth,
  isMarketOpenForTicker,
  isTickerQuoteStaleForSwr,
  zonedMarketTimeToUtc,
} from "./market-calendar";

describe("domain/portfolio/market-calendar", () => {
  it("classifica tickers B3 (padrão e fracionário), EUA, FX e CRYPTO corretamente", () => {
    expect(classifyTickerMarket("PETR4")).toBe("BR");
    expect(classifyTickerMarket("PETR4F")).toBe("BR");
    expect(classifyTickerMarket("BOVA11")).toBe("BR");
    expect(classifyTickerMarket("AAPL")).toBe("US");
    expect(classifyTickerMarket("BRK.B")).toBe("US");
    expect(classifyTickerMarket("VOO")).toBe("US");
    expect(classifyTickerMarket("USDBRL=X")).toBe("FX");
    expect(classifyTickerMarket("USD-BRL")).toBe("FX");
    expect(classifyTickerMarket("BTC-BRL")).toBe("CRYPTO");
  });

  it("respeita calendários independentes de feriados BR (B3) e US (NYSE/NASDAQ)", () => {
    // 2026-07-04 cai no sábado → observado na sexta 2026-07-03 nos EUA, dia útil normal na B3
    const usHolidays2026 = getUsMarketHolidays(2026);
    expect(usHolidays2026.has("2026-07-03")).toBe(true);
    expect(isBusinessDayForMarket("2026-07-03", "US")).toBe(false);
    expect(isBusinessDayForMarket("2026-07-03", "BR")).toBe(true);

    // 2026-09-07 (Independência do Brasil) cai na segunda → fechado na B3, Labor Day nos EUA também é 1ª segunda (07/09/2026)
    expect(isBusinessDayForMarket("2026-09-07", "BR")).toBe(false);
    expect(isBusinessDayForMarket("2026-09-07", "US")).toBe(false);

    // 2026-11-20 (Consciência Negra - nacional BR) → fechado na B3, aberto nos EUA
    expect(isBusinessDayForMarket("2026-11-20", "BR")).toBe(false);
    expect(isBusinessDayForMarket("2026-11-20", "US")).toBe(true);
  });

  it("calcula pregão aberto considerando DST de Nova York e horário de Brasília", () => {
    // Verão nos EUA (EDT = UTC-4): 15:30 NY = 19:30 UTC (em 2026-06-15, quarta útil)
    const nySummerOpen = new Date("2026-06-15T19:30:00.000Z");
    expect(isMarketOpenForTicker("AAPL", nySummerOpen)).toBe(true);

    // Inverno nos EUA (EST = UTC-5): 21:20 UTC = 16:20 EST (já fechou às 16:15 EST), mas no verão seria 17:20 EDT (também fechado)
    // Teste exato às 16:00 NY em 2026-01-15 (EST = UTC-5 → 21:00 UTC, dentro da janela até 16:15 EST) vs 16:30 NY (21:30 UTC, fechado)
    expect(isMarketOpenForTicker("AAPL", new Date("2026-01-15T21:00:00.000Z"))).toBe(true);
    expect(isMarketOpenForTicker("AAPL", new Date("2026-01-15T21:30:00.000Z"))).toBe(false);

    // B3 (BRT = UTC-3): 11:00 BRT = 14:00 UTC aberto; 18:30 BRT = 21:30 UTC fechado
    expect(isMarketOpenForTicker("PETR4", new Date("2026-06-15T14:00:00.000Z"))).toBe(true);
    expect(isMarketOpenForTicker("PETR4", new Date("2026-06-15T21:30:00.000Z"))).toBe(false);

    // Domingo sempre fechado para ações, aberto para cripto
    const sunday = new Date("2026-06-14T15:00:00.000Z");
    expect(isMarketOpenForTicker("PETR4", sunday)).toBe(false);
    expect(isMarketOpenForTicker("AAPL", sunday)).toBe(false);
    expect(isMarketOpenForTicker("BTC-USD", sunday)).toBe(true);
  });

  it("zonedMarketTimeToUtc respeita mudança de horário de verão em New York", () => {
    const summerClose = zonedMarketTimeToUtc("2026-06-15", 16, 15, "America/New_York");
    expect(summerClose.toISOString()).toBe("2026-06-15T20:15:00.000Z");

    const winterClose = zonedMarketTimeToUtc("2026-01-15", 16, 15, "America/New_York");
    expect(winterClose.toISOString()).toBe("2026-01-15T21:15:00.000Z");
  });

  it("isTickerQuoteStaleForSwr detecta cache_miss, trava mercado fechado pós-EOD e libera após abertura ou pós-fechamento sem EOD", () => {
    // 1. Override manual nunca é tratado como stale pelo SWR
    expect(
      isTickerQuoteStaleForSwr({
        ticker: "PETR4",
        source: "manual",
        price: 40,
        now: new Date("2026-06-15T15:00:00.000Z"),
      }),
    ).toBeNull();

    // 2. Cache miss sempre pede busca mesmo no domingo
    const sunday = new Date("2026-06-14T15:00:00.000Z");
    expect(
      isTickerQuoteStaleForSwr({
        ticker: "PETR4",
        source: "fallback",
        price: 30,
        now: sunday,
      }),
    ).toBe("cache_miss");

    // 3. No domingo com cotação capturada após fechamento de sexta (2026-06-12T21:15Z), retorna null (0 chamadas!)
    const lastClose = getLastMarketCloseUtc("PETR4", sunday);
    expect(lastClose?.toISOString()).toBe("2026-06-12T21:15:00.000Z");
    expect(
      isTickerQuoteStaleForSwr({
        ticker: "PETR4",
        source: "api",
        price: 38.5,
        fetchedAt: "2026-06-12T21:30:00.000Z",
        now: sunday,
      }),
    ).toBeNull();

    // 4. No domingo com cotação antiga (sexta antes do fechamento), precisa capturar EOD oficial 1x
    expect(
      isTickerQuoteStaleForSwr({
        ticker: "PETR4",
        source: "api",
        price: 38.5,
        fetchedAt: "2026-06-12T18:00:00.000Z",
        now: sunday,
      }),
    ).toBe("swr_expired");

    // 5. Durante pregão aberto: fresco em 5 min, stale após 15 min
    const openNow = new Date("2026-06-15T15:00:00.000Z");
    expect(
      isTickerQuoteStaleForSwr({
        ticker: "PETR4",
        source: "api",
        price: 38.5,
        fetchedAt: "2026-06-15T14:55:00.000Z",
        now: openNow,
      }),
    ).toBeNull();
    expect(
      isTickerQuoteStaleForSwr({
        ticker: "PETR4",
        source: "api",
        price: 38.5,
        fetchedAt: "2026-06-15T14:40:00.000Z",
        now: openNow,
      }),
    ).toBe("swr_expired");
  });

  it("respeita último dia útil B3 e fronteira exata das 19h BRT em isMarketClosedForMonth", () => {
    // Novembro/2024: dia 30 foi sábado -> último dia útil = sexta 2024-11-29 (pós Consciência Negra dia 20)
    expect(getLastBusinessDayOfMonth(2024, 11)).toBe("2024-11-29");
    // Novembro/2026: dia 30 é segunda útil -> último dia útil = 2026-11-30
    expect(getLastBusinessDayOfMonth(2026, 11)).toBe("2026-11-30");

    // 18:59 BRT = 21:59 UTC (ainda aberto na fronteira do snapshot) vs 19:00 BRT = 22:00 UTC (fechado)
    expect(isMarketClosedForMonth(2026, 11, new Date("2026-11-30T21:59:00.000Z"))).toBe(false);
    expect(isMarketClosedForMonth(2026, 11, new Date("2026-11-30T22:00:00.000Z"))).toBe(true);
  });
});
