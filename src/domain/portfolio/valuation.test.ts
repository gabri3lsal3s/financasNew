import { describe, expect, it } from "vitest";
import {
  applySpikeGuardrail,
  calculatePositionSummary,
  FALLBACK_USD_RATE,
  fallbackPriceFor,
  getAssetPricingMode,
  inferCurrencyFromTicker,
  isCashAssetClass,
  isFixedIncomeClass,
  isTesouroAsset,
  normalizeClassName,
  positionPnl,
  resolvePrice,
  usdRateFromPrices,
  valueAssetPosition,
  type ResolvedPrice,
} from "./valuation";


describe("domain/portfolio/valuation (§1.6 D5 + §3.11.2)", () => {
  describe("resolvePrice — pipeline manual → api → fallback", () => {
    it("preço manual prevalece sobre cache e fallback", () => {
      const resolved = resolvePrice({
        manualPrice: 42.5,
        cachePrice: 40,
        fallbackPrice: FALLBACK_USD_RATE,
      });
      expect(resolved).toEqual({ price: 42.5, source: "manual" });
    });

    it("sem manual, usa o cache (fonte api)", () => {
      const resolved = resolvePrice({ manualPrice: null, cachePrice: 40, fallbackPrice: FALLBACK_USD_RATE });
      expect(resolved).toEqual({ price: 40, source: "api" });
    });

    it("sem manual nem cache, usa o fallback estático", () => {
      const resolved = resolvePrice({ manualPrice: null, cachePrice: null, fallbackPrice: FALLBACK_USD_RATE });
      expect(resolved).toEqual({ price: FALLBACK_USD_RATE, source: "fallback" });
    });

    it("preço manual zero ou inválido é ignorado (cai para cache)", () => {
      const resolved = resolvePrice({ manualPrice: 0, cachePrice: 40, fallbackPrice: FALLBACK_USD_RATE });
      expect(resolved).toEqual({ price: 40, source: "api" });
    });
  });

  describe("applySpikeGuardrail — variação > 50% mantém último preço válido", () => {
    it("sem preço anterior, aceita o atual", () => {
      expect(applySpikeGuardrail(100, null)).toBe(100);
    });

    it("variação de 10% é aceita", () => {
      expect(applySpikeGuardrail(110, 100)).toBe(110);
    });

    it("variação > 50% mantém o preço anterior (dado corrompido)", () => {
      expect(applySpikeGuardrail(200, 100)).toBe(100);
      expect(applySpikeGuardrail(40, 100)).toBe(100);
    });

    it("variação exatamente de 50% é aceita (limite é > 50%)", () => {
      expect(applySpikeGuardrail(150, 100)).toBe(150);
    });

    it("preço atual inválido mantém o anterior", () => {
      expect(applySpikeGuardrail(0, 100)).toBe(100);
    });
  });

  describe("fallbackPriceFor — fallback estático por moeda", () => {
    it("USD usa a taxa fixa 5,25", () => {
      expect(fallbackPriceFor("USD")).toBe(FALLBACK_USD_RATE);
    });

    it("BRL sem dado → 0 (sem preço de mercado)", () => {
      expect(fallbackPriceFor("BRL")).toBe(0);
    });
  });

  describe("inferCurrencyFromTicker — moeda pelo padrão do ticker", () => {
    it("2–5 letras sem números = USD", () => {
      expect(inferCurrencyFromTicker("AAPL")).toBe("USD");
      expect(inferCurrencyFromTicker("MSFT")).toBe("USD");
      expect(inferCurrencyFromTicker("BTC")).toBe("USD");
    });

    it("B3/RF/cripto com número = BRL", () => {
      expect(inferCurrencyFromTicker("PETR4")).toBe("BRL");
      expect(inferCurrencyFromTicker("BOVA11")).toBe("BRL");
      expect(inferCurrencyFromTicker("IVVB11")).toBe("BRL");
    });
  });

  describe("usdRateFromPrices — taxa a partir do cache (USDBRL=X)", () => {
    it("usa a cotação quando disponível", () => {
      const rate = usdRateFromPrices([
        { ticker: "PETR4", price: 40 },
        { ticker: "USDBRL=X", price: 5.4 },
      ]);
      expect(rate).toBe(5.4);
    });

    it("sem cotação → fallback fixo (5,25)", () => {
      expect(usdRateFromPrices([{ ticker: "PETR4", price: 40 }])).toBe(FALLBACK_USD_RATE);
      expect(usdRateFromPrices([])).toBe(FALLBACK_USD_RATE);
    });

    it("cotação inválida → fallback", () => {
      expect(usdRateFromPrices([{ ticker: "USDBRL=X", price: 0 }])).toBe(FALLBACK_USD_RATE);
    });
  });

  describe("isCashAssetClass / normalizeClassName — caixa 1:1 (§3.11.2)", () => {
    it("reconhece caixa/reserva insensível a caixa e acento", () => {
      expect(isCashAssetClass("caixa")).toBe(true);
      expect(isCashAssetClass("CAIXA")).toBe(true);
      expect(isCashAssetClass("Reserva")).toBe(true);
      expect(isCashAssetClass("Ações")).toBe(false);
      expect(isCashAssetClass(null)).toBe(false);
    });

    it("normaliza acentos e caixa para comparação", () => {
      expect(normalizeClassName("Ações")).toBe("acoes");
      expect(normalizeClassName("  FIIs ")).toBe("fiis");
      expect(normalizeClassName("Fundos Imobiliários")).toBe("fundos imobiliarios");
    });
  });

  describe("valueAssetPosition — valoração em BRL com fonte", () => {
    it("BRL não converte; fonte repassada do preço resolvido", () => {
      const resolved: ResolvedPrice = { price: 40, source: "api" };
      const valuation = valueAssetPosition(10, resolved, "BRL");
      expect(valuation).toEqual({ valueBRL: 400, source: "api", manual: false });
    });

    it("USD converte pela taxa (fallback 5,25)", () => {
      const resolved: ResolvedPrice = { price: 100, source: "manual" };
      const valuation = valueAssetPosition(2, resolved, "USD");
      expect(valuation.valueBRL).toBeCloseTo(200 * FALLBACK_USD_RATE, 6);
      expect(valuation.source).toBe("manual");
      expect(valuation.manual).toBe(true);
    });

    it("preço manual é marcado como manual na valoração", () => {
      const resolved: ResolvedPrice = { price: 42.5, source: "manual" };
      const valuation = valueAssetPosition(10, resolved, "BRL");
      expect(valuation.manual).toBe(true);
    });

    it("calcula PnL consistente em USD convertendo custo e valor de mercado para BRL", () => {
      const quantity = 10;
      const totalCostUSD = 1000;
      const usdRate = 5.5; 
      const totalCostBRL = totalCostUSD * usdRate; 

      const resolved: ResolvedPrice = { price: 120, source: "api" };
      const valuation = valueAssetPosition(quantity, resolved, "USD", usdRate);
      expect(valuation.valueBRL).toBe(6600);

      const pnl = positionPnl(valuation.valueBRL, totalCostBRL);
      expect(pnl.unrealizedPnl).toBe(1100); 
      expect(pnl.unrealizedPct).toBe(20); 
    });
  });

  describe("calculatePositionSummary — Posição Consolidada O(1)", () => {
    it("ativo BRL com lucro", () => {
      const summary = calculatePositionSummary({
        quantity: 100,
        averagePrice: 30,
        assetClass: "Ações",
        currency: "BRL",
        resolvedPrice: { price: 35, source: "api" },
      });

      expect(summary.totalCost).toBe(3000);
      expect(summary.totalCostBRL).toBe(3000);
      expect(summary.valueBRL).toBe(3500);
      expect(summary.unrealizedPnl).toBe(500);
      expect(summary.unrealizedPct).toBe(16.67);
      expect(summary.totalDividends).toBe(0);
      expect(summary.totalReturnPnl).toBe(500);
      expect(summary.totalReturnPct).toBe(16.67);
      expect(summary.isCash).toBe(false);
    });

    it("ativo BRL com proventos calcula Retorno Total (cotação + proventos)", () => {
      const summary = calculatePositionSummary({
        quantity: 100,
        averagePrice: 10,
        assetClass: "FIIs",
        currency: "BRL",
        resolvedPrice: { price: 9.8, source: "api" },
        totalDividends: 120,
      });

      expect(summary.totalCostBRL).toBe(1000);
      expect(summary.valueBRL).toBe(980);
      expect(summary.unrealizedPnl).toBe(-20); // cotação caiu R$ 20
      expect(summary.unrealizedPct).toBe(-2);
      expect(summary.totalDividends).toBe(120);
      expect(summary.totalReturnPnl).toBe(100); // -20 + 120 = +100
      expect(summary.totalReturnPct).toBe(10); // +100 / 1000 = +10%
    });

    it("ativo de caixa/reserva com valor 1:1", () => {
      const summary = calculatePositionSummary({
        quantity: 5000,
        averagePrice: 1,
        assetClass: "Caixa",
        currency: "BRL",
        resolvedPrice: { price: 1, source: "fallback" },
      });

      expect(summary.totalCost).toBe(5000);
      expect(summary.valueBRL).toBe(5000);
      expect(summary.unrealizedPnl).toBe(0);
      expect(summary.unrealizedPct).toBeNull();
      expect(summary.isCash).toBe(true);
    });

    it("ativo em USD convertido pela taxa cambial", () => {
      const summary = calculatePositionSummary({
        quantity: 10,
        averagePrice: 100,
        assetClass: "Internacional",
        currency: "USD",
        resolvedPrice: { price: 120, source: "api" },
        usdRate: 5.5,
      });

      expect(summary.totalCost).toBe(1000); // 10 * 100 USD
      expect(summary.totalCostBRL).toBe(5500); // 1000 * 5.5
      expect(summary.priceBRL).toBe(660); // 120 * 5.5
      expect(summary.valueBRL).toBe(6600); // 10 * 660
      expect(summary.unrealizedPnl).toBe(1100);
      expect(summary.unrealizedPct).toBe(20);
    });

    it("ativo de Renda Fixa em modo valor completo (sem cotas, apenas preço inicial e atual)", () => {
      const summary = calculatePositionSummary({
        quantity: 1,
        averagePrice: 10000, // Preço inicial investido: R$ 10.000,00
        assetClass: "Renda Fixa",
        currency: "BRL",
        ticker: "CDB BANCO INTER",
        resolvedPrice: { price: 10850, source: "manual" }, // Preço atual / saldo: R$ 10.850,00
      });

      expect(summary.pricingMode).toBe("total_value");
      expect(summary.totalCost).toBe(10000);
      expect(summary.priceBRL).toBe(10850);
      expect(summary.valueBRL).toBe(10850);
      expect(summary.unrealizedPnl).toBe(850);
      expect(summary.unrealizedPct).toBe(8.5);
      expect(summary.isCash).toBe(false);

      // Caso com quantidade acumulada pós-ordem:
      const summaryAccumulated = calculatePositionSummary({
        quantity: 2,
        averagePrice: 846.44, // 2 * 846.44 = 1692.88
        assetClass: "Renda Fixa",
        currency: "BRL",
        ticker: "TESOURO-SELIC",
        resolvedPrice: { price: 1767.42, source: "manual" },
      });

      expect(summaryAccumulated.pricingMode).toBe("total_value");
      expect(summaryAccumulated.totalCost).toBe(1692.88);
      expect(summaryAccumulated.valueBRL).toBe(1767.42);
      expect(summaryAccumulated.unrealizedPnl).toBe(74.54);
      expect(summaryAccumulated.unrealizedPct).toBeCloseTo(4.4, 1);
    });

    it("ativo do Tesouro Direto com padrão valor completo e override por cotas", () => {
      // Padrão: Tesouro Direto é total_value
      const defaultTesouro = calculatePositionSummary({
        quantity: 1,
        averagePrice: 5000,
        assetClass: "Renda Fixa",
        currency: "BRL",
        ticker: "TESOURO-SELIC",
        resolvedPrice: { price: 5200, source: "manual" },
      });
      expect(defaultTesouro.pricingMode).toBe("total_value");
      expect(defaultTesouro.valueBRL).toBe(5200);
      expect(defaultTesouro.unrealizedPnl).toBe(200);

      // Com override [PRICING:UNIT]: Tesouro Direto em cotas/PM
      const unitTesouro = calculatePositionSummary({
        quantity: 0.5,
        averagePrice: 10000, // PM unitário de R$ 10.000 -> Custo R$ 5.000
        assetClass: "Renda Fixa",
        currency: "BRL",
        ticker: "TESOURO-IPCA",
        notes: "[PRICING:UNIT] Custódia em frações de título",
        resolvedPrice: { price: 11000, source: "api" }, // PU R$ 11.000 -> Valor R$ 5.500
      });
      expect(unitTesouro.pricingMode).toBe("unit_price");
      expect(unitTesouro.quantity).toBe(0.5);
      expect(unitTesouro.totalCost).toBe(5000);
      expect(unitTesouro.valueBRL).toBe(5500);
      expect(unitTesouro.unrealizedPnl).toBe(500);
    });
  });

  describe("isFixedIncomeClass & isTesouroAsset & getAssetPricingMode", () => {
    it("identifica classes de renda fixa", () => {
      expect(isFixedIncomeClass("Renda Fixa")).toBe(true);
      expect(isFixedIncomeClass("CDB")).toBe(true);
      expect(isFixedIncomeClass("LCI")).toBe(true);
      expect(isFixedIncomeClass("LCA")).toBe(true);
      expect(isFixedIncomeClass("Debêntures")).toBe(true);
      expect(isFixedIncomeClass("Ações")).toBe(false);
      expect(isFixedIncomeClass("FIIs")).toBe(false);
    });

    it("identifica ativos do Tesouro Direto", () => {
      expect(isTesouroAsset("TESOURO-SELIC")).toBe(true);
      expect(isTesouroAsset("TESOURO-IPCA")).toBe(true);
      expect(isTesouroAsset("LFT")).toBe(true);
      expect(isTesouroAsset("PETR4")).toBe(false);
    });

    it("determina modos de precificação padrão e customizados", () => {
      expect(getAssetPricingMode({ asset_class: "Caixa" })).toBe("cash");
      expect(getAssetPricingMode({ asset_class: "Renda Fixa", ticker: "CDB" })).toBe("total_value");
      expect(getAssetPricingMode({ asset_class: "Renda Fixa", ticker: "TESOURO-SELIC" })).toBe("total_value");
      expect(getAssetPricingMode({ asset_class: "Renda Fixa", ticker: "TESOURO-SELIC", notes: "[PRICING:UNIT]" })).toBe("unit_price");
      expect(getAssetPricingMode({ asset_class: "Ações", ticker: "PETR4" })).toBe("unit_price");
      expect(getAssetPricingMode({ asset_class: "Ações", ticker: "PETR4", notes: "[PRICING:TOTAL]" })).toBe("total_value");
    });
  });
});

