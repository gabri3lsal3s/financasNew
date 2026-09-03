import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearBcbCache, fetchBcbIndicator, fetchOnlineQuote, syncQuoteForTicker, syncQuotesForAssets } from "./quotes";

const mockSetAssetPrice = vi.fn();
const mockSetAssetPricesBatch = vi.fn();

vi.mock("@/data/repositories/asset-prices", () => ({
  setAssetPriceFromApi: (ticker: string, price: number, currency: string) =>
    mockSetAssetPrice(ticker, price, currency),
  setAssetPricesBatchFromApi: (quotes: Array<{ ticker: string; price: number; currency: string }>) =>
    mockSetAssetPricesBatch(quotes),
}));

describe("quotes service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncQuoteForTicker ignora ativos de classe caixa", async () => {
    const result = await syncQuoteForTicker("RESERVA", "caixa");
    expect(result).toBeNull();
    expect(mockSetAssetPrice).not.toHaveBeenCalled();
  });

  it("fetchOnlineQuote retorna cotação da Brapi para ticker B3", async () => {
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ symbol: "PETR4", currency: "BRL", regularMarketPrice: 39.5 }],
      }),
    });
    vi.stubGlobal("fetch", globalFetch);

    const quote = await fetchOnlineQuote("PETR4");
    expect(quote).toEqual({
      ticker: "PETR4",
      price: 39.5,
      currency: "BRL",
    });

    vi.unstubAllGlobals();
  });

  it("syncQuoteForTicker grava o preço obtido via setAssetPriceFromApi", async () => {
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ symbol: "VALE3", currency: "BRL", regularMarketPrice: 61.2 }],
      }),
    });
    vi.stubGlobal("fetch", globalFetch);

    const quote = await syncQuoteForTicker("VALE3", "Ações");
    expect(quote).not.toBeNull();
    expect(mockSetAssetPrice).toHaveBeenCalledWith("VALE3", 61.2, "BRL");

    vi.unstubAllGlobals();
  });

  it("syncQuotesForAssets sincroniza ativos elegíveis e ignora caixa", async () => {
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ symbol: "BOVA11", currency: "BRL", regularMarketPrice: 120.0 }],
      }),
    });
    vi.stubGlobal("fetch", globalFetch);

    const updated = await syncQuotesForAssets([
      { ticker: "BOVA11", asset_class: "ETF" },
      { ticker: "RESERVA", asset_class: "caixa" },
    ]);

    expect(updated).toBe(1);
    expect(mockSetAssetPricesBatch).toHaveBeenCalledTimes(1);
    expect(mockSetAssetPricesBatch).toHaveBeenCalledWith([
      { ticker: "BOVA11", price: 120.0, currency: "BRL" },
    ]);

    vi.unstubAllGlobals();
  });

  it("fetchBcbIndicator busca taxa CDI com fallback e converte para % anual", async () => {
    clearBcbCache();
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ data: "02/09/2026", valor: "0.041646" }],
    });
    vi.stubGlobal("fetch", globalFetch);

    const cdi = await fetchBcbIndicator("CDI");
    // 0.041646% diário -> (1 + 0.00041646)^252 - 1 ≈ 11.06%
    expect(cdi).toBeGreaterThan(10.0);
    expect(cdi).toBeLessThan(13.0);

    vi.unstubAllGlobals();
  });

  it("fetchBcbIndicator busca Selic Meta (% a.a.)", async () => {
    clearBcbCache();
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ data: "02/09/2026", valor: "10.50" }],
    });
    vi.stubGlobal("fetch", globalFetch);

    const selic = await fetchBcbIndicator("SELIC");
    expect(selic).toBe(10.5);

    vi.unstubAllGlobals();
  });

  it("fetchBcbIndicator utiliza cache em chamadas subsequentes", async () => {
    clearBcbCache();
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ data: "02/09/2026", valor: "10.50" }],
    });
    vi.stubGlobal("fetch", globalFetch);

    const selic1 = await fetchBcbIndicator("SELIC");
    const selic2 = await fetchBcbIndicator("SELIC");

    expect(selic1).toBe(10.5);
    expect(selic2).toBe(10.5);
    expect(globalFetch).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
