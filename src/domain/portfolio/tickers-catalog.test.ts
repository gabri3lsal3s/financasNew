import { describe, expect, it } from "vitest";
import {
  buildAporteSuggestions,
  cleanTicker,
  searchTickers,
  CURATED_TICKERS_CATALOG,
} from "./tickers-catalog";
import type { PortfolioAsset } from "@/types";

describe("tickers-catalog — Autocomplete e Sugestões Preditivas (Fase 41)", () => {
  it("possui catálogo básico com principais ativos B3 e globais", () => {
    expect(CURATED_TICKERS_CATALOG.length).toBeGreaterThan(50);
    expect(CURATED_TICKERS_CATALOG.some((c) => c.ticker === "PETR4")).toBe(true);
    expect(CURATED_TICKERS_CATALOG.some((c) => c.ticker === "MXRF11")).toBe(true);
    expect(CURATED_TICKERS_CATALOG.some((c) => c.ticker === "IVVB11")).toBe(true);
    expect(CURATED_TICKERS_CATALOG.some((c) => c.ticker === "VOO")).toBe(true);
  });

  describe("cleanTicker", () => {
    it("converte para caixa alta e remove espaços em branco", () => {
      expect(cleanTicker("  petr4  ")).toBe("PETR4");
      expect(cleanTicker("vale3")).toBe("VALE3");
    });
  });

  describe("searchTickers", () => {
    const mockExistingAssets: PortfolioAsset[] = [
      {
        id: "asset-1",
        user_id: "u-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 35.0,
      },
      {
        id: "asset-2",
        user_id: "u-1",
        ticker: "MXRF11",
        asset_class: "FIIs",
        currency: "BRL",
        quantity: 50,
        average_price: 10.2,
      },
    ];

    it("busca por prefixo de ticker e indica se já existe na carteira", () => {
      const results = searchTickers("PET", mockExistingAssets);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.ticker).toBe("PETR4");
      expect(results[0]!.isExisting).toBe(true);
      expect(results[0]!.existingAssetId).toBe("asset-1");
      expect(results[0]!.currentQuantity).toBe(100);
    });

    it("busca por nome da empresa / fundo", () => {
      const results = searchTickers("Maxi", mockExistingAssets);
      expect(results.some((r) => r.ticker === "MXRF11")).toBe(true);
    });

    it("oferece ativo customizado quando o ticker não existe no catálogo", () => {
      const results = searchTickers("NOVO3", mockExistingAssets);
      expect(results.some((r) => r.ticker === "NOVO3" && r.assetClass === "Ações")).toBe(true);
    });

    it("retorna ativos existentes quando a query está vazia", () => {
      const results = searchTickers("", mockExistingAssets);
      expect(results.length).toBe(2);
      expect(results[0]!.ticker).toBe("PETR4");
      expect(results[1]!.ticker).toBe("MXRF11");
    });
  });

  describe("buildAporteSuggestions", () => {
    const mockAssets: PortfolioAsset[] = [
      {
        id: "a-1",
        user_id: "u-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 35.0,
      },
      {
        id: "a-2",
        user_id: "u-1",
        ticker: "MXRF11",
        asset_class: "FIIs",
        currency: "BRL",
        quantity: 50,
        average_price: 10.0,
      },
    ];

    const mockRows = [
      { assetId: "a-1", ticker: "PETR4", valueBRL: 4000, pct: 40, assetClass: "Ações" },
      { assetId: "a-2", ticker: "MXRF11", valueBRL: 500, pct: 5, assetClass: "FIIs" },
    ];

    const mockTargets = [
      { asset_id: "a-1", target_percentage: 30 }, // Alvo: 3.000, Atual: 4.000 -> Gap 0 (sem déficit)
      { asset_id: "a-2", target_percentage: 20 }, // Alvo: 2.000, Atual: 500 -> Gap: 1.500 (déficit!)
    ];

    it("sugere aporte apenas para ativos com déficit em relação à meta", () => {
      const suggestions = buildAporteSuggestions(mockAssets, mockRows, mockTargets, 10000);
      expect(suggestions.length).toBe(1);
      expect(suggestions[0]!.ticker).toBe("MXRF11");
      expect(suggestions[0]!.gapBRL).toBe(1500);
      expect(suggestions[0]!.targetValueBRL).toBe(2000);
    });

    it("retorna lista vazia quando não há metas ou patrimônio zerado", () => {
      expect(buildAporteSuggestions(mockAssets, mockRows, [], 10000)).toEqual([]);
      expect(buildAporteSuggestions(mockAssets, mockRows, mockTargets, 0)).toEqual([]);
    });
  });
});
