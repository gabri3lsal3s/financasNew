import { describe, expect, it } from "vitest";
import {
  applySpikeGuardrail,
  FALLBACK_USD_RATE,
  fallbackPriceFor,
  inferCurrencyFromTicker,
  resolvePrice,
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
      const valuation = valueAssetPosition(3, resolved, "BRL");
      expect(valuation.manual).toBe(true);
      expect(valuation.valueBRL).toBeCloseTo(127.5, 6);
    });
  });
});
