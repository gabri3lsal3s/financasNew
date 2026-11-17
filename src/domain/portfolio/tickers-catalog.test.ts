import { describe, expect, it } from "vitest";
import {
  buildAporteSuggestions,
  cleanTicker,
  inferSectorFromTicker,
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

  describe("inferSectorFromTicker", () => {
    it("reconhece setores de ações B3 do catálogo", () => {
      expect(inferSectorFromTicker("PETR4", "Ações")).toBe("Petróleo, Gás e Combustíveis");
      expect(inferSectorFromTicker("ITUB4", "Ações")).toBe("Financeiro / Bancos");
      expect(inferSectorFromTicker("TAEE11", "Ações")).toBe("Energia Elétrica");
      expect(inferSectorFromTicker("WEGE3", "Ações")).toBe("Bens de Capital / Máquinas");
    });

    it("reconhece segmentos de FIIs", () => {
      expect(inferSectorFromTicker("HGLG11", "FIIs")).toBe("Imobiliário / Logística");
      expect(inferSectorFromTicker("MXRF11", "FIIs")).toBe("Imobiliário / Papel e CRI");
      expect(inferSectorFromTicker("XPML11", "FIIs")).toBe("Imobiliário / Shoppings");
      expect(inferSectorFromTicker("RZTR11", "FIIs")).toBe("Agro / FIAGRO");
    });

    it("reconhece indexadores de Renda Fixa e Tesouro Direto", () => {
      expect(inferSectorFromTicker("TESOURO-SELIC", "Renda Fixa")).toBe("Pós-fixado (Selic / CDI)");
      expect(inferSectorFromTicker("TESOURO-IPCA", "Renda Fixa")).toBe("Inflação (IPCA+)");
      expect(inferSectorFromTicker("TESOURO-PREFIXADO", "Renda Fixa")).toBe("Prefixado");
      expect(inferSectorFromTicker("CDB-100-CDI", "Renda Fixa")).toBe("Pós-fixado (Selic / CDI)");
    });

    it("reconhece ativos internacionais em dólar", () => {
      expect(inferSectorFromTicker("VOO", "Internacional")).toBe("Mercado Amplo US (S&P 500)");
      expect(inferSectorFromTicker("VT", "Internacional")).toBe("Neutro Global (All-World)");
      expect(inferSectorFromTicker("VNQ", "Internacional")).toBe("REITs / Imobiliário");
      expect(inferSectorFromTicker("AAPL", "Internacional")).toBe("Tecnologia & Software");
    });

    it("reconhece criptomoedas e stablecoins", () => {
      expect(inferSectorFromTicker("BTC", "Cripto")).toBe("Layer 1 / Reserva (BTC / ETH / SOL)");
      expect(inferSectorFromTicker("USDT", "Cripto")).toBe("Stablecoins (USD)");
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

    it("suporta busca e catálogo de tickers de 1 letra (ex: O - Realty Income, T - AT&T)", () => {
      const resultsO = searchTickers("O", mockExistingAssets);
      expect(resultsO.some((r) => r.ticker === "O" && r.assetClass === "Internacional" && r.currency === "USD")).toBe(true);

      const resultsT = searchTickers("T", mockExistingAssets);
      expect(resultsT.some((r) => r.ticker === "T" && r.currency === "USD")).toBe(true);

      // Ticker livre de 1 letra não presente no catálogo
      const resultsZ = searchTickers("Z", mockExistingAssets);
      expect(resultsZ.some((r) => r.ticker === "Z" && r.currency === "USD")).toBe(true);
    });

    it("retorna ativos existentes quando a query está vazia", () => {
      const results = searchTickers("", mockExistingAssets);
      expect(results.length).toBe(2);
      expect(results[0]!.ticker).toBe("PETR4");
      expect(results[1]!.ticker).toBe("MXRF11");
    });

    it("encontra títulos públicos e privados por busca multi-token e aliases", () => {
      const resultsSelic = searchTickers("selic 29");
      expect(resultsSelic.some((r) => r.ticker === "TESOURO SELIC 2029")).toBe(true);

      const resultsIpca = searchTickers("ipca 2035");
      expect(resultsIpca.some((r) => r.ticker === "TESOURO IPCA+ 2035")).toBe(true);

      const resultsCdb = searchTickers("cdb 110");
      expect(resultsCdb.some((r) => r.ticker === "CDB 110% CDI")).toBe(true);

      const resultsLci = searchTickers("lci 95");
      expect(resultsLci.some((r) => r.ticker === "LCI 95% CDI")).toBe(true);

      const resultsRenda = searchTickers("renda 2060");
      expect(resultsRenda.some((r) => r.ticker === "TESOURO RENDA+ 2060")).toBe(true);
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
        score: 8,
        allocation_status: "active",
      },
      {
        id: "a-2",
        user_id: "u-1",
        ticker: "MXRF11",
        asset_class: "FIIs",
        currency: "BRL",
        quantity: 50,
        average_price: 10.0,
        score: 8,
        allocation_status: "active",
      },
    ];

    const mockRows = [
      { assetId: "a-1", ticker: "PETR4", valueBRL: 4000, pct: 40, assetClass: "Ações" },
      { assetId: "a-2", ticker: "MXRF11", valueBRL: 500, pct: 5, assetClass: "FIIs" },
    ];

    const mockClassTargets = [
      { name: "Ações", target_percentage: 30 }, // Alvo: 1.350, Atual: 4.000 -> sem déficit
      { name: "FIIs", target_percentage: 70 }, // Alvo: 3.150, Atual: 500 -> déficit 2.650!
    ];

    it("sugere aporte apenas para ativos pertencentes a classes com déficit", () => {
      const suggestions = buildAporteSuggestions(mockAssets, mockRows, 4500, 3, mockClassTargets);
      expect(suggestions.length).toBe(1);
      expect(suggestions[0]!.ticker).toBe("MXRF11");
      expect(suggestions[0]!.gapBRL).toBe(2650);
      expect(suggestions[0]!.targetValueBRL).toBe(3150);
    });

    it("pondera ativos dentro da mesma classe pelas notas de convicção (Nota 8 vs Nota 4)", () => {
      const scoredAssets: PortfolioAsset[] = [
        { id: "s1", user_id: "u-1", ticker: "ITUB4", asset_class: "Ações", currency: "BRL", quantity: 10, average_price: 10, score: 8, allocation_status: "active" },
        { id: "s2", user_id: "u-1", ticker: "BBDC4", asset_class: "Ações", currency: "BRL", quantity: 10, average_price: 10, score: 2, allocation_status: "active" },
      ];
      const rows = [
        { assetId: "s1", ticker: "ITUB4", valueBRL: 500, pct: 50, assetClass: "Ações" },
        { assetId: "s2", ticker: "BBDC4", valueBRL: 500, pct: 50, assetClass: "Ações" },
      ];
      // Meta Ações 100%: ITUB4 (8/10 = 80% = 800, gap 300), BBDC4 (2/10 = 20% = 200, gap <= 0)
      const suggestions = buildAporteSuggestions(scoredAssets, rows, 1000, 3, [{ name: "Ações", target_percentage: 100 }]);
      expect(suggestions.map((s) => s.ticker)).toEqual(["ITUB4"]);
      expect(suggestions[0]!.targetPercentage).toBe(80);
    });

    it("ignora CAIXA e ativos em quarentena, saída ou neutro nas sugestões", () => {
      const govAssets: PortfolioAsset[] = [
        { id: "cash", user_id: "u-1", ticker: "CAIXA", asset_class: "Caixa", currency: "BRL", quantity: 5000, average_price: 1 },
        { id: "a-q", user_id: "u-1", ticker: "OIBR3", asset_class: "Ações", currency: "BRL", quantity: 10, average_price: 10, score: 2, allocation_status: "quarantine" },
        { id: "a-n", user_id: "u-1", ticker: "SANB11", asset_class: "Ações", currency: "BRL", quantity: 10, average_price: 10, score: 6, allocation_status: "neutral" },
        { id: "a-ok", user_id: "u-1", ticker: "ITUB4", asset_class: "Ações", currency: "BRL", quantity: 10, average_price: 10, score: 9, allocation_status: "active" },
      ];
      const rows = [
        { assetId: "cash", ticker: "CAIXA", valueBRL: 5000, pct: 80, assetClass: "Caixa" },
        { assetId: "a-q", ticker: "OIBR3", valueBRL: 100, pct: 5, assetClass: "Ações" },
        { assetId: "a-n", ticker: "SANB11", valueBRL: 100, pct: 5, assetClass: "Ações" },
        { assetId: "a-ok", ticker: "ITUB4", valueBRL: 100, pct: 10, assetClass: "Ações" },
      ];
      const suggestions = buildAporteSuggestions(govAssets, rows, 5300, 5, [{ name: "Ações", target_percentage: 100 }]);
      expect(suggestions.map((s) => s.ticker)).toEqual(["ITUB4"]);
      // Base investível exclui CAIXA (300 reais investidos)
      expect(suggestions[0]!.targetValueBRL).toBe(300);
    });

    it("prioriza a classe com maior déficit relativo", () => {
      const assetsWithTwoClasses: PortfolioAsset[] = [
        { id: "a-1", user_id: "u-1", ticker: "PETR4", asset_class: "Ações", currency: "BRL", quantity: 10, average_price: 10 },
        { id: "a-2", user_id: "u-1", ticker: "HGLG11", asset_class: "FIIs", currency: "BRL", quantity: 10, average_price: 10 },
      ];
      const rows = [
        { assetId: "a-1", ticker: "PETR4", valueBRL: 100, pct: 76.9, assetClass: "Ações" },
        { assetId: "a-2", ticker: "HGLG11", valueBRL: 30, pct: 23.1, assetClass: "FIIs" },
      ];
      // Base 130: Ações alvo 70% (91 vs 100 -> sem déficit? use 60/40: Ações 60%=78 vs 100 superávit; use 80/20? wait:)
      // Use base 130: Ações 50% (65 vs 100 superávit) vs 70%/30%: 70%=91 vs 100 -> superávit! Use 80/20? FIIs 20%=26 vs 30 superávit!
      // Instead keep 2 rows totaling 130 + RF: 870 => 1000! Wait: with investable sum 130, set Ações 60% (alvo 78 vs atual 50) & FIIs 40% (alvo 52 vs atual 10)? Total current = 130 means at least 1 class has surplus unless sum class targets = 100%: wait if Ações 100/130? Use RF asset with value 870!
      const assets3: PortfolioAsset[] = [
        ...assetsWithTwoClasses,
        { id: "a-3", user_id: "u-1", ticker: "TESOURO SELIC", asset_class: "Renda Fixa", currency: "BRL", quantity: 1, average_price: 870 },
      ];
      const rows3 = [
        ...rows,
        { assetId: "a-3", ticker: "TESOURO SELIC", valueBRL: 870, pct: 87, assetClass: "Renda Fixa" },
      ];
      // Total 1000. Ações: alvo 200 (20%), atual 100 -> déficit rel 50%. FIIs: alvo 100 (10%), atual 30 -> déficit rel 70%.
      const classTargets = [
        { name: "Ações", target_percentage: 20 },
        { name: "FIIs", target_percentage: 10 },
        { name: "Renda Fixa", target_percentage: 70 },
      ];
      const suggestions = buildAporteSuggestions(assets3, rows3, 1000, 3, classTargets);
      expect(suggestions.map((s) => s.ticker)).toEqual(["HGLG11", "PETR4"]);
    });

    it("retorna lista vazia quando não há metas ou patrimônio zerado", () => {
      expect(buildAporteSuggestions(mockAssets, mockRows, 10000, 3, [])).toEqual([]);
      expect(buildAporteSuggestions(mockAssets, mockRows, 0, 3, mockClassTargets)).toEqual([]);
    });

    it("suporta metas setoriais escopadas e ignora setores com meta 0%", () => {
      const sectorAssets: PortfolioAsset[] = [
        { id: "a-1", user_id: "u-1", ticker: "ITUB4", asset_class: "Ações", sector: "Financeiro / Bancos", currency: "BRL", quantity: 10, average_price: 10 },
        { id: "a-2", user_id: "u-1", ticker: "TAEE11", asset_class: "Ações", sector: "Energia Elétrica", currency: "BRL", quantity: 10, average_price: 10 },
      ];
      const rows = [
        { assetId: "a-1", ticker: "ITUB4", valueBRL: 100, pct: 50, assetClass: "Ações", sector: "Financeiro / Bancos" },
        { assetId: "a-2", ticker: "TAEE11", valueBRL: 100, pct: 50, assetClass: "Ações", sector: "Energia Elétrica" },
      ];
      const classTargets = [{ name: "Ações", target_percentage: 100 }];
      const sectorTargets = [
        { className: "Ações", sectorName: "Financeiro / Bancos", target_percentage: 0 },
        { className: "Ações", sectorName: "Energia Elétrica", target_percentage: 100 },
      ];

      const suggestions = buildAporteSuggestions(sectorAssets, rows, 200, 3, classTargets, sectorTargets);
      expect(suggestions.map((s) => s.ticker)).toEqual(["TAEE11"]);
      expect(suggestions.find((s) => s.ticker === "ITUB4")).toBeUndefined();
    });

    it("não sugere ativos pertencentes a classes sobre-alocadas no wizard (ex: Internacional 40% vs 25% meta)", () => {
      const assets: PortfolioAsset[] = [
        { id: "a-1", user_id: "u-1", ticker: "AAPL", asset_class: "Internacional", currency: "USD", quantity: 4, average_price: 100 },
        { id: "a-2", user_id: "u-1", ticker: "PETR4", asset_class: "Ações", currency: "BRL", quantity: 20, average_price: 30 },
      ];
      const rows = [
        { assetId: "a-1", ticker: "AAPL", valueBRL: 400, pct: 40, assetClass: "Internacional" },
        { assetId: "a-2", ticker: "PETR4", valueBRL: 600, pct: 60, assetClass: "Ações" },
      ];
      const classTargets = [
        { name: "Internacional", target_percentage: 25 },
        { name: "Ações", target_percentage: 75 },
      ];

      const suggestions = buildAporteSuggestions(assets, rows, 1000, 3, classTargets);
      // Apenas PETR4 (Ações Brasil) deve ser sugerido, AAPL está em classe acima da meta
      expect(suggestions.map((s) => s.ticker)).toEqual(["PETR4"]);
      expect(suggestions.find((s) => s.ticker === "AAPL")).toBeUndefined();
    });
  });

  describe("getStocksProfile e getFiiMacroCategory — Estabilidade e Proteção contra Recursão", () => {
    it("resolve perfil de ações sem cair em recursão infinita mesmo quando setor não é informado ou é genérico", async () => {
      const { getStocksProfile } = await import("./tickers-catalog");

      // Ticker com setor não mapeado diretamente na string mas presente no catálogo (ex: VALE3 com setor Mineração)
      const resVale = getStocksProfile(null, "VALE3");
      expect(resVale.profile).toBe("commodities");
      expect(resVale.capSize).toBe("large_cap");

      // Ação com setor explicitado diretamente
      const resItub = getStocksProfile("Financeiro / Bancos", "ITUB4");
      expect(resItub.profile).toBe("defensivo_besst");
      expect(resItub.capSize).toBe("large_cap");

      // Ticker desconhecido e setor desconhecido não entra em loop infinito
      const resDesconhecido = getStocksProfile("Setor Desconhecido", "UNKNOWN3");
      expect(resDesconhecido.profile).toBe("outros_indices");
      expect(resDesconhecido.capSize).toBe("mid_cap");
    });

    it("resolve macrocategoria de FIIs sem recursão", async () => {
      const { getFiiMacroCategory } = await import("./tickers-catalog");

      expect(getFiiMacroCategory(null, "HGLG11")).toBe("tijolo");
      expect(getFiiMacroCategory(null, "MXRF11")).toBe("papel");
      expect(getFiiMacroCategory(null, "UNKNOWN11")).toBe("outros");
    });
  });
});
