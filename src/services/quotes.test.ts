import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearBcbCache,
  fetchBcbIndicator,
  fetchHistoricalMonthlyQuotes,
  fetchOnlineQuote,
  fetchPtaxForDate,
  syncMarketQuotesBatch,
  syncQuoteForTicker,
  syncQuotesForAssets,
} from "./quotes";

const listMarketPriceHistoryByMonthMock = vi.fn();
const functionsInvokeMock = vi.fn();

vi.mock("@/data/repositories/asset-prices", () => ({
  listMarketPriceHistoryByMonth: (...args: unknown[]) =>
    listMarketPriceHistoryByMonthMock(...args),
}));

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    functions: {
      invoke: (...args: unknown[]) => functionsInvokeMock(...args),
    },
  }),
}));

describe("services/quotes (Modelo Global via Edge Function)", () => {
  afterEach(() => {
    clearBcbCache();
    vi.restoreAllMocks();
    listMarketPriceHistoryByMonthMock.mockReset();
    functionsInvokeMock.mockReset();
  });

  it("fetchOnlineQuote consulta exclusivamente a Edge Function em mode preview sem fetch direto externo", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    functionsInvokeMock.mockResolvedValueOnce({
      data: {
        updated: 0,
        guarded: 0,
        failed: 0,
        skippedByEodGuard: 0,
        skippedByCooldown: 0,
        skippedByLock: 0,
        rateLimited: false,
        quotes: [
          {
            ticker: "PETR4",
            price: 38.75,
            currency: "BRL",
            marketPriceAt: "2026-10-16T20:55:00.000Z",
            fetchedAt: "2026-10-16T21:00:00.000Z",
            provider: "yahoo",
          },
        ],
      },
      error: null,
    });

    const quote = await fetchOnlineQuote("petr4");
    expect(quote).toEqual({
      ticker: "PETR4",
      price: 38.75,
      currency: "BRL",
    });
    expect(functionsInvokeMock).toHaveBeenCalledWith("quotes", {
      body: { tickers: ["PETR4"], mode: "preview", reason: "cache_miss" },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetchOnlineQuote ignora títulos privados de RF e Tesouro Direto antes de chamar servidor", async () => {
    expect(await fetchOnlineQuote("CDB-BANCO-INTER")).toBeNull();
    expect(await fetchOnlineQuote("TESOURO SELIC 2029")).toBeNull();
    expect(functionsInvokeMock).not.toHaveBeenCalled();
  });

  it("syncQuoteForTicker delega à Edge Function em mode swr sem fetch externo no cliente", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    functionsInvokeMock.mockResolvedValueOnce({
      data: {
        updated: 1,
        quotes: [{ ticker: "IVVB11", price: 345.2, currency: "BRL" }],
      },
      error: null,
    });

    const res = await syncQuoteForTicker("ivvb11", "ETF", "cache_miss");
    expect(res).toEqual({ ticker: "IVVB11", price: 345.2, currency: "BRL" });
    expect(functionsInvokeMock).toHaveBeenCalledWith("quotes", {
      body: { tickers: ["IVVB11"], mode: "swr", reason: "cache_miss" },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("syncQuotesForAssets filtra CAIXA, CDB, Tesouro e valoração própria, inclui USDBRL=X e não chama fetch externo", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    functionsInvokeMock.mockResolvedValueOnce({
      data: {
        updated: 3,
        quotes: [
          { ticker: "VALE3", price: 61.5, currency: "BRL" },
          { ticker: "AAPL", price: 225.4, currency: "USD" },
          { ticker: "USDBRL=X", price: 5.71, currency: "BRL" },
        ],
      },
      error: null,
    });

    const count = await syncQuotesForAssets([
      { ticker: "VALE3", asset_class: "Ações" },
      { ticker: "AAPL", asset_class: "Ações EUA" },
      { ticker: "CAIXA", asset_class: "Reserva" },
      { ticker: "CDB-110", asset_class: "Renda Fixa" },
      { ticker: "TESOURO IPCA+ 2035", asset_class: "Tesouro Direto" },
      { ticker: "IMOVEL", asset_class: "Outros", notes: "[VALUATION:CUSTOM]" },
    ]);

    expect(count).toBe(3);
    expect(functionsInvokeMock).toHaveBeenCalledWith("quotes", {
      body: {
        tickers: ["VALE3", "AAPL", "USDBRL=X"],
        mode: "swr",
        reason: "swr",
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("syncMarketQuotesBatch divide em lotes de 50 e agrega contadores de rate limit e skipped", async () => {
    const tickers = Array.from({ length: 52 }, (_, idx) => `TKR${idx + 1}3`);
    functionsInvokeMock
      .mockResolvedValueOnce({
        data: {
          updated: 40,
          guarded: 1,
          failed: 0,
          skippedByEodGuard: 5,
          skippedByCooldown: 4,
          skippedByLock: 0,
          rateLimited: false,
          quotes: [{ ticker: "TKR13", price: 10, currency: "BRL" }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          updated: 0,
          guarded: 0,
          failed: 0,
          skippedByEodGuard: 0,
          skippedByCooldown: 0,
          skippedByLock: 0,
          rateLimited: true,
          retryAfterSeconds: 45,
          quotes: [],
        },
        error: null,
      });

    const res = await syncMarketQuotesBatch({
      tickers,
      mode: "report_preflight",
      reason: "report_preflight",
    });

    expect(functionsInvokeMock).toHaveBeenCalledTimes(2);
    expect(res.updated).toBe(40);
    expect(res.guarded).toBe(1);
    expect(res.skippedByEodGuard).toBe(5);
    expect(res.skippedByCooldown).toBe(4);
    expect(res.rateLimited).toBe(true);
    expect(res.retryAfterSeconds).toBe(45);
    expect(res.quotes).toHaveLength(1);
  });

  it("fetchHistoricalMonthlyQuotes lê market_price_history primeiro e envia só ausentes à Edge Function", async () => {
    listMarketPriceHistoryByMonthMock.mockResolvedValueOnce([
      {
        ticker: "PETR4",
        reference_date: "2026-09-30",
        price: 39.1,
        currency: "BRL",
        provider: "yahoo",
        market_price_at: "2026-09-30T21:00:00.000Z",
        month: "2026-09",
        is_month_end: true,
      },
    ]);
    functionsInvokeMock.mockResolvedValueOnce({
      data: {
        quotes: [
          {
            ticker: "AAPL",
            price: 220.4,
            currency: "USD",
            marketPriceAt: "2026-09-30T20:00:00.000Z",
            provider: "yahoo",
          },
        ],
      },
      error: null,
    });

    const quotes = await fetchHistoricalMonthlyQuotes(["PETR4", "AAPL"], "2026-09");
    expect(listMarketPriceHistoryByMonthMock).toHaveBeenCalledWith("2026-09");
    expect(functionsInvokeMock).toHaveBeenCalledWith("quotes", {
      body: { tickers: ["AAPL"], month: "2026-09" },
    });
    expect(quotes).toEqual([
      {
        ticker: "PETR4",
        price: 39.1,
        currency: "BRL",
        source: "api",
        marketPriceAt: "2026-09-30T21:00:00.000Z",
        provider: "yahoo",
      },
      {
        ticker: "AAPL",
        price: 220.4,
        currency: "USD",
        source: "api",
        marketPriceAt: "2026-09-30T20:00:00.000Z",
        provider: "yahoo",
      },
    ]);
  });

  it("fetchHistoricalMonthlyQuotes evita invocar Edge Function quando todos os tickers já constam em market_price_history", async () => {
    listMarketPriceHistoryByMonthMock.mockResolvedValueOnce([
      {
        ticker: "USDBRL=X",
        reference_date: "2026-08-31",
        price: 5.6123,
        currency: "BRL",
        provider: "bcb_ptax",
        market_price_at: "2026-08-31T21:00:00.000Z",
        month: "2026-08",
        is_month_end: true,
      },
    ]);

    const quotes = await fetchHistoricalMonthlyQuotes(["USDBRL=X"], "2026-08");
    expect(functionsInvokeMock).not.toHaveBeenCalled();
    expect(quotes[0]).toMatchObject({ ticker: "USDBRL=X", price: 5.6123, provider: "bcb_ptax" });
  });

  it("fetchPtaxForDate consulta market_price_history antes do BCB SGS e só vai ao BCB em cache miss", async () => {
    listMarketPriceHistoryByMonthMock.mockResolvedValueOnce([
      {
        ticker: "USDBRL=X",
        reference_date: "2026-09-30",
        price: 5.45123,
        currency: "BRL",
        provider: "bcb_ptax",
        market_price_at: "2026-09-30T21:00:00.000Z",
        month: "2026-09",
        is_month_end: true,
      },
    ]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const fromHistory = await fetchPtaxForDate("2026-09-30");
    expect(fromHistory).toBe(5.4512);
    expect(fetchSpy).not.toHaveBeenCalled();

    listMarketPriceHistoryByMonthMock.mockResolvedValueOnce([]);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { data: "29/09/2026", valor: "5.4100" },
        { data: "30/09/2026", valor: "5.4489" },
      ],
    } as Response);

    const fromBcb = await fetchPtaxForDate("2026-09-30");
    expect(fromBcb).toBe(5.4489);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("bcdata.sgs.1");
  });

  it("fetchBcbIndicator busca e armazena CDI em cache de memória", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [{ data: "22/11/2026", valor: "0.055131" }],
    } as Response);

    const first = await fetchBcbIndicator("CDI");
    const second = await fetchBcbIndicator("CDI");
    expect(first).toBeGreaterThan(10);
    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
