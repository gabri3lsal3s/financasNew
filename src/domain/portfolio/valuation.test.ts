import { describe, expect, it } from "vitest";
import {
  applySpikeGuardrail,
  calculatePositionSummary,
  FALLBACK_USD_RATE,
  fallbackPriceFor,
  inferCurrencyFromTicker,
  isCashAssetClass,
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
      expect(summary.isCash).toBe(false);
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
  });
});

