import { describe, expect, it } from "vitest";
import type { PortfolioAsset } from "@/types";
import {
  parseIssuerFromTicker,
  inferMacroSector,
  inferEtfBenchmark,
  isDiversifiedVehicle,
} from "./tickers-catalog";
import {
  buildConsolidatedRiskVectors,
  calculatePortfolioHHI,
  calculateEffectiveNumberAssets,
  calculatePortfolioDiversification,
} from "./diversification-metrics";
import {
  evaluatePortfolioStructuralRisk,
  DEFAULT_PORTFOLIO_RISK_POLICY,
  resolvePortfolioRiskPolicy,
} from "./portfolio-risk-policy";

describe("Fase 1 — Domínio Puro: Política Central de Risco, Parser Blindado e Métricas Nef", () => {
  describe("parseIssuerFromTicker — Inferência Blindada de Emissor", () => {
    it("reconhece títulos soberanos federais (Tesouro Nacional)", () => {
      const cases = [
        { ticker: "TESOURO SELIC 2029", name: "Tesouro Selic" },
        { ticker: "TESOURO-IPCA-2035", name: null },
        { ticker: "LFT 2026", name: "Letra Financeira do Tesouro" },
        { ticker: "NTN-B 2030", name: "Nota do Tesouro Nacional Série B" },
        { ticker: "TD-PREFIXADO", name: "Tesouro Prefixado 2027" },
      ];

      for (const c of cases) {
        const issuer = parseIssuerFromTicker(c.ticker, c.name);
        expect(issuer.issuerKey).toBe("tesouro_nacional");
        expect(issuer.issuerLabel).toBe("Tesouro Nacional");
        expect(issuer.isSovereign).toBe(true);
      }
    });

    it("reconhece CDBs com nomes simples e aliases institucionais", () => {
      const btg = parseIssuerFromTicker("CDB BANCO BTG PACTUAL 110% CDI");
      expect(btg.issuerKey).toBe("btg");
      expect(btg.issuerLabel).toBe("BTG Pactual");
      expect(btg.isSovereign).toBe(false);

      const inter = parseIssuerFromTicker("CDB INTER LIQUIDEZ DIARIA 100% CDI");
      expect(inter.issuerKey).toBe("banco_inter");
      expect(inter.issuerLabel).toBe("Banco Inter");

      const master = parseIssuerFromTicker("LCI BANCO MASTER IPCA+ 6.5%");
      expect(master.issuerKey).toBe("banco_master");
      expect(master.issuerLabel).toBe("Banco Master");
    });

    it("suporta nomes compostos longos com DO BRASIL", () => {
      const bb1 = parseIssuerFromTicker("CDB BANCO DO BRASIL 102% CDI");
      expect(bb1.issuerKey).toBe("banco_do_brasil");
      expect(bb1.issuerLabel).toBe("Banco do Brasil");

      const bb2 = parseIssuerFromTicker("LCA BB PRE 10.5% 2026");
      expect(bb2.issuerKey).toBe("banco_do_brasil");
      expect(bb2.issuerLabel).toBe("Banco do Brasil");
    });

    it("suporta hífens internos em nomes compostos antes de sufixos de vencimento", () => {
      const btgHyphen = parseIssuerFromTicker("CDB-BTG-PACTUAL-AGO27");
      expect(btgHyphen.issuerKey).toBe("btg");
      expect(btgHyphen.issuerLabel).toBe("BTG Pactual");

      const interHyphen = parseIssuerFromTicker("LCA-BANCO-INTER-95-CDI-2028");
      expect(interHyphen.issuerKey).toBe("banco_inter");
      expect(interHyphen.issuerLabel).toBe("Banco Inter");
    });

    it("usa fallback de name apenas quando ticker for genérico (sem concatenar previamente)", () => {
      // Ticker genérico, mas name contém instituição
      const fallback = parseIssuerFromTicker("CDB-POS-01", "CDB Banco Pine 115% CDI");
      expect(fallback.issuerKey).toBe("banco_pine");
      expect(fallback.issuerLabel).toBe("Banco Pine");

      // Ticker com emissor prevalece sobre name
      const tickerPriority = parseIssuerFromTicker("CDB BANCO DAYCOVAL", "Título de Renda Fixa");
      expect(tickerPriority.issuerKey).toBe("banco_daycoval");
      expect(tickerPriority.issuerLabel).toBe("Banco Daycoval");
    });

    it("retorna chave canônica e rótulo amigável para emissores sem alias pré-definido", () => {
      const custom = parseIssuerFromTicker("CDB BANCO VOITER 112% CDI");
      expect(custom.issuerKey).toBe("voiter");
      expect(custom.issuerLabel).toBe("Voiter");
      expect(custom.isSovereign).toBe(false);
    });

    it("retorna emissor_privado para formatos desconhecidos ou vazios", () => {
      const unknown = parseIssuerFromTicker("TITULO-DESCONHECIDO");
      expect(unknown.issuerKey).toBe("emissor_privado");
      expect(unknown.issuerLabel).toBe("Emissor Privado");
      expect(unknown.isSovereign).toBe(false);
    });
  });

  describe("inferMacroSector & inferEtfBenchmark & isDiversifiedVehicle", () => {
    it("agrupa setores em clusters macro-setoriais fundamentais", () => {
      // Macro-Financeiro
      expect(inferMacroSector({ ticker: "ITUB4", assetClass: "Ações", sector: "Financeiro / Bancos" })).toBe("macro_financeiro");
      expect(inferMacroSector({ ticker: "BBSE3", assetClass: "Ações", sector: "Seguros e Previdência" })).toBe("macro_financeiro");

      // Macro-Commodities
      expect(inferMacroSector({ ticker: "PETR4", assetClass: "Ações", sector: "Petróleo, Gás e Combustíveis" })).toBe("macro_commodities");
      expect(inferMacroSector({ ticker: "VALE3", assetClass: "Ações", sector: "Mineração e Siderurgia" })).toBe("macro_commodities");
      expect(inferMacroSector({ ticker: "SUZB3", assetClass: "Ações", sector: "Papel e Celulose" })).toBe("macro_commodities");

      // Macro-Utilities
      expect(inferMacroSector({ ticker: "TAEE11", assetClass: "Ações", sector: "Energia Elétrica" })).toBe("macro_utilities");
      expect(inferMacroSector({ ticker: "SBSP3", assetClass: "Ações", sector: "Saneamento e Utilidades" })).toBe("macro_utilities");

      // Macro-Real Estate
      expect(inferMacroSector({ ticker: "HGLG11", assetClass: "FIIs", sector: "Imobiliário / Logística" })).toBe("macro_real_estate");

      // Não agrupa renda fixa ou caixa
      expect(inferMacroSector({ ticker: "TESOURO", assetClass: "Renda Fixa" })).toBeUndefined();
    });

    it("identifica o benchmark compartilhado de ETFs", () => {
      expect(inferEtfBenchmark({ ticker: "IVVB11" })).toBe("sp500");
      expect(inferEtfBenchmark({ ticker: "SPXI11" })).toBe("sp500");
      expect(inferEtfBenchmark({ ticker: "VOO" })).toBe("sp500");
      expect(inferEtfBenchmark({ ticker: "NASD11" })).toBe("nasdaq100");
      expect(inferEtfBenchmark({ ticker: "QQQ" })).toBe("nasdaq100");
      expect(inferEtfBenchmark({ ticker: "BOVA11" })).toBe("ibovespa");
      expect(inferEtfBenchmark({ ticker: "BRAX11" })).toBe("ibrx100");
      expect(inferEtfBenchmark({ ticker: "WRLD11" })).toBe("all_world");
      expect(inferEtfBenchmark({ ticker: "VT" })).toBe("all_world");
      expect(inferEtfBenchmark({ ticker: "BITB" })).toBe("bitcoin");
    });

    it("identifica veículos estruturalmente diversificados", () => {
      // Tesouro e ETFs de índice amplo = true
      expect(isDiversifiedVehicle({ ticker: "TESOURO SELIC" })).toBe(true);
      expect(isDiversifiedVehicle({ ticker: "VOO" })).toBe(true);
      expect(isDiversifiedVehicle({ ticker: "WRLD11" })).toBe(true);
      expect(isDiversifiedVehicle({ ticker: "BOVA11" })).toBe(true);

      // Ações individuais ou CDBs = false
      expect(isDiversifiedVehicle({ ticker: "PETR4" })).toBe(false);
      expect(isDiversifiedVehicle({ ticker: "VALE3" })).toBe(false);
      expect(isDiversifiedVehicle({ ticker: "CDB BANCO INTER" })).toBe(false);
    });
  });

  describe("HHI e Número Efetivo de Ativos (Nef)", () => {
    it("retorna null e evita NaN para carteiras vazias ou com valor total zero", () => {
      expect(calculatePortfolioHHI([])).toBeNull();
      expect(calculateEffectiveNumberAssets(null)).toBeNull();

      const zeroAssets: PortfolioAsset[] = [
        {
          id: "1",
          user_id: "u1",
          ticker: "PETR4",
          currency: "BRL",
          quantity: 0,
          average_price: 35,
          asset_class: "Ações",
        },
      ];
      expect(calculatePortfolioHHI(zeroAssets)).toBeNull();
      expect(calculateEffectiveNumberAssets(0)).toBeNull();

      const summary = calculatePortfolioDiversification(zeroAssets);
      expect(summary.totalValueBRL).toBe(0);
      expect(summary.globalHHI).toBeNull();
      expect(summary.globalNef).toBeNull();
      expect(summary.consolidatedVectors).toHaveLength(0);
    });

    it("calcula HHI = 1.0 e Nef = 1.0 para carteira de ativo único", () => {
      const singleAsset: PortfolioAsset[] = [
        {
          id: "1",
          user_id: "u1",
          ticker: "VALE3",
          currency: "BRL",
          quantity: 100,
          average_price: 60,
          asset_class: "Ações",
        },
      ];

      const hhi = calculatePortfolioHHI(singleAsset);
      const nef = calculateEffectiveNumberAssets(hhi);
      expect(hhi).toBe(1);
      expect(nef).toBe(1);
    });

    it("calcula HHI = 0.25 e Nef = 4.0 para 4 ações perfeitamente balanceadas (25% cada)", () => {
      const balancedAssets: PortfolioAsset[] = [
        { id: "1", user_id: "u1", ticker: "PETR4", currency: "BRL", quantity: 100, average_price: 25, asset_class: "Ações" },
        { id: "2", user_id: "u1", ticker: "VALE3", currency: "BRL", quantity: 100, average_price: 25, asset_class: "Ações" },
        { id: "3", user_id: "u1", ticker: "ITUB4", currency: "BRL", quantity: 100, average_price: 25, asset_class: "Ações" },
        { id: "4", user_id: "u1", ticker: "WEGE3", currency: "BRL", quantity: 100, average_price: 25, asset_class: "Ações" },
      ];

      const hhi = calculatePortfolioHHI(balancedAssets);
      const nef = calculateEffectiveNumberAssets(hhi);

      // 4 * (0.25^2) = 4 * 0.0625 = 0.25
      expect(hhi).toBe(0.25);
      // 1 / 0.25 = 4
      expect(nef).toBe(4);
    });

    it("consolida títulos de Renda Fixa privada do mesmo emissor no mesmo vetor de risco", () => {
      // 3 CDBs distintos do Banco Master (R$ 10.000 cada) + 1 CDB do BTG (R$ 10.000)
      // Total = R$ 40.000. Master representa R$ 30.000 (75%) e BTG R$ 10.000 (25%).
      const rfAssets: PortfolioAsset[] = [
        { id: "1", user_id: "u1", ticker: "CDB BANCO MASTER 120% CDI", currency: "BRL", quantity: 100, average_price: 100, asset_class: "Renda Fixa" },
        { id: "2", user_id: "u1", ticker: "LCI BANCO MASTER IPCA+ 6%", currency: "BRL", quantity: 100, average_price: 100, asset_class: "Renda Fixa" },
        { id: "3", user_id: "u1", ticker: "CDB-MASTER-PREFIXADO-2027", currency: "BRL", quantity: 100, average_price: 100, asset_class: "Renda Fixa" },
        { id: "4", user_id: "u1", ticker: "CDB BANCO BTG PACTUAL 105% CDI", currency: "BRL", quantity: 100, average_price: 100, asset_class: "Renda Fixa" },
      ];

      const { vectors, totalValueBRL } = buildConsolidatedRiskVectors(rfAssets);
      expect(totalValueBRL).toBe(40000);
      expect(vectors).toHaveLength(2); // Agrupou os 3 Master em 1 único vetor de risco

      const masterVector = vectors.find((v) => v.key === "rf_issuer_banco_master");
      expect(masterVector).toBeDefined();
      expect(masterVector?.valueBRL).toBe(30000);
      expect(masterVector?.weightPct).toBe(75);

      // HHI real agrupado: 0.75^2 + 0.25^2 = 0.5625 + 0.0625 = 0.625
      const hhi = calculatePortfolioHHI(rfAssets);
      expect(hhi).toBe(0.625);

      // Nef real = 1 / 0.625 = 1.6 ativos equivalentes (em vez de 4.0 artificial)
      const nef = calculateEffectiveNumberAssets(hhi);
      expect(nef).toBe(1.6);
    });

    it("consolida ETFs que replicam o mesmo benchmark (ex: IVVB11 e VOO)", () => {
      // 1 ETF B3 de R$ 5.000 (IVVB11) e 1 ETF US de US$ 1.000 (câmbio 5.0 = R$ 5.000 VOO)
      // Ambos replicam S&P 500 -> 100% no mesmo benchmark
      const etfAssets: PortfolioAsset[] = [
        { id: "1", user_id: "u1", ticker: "IVVB11", currency: "BRL", quantity: 50, average_price: 100, asset_class: "ETFs" },
        { id: "2", user_id: "u1", ticker: "VOO", currency: "USD", quantity: 10, average_price: 100, asset_class: "Internacional" },
      ];

      const { vectors, totalValueBRL } = buildConsolidatedRiskVectors(etfAssets, { fxRateUSD: 5.0 });
      expect(totalValueBRL).toBe(10000);
      expect(vectors).toHaveLength(1);
      expect(vectors[0]?.key).toBe("etf_benchmark_sp500");
      expect(vectors[0]?.weightPct).toBe(100);

      const hhi = calculatePortfolioHHI(etfAssets, { fxRateUSD: 5.0 });
      expect(hhi).toBe(1);
      const nef = calculateEffectiveNumberAssets(hhi);
      expect(nef).toBe(1);
    });

    it("calcula métricas de descentralização por subportfólio de classe", () => {
      const mixedAssets: PortfolioAsset[] = [
        // Renda Fixa Soberana R$ 80.000 (80% da carteira)
        { id: "1", user_id: "u1", ticker: "TESOURO SELIC 2029", currency: "BRL", quantity: 80, average_price: 1000, asset_class: "Renda Fixa" },
        // Ações R$ 20.000 (2 ações: PETR4 R$ 18.000 e VALE3 R$ 2.000)
        { id: "2", user_id: "u1", ticker: "PETR4", currency: "BRL", quantity: 600, average_price: 30, asset_class: "Ações" },
        { id: "3", user_id: "u1", ticker: "VALE3", currency: "BRL", quantity: 40, average_price: 50, asset_class: "Ações" },
      ];

      const summary = calculatePortfolioDiversification(mixedAssets);
      expect(summary.totalValueBRL).toBe(100000);

      // Subportfólio de Ações: R$ 20.000 total. PETR4 = 90% (w=0.9), VALE3 = 10% (w=0.1)
      // HHI Ações = 0.9^2 + 0.1^2 = 0.81 + 0.01 = 0.82
      // Nef Ações = 1 / 0.82 = 1.22
      const stockSummary = summary.byClass["Ações"];
      expect(stockSummary).toBeDefined();
      expect(stockSummary?.classValueBRL).toBe(20000);
      expect(stockSummary?.classHHI).toBe(0.82);
      expect(stockSummary?.classNef).toBe(1.22);
    });
  });

  describe("evaluatePortfolioStructuralRisk — Alertas Puros do Carrossel de Insights", () => {
    it("dispara alerta de hiperconcentração em ativo único quando peso >= 25%", () => {
      const assets: PortfolioAsset[] = [
        { id: "1", user_id: "u1", ticker: "PETR4", currency: "BRL", quantity: 300, average_price: 30, asset_class: "Ações" }, // R$ 9.000 (90%)
        { id: "2", user_id: "u1", ticker: "VALE3", currency: "BRL", quantity: 20, average_price: 50, asset_class: "Ações" },  // R$ 1.000 (10%)
      ];

      const alerts = evaluatePortfolioStructuralRisk(assets);
      expect(alerts.some((a) => a.type === "single_asset_concentration")).toBe(true);
      const petrAlert = alerts.find((a) => a.type === "single_asset_concentration");
      expect(petrAlert?.title).toContain("PETR4");
      expect(petrAlert?.tone).toBe("critical");
      expect(petrAlert?.ctaText).toBe("Simular Rebalanceamento");
    });

    it("dispara alerta de FGC / emissor privado quando exposição excede R$ 250.000", () => {
      const assets: PortfolioAsset[] = [
        {
          id: "1",
          user_id: "u1",
          ticker: "CDB BANCO MASTER 120% CDI",
          currency: "BRL",
          quantity: 2600,
          average_price: 100, // R$ 260.000 (> R$ 250k)
          asset_class: "Renda Fixa",
        },
        {
          id: "2",
          user_id: "u1",
          ticker: "TESOURO SELIC 2029",
          currency: "BRL",
          quantity: 100,
          average_price: 1000, // R$ 100.000
          asset_class: "Renda Fixa",
        },
      ];

      const alerts = evaluatePortfolioStructuralRisk(assets);
      const fgcAlert = alerts.find((a) => a.type === "private_issuer_fgc");
      expect(fgcAlert).toBeDefined();
      expect(fgcAlert?.tone).toBe("critical");
      expect(fgcAlert?.description).toContain("FGC");
      expect(fgcAlert?.ctaText).toBe("Ver Renda Fixa");
    });

    it("dispara alerta de macro-setor quando Bancos + Seguros concentram > 45% das ações", () => {
      const assets: PortfolioAsset[] = [
        // Macro Financeiro: ITUB4 R$ 3.000 + BBSE3 R$ 3.000 = R$ 6.000 (60% de R$ 10.000 em ações)
        { id: "1", user_id: "u1", ticker: "ITUB4", currency: "BRL", quantity: 100, average_price: 30, asset_class: "Ações", sector: "Financeiro / Bancos" },
        { id: "2", user_id: "u1", ticker: "BBSE3", currency: "BRL", quantity: 100, average_price: 30, asset_class: "Ações", sector: "Seguros e Previdência" },
        // Outros setores
        { id: "3", user_id: "u1", ticker: "WEGE3", currency: "BRL", quantity: 50, average_price: 40, asset_class: "Ações", sector: "Bens de Capital / Máquinas" },
        { id: "4", user_id: "u1", ticker: "RADL3", currency: "BRL", quantity: 80, average_price: 25, asset_class: "Ações", sector: "Saúde / Farmácias" },
      ];

      const alerts = evaluatePortfolioStructuralRisk(assets);
      const macroAlert = alerts.find((a) => a.type === "macro_sector_concentration");
      expect(macroAlert).toBeDefined();
      expect(macroAlert?.tone).toBe("warning");
      expect(macroAlert?.title).toContain("Financeiro");
    });

    it("dispara alerta de sobreposição excessiva de benchmark em ETFs (> 30% da carteira)", () => {
      const assets: PortfolioAsset[] = [
        // S&P 500 duplicado somando R$ 50.000 (50% de R$ 100.000)
        { id: "1", user_id: "u1", ticker: "IVVB11", currency: "BRL", quantity: 250, average_price: 100, asset_class: "ETFs" },
        { id: "2", user_id: "u1", ticker: "SPXI11", currency: "BRL", quantity: 250, average_price: 100, asset_class: "ETFs" },
        // Ações R$ 50.000
        { id: "3", user_id: "u1", ticker: "VALE3", currency: "BRL", quantity: 1000, average_price: 50, asset_class: "Ações" },
      ];

      const alerts = evaluatePortfolioStructuralRisk(assets);
      const overlapAlert = alerts.find((a) => a.type === "benchmark_overlap");
      expect(overlapAlert).toBeDefined();
      expect(overlapAlert?.tone).toBe("info");
      expect(overlapAlert?.title).toContain("S&P 500");
    });

    it("respeita customizações parciais da política de risco e mantém defaults", () => {
      expect(DEFAULT_PORTFOLIO_RISK_POLICY.defaultAssetCeilingPct).toBe(15);
      expect(DEFAULT_PORTFOLIO_RISK_POLICY.maxPrivateIssuerFgcBRL).toBe(250_000);

      const policy = resolvePortfolioRiskPolicy({
        defaultAssetCeilingPct: 20,
        maxPrivateIssuerFgcBRL: 200_000,
      });

      expect(policy.defaultAssetCeilingPct).toBe(20);
      expect(policy.maxPrivateIssuerFgcBRL).toBe(200_000);
      // Mantém os defaults para os não sobrescritos
      expect(policy.diversifiedAssetCeilingPct).toBe(40);
      expect(policy.macroSectorInClassCeilingPct).toBe(45);
    });
  });
});
