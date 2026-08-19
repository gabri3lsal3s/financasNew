import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchOnlineQuote, syncQuoteForTicker, syncQuotesForAssets } from "./quotes";

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
});
