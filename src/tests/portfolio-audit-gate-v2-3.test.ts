/**
 * Portão de Qualidade v2.3 (Gate v2.3)
 * Certificação do Motor Cambial Híbrido e Layout PDF Internacional (§Bloco 3).
 *
 * Módulo puro e desacoplado de banco, React e UI.
 */

import { describe, expect, it } from "vitest";
import { computeCanonicalAssetLedger } from "@/domain/portfolio/canonical-normalizer";
import { evaluatePortfolioCanonicalState } from "@/domain/portfolio/canonical-engine";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

describe("Portão de Qualidade v2.3 (Gate v2.3) — Motor Cambial FX Híbrido e Layout Internacional", () => {
  describe("Critério 1: Congelamento de Custo Histórico em BRL via fx_rate_at_purchase", () => {
    it("congela o custo histórico em BRL quando a compra informa taxa de câmbio histórica", () => {
      // Compra de 10 VOO a US$ 400 com câmbio histórico PTAX de R$ 5,0000 (Custo BRL: R$ 20.000,00)
      const txs = [
        {
          date: "2024-01-15",
          type: "buy",
          quantity: 10,
          price: 400,
          total: 4000,
          fx_rate: 5.0, // Câmbio histórico de compra
        },
      ];

      const ledger = computeCanonicalAssetLedger(txs, undefined, {
        currency: "USD",
        defaultFxRate: 5.5, // PTAX atual mais alta
      });

      expect(ledger.quantity).toBe(10);
      expect(ledger.totalCost).toBe(4000); // US$ 4.000,00
      expect(ledger.totalCostBRL).toBe(20000); // R$ 20.000,00 congelado pelo câmbio da compra (5,00)
    });

    it("aplica assetFxRateAtPurchase para posições retroativas com câmbio médio cadastrado", () => {
      const txs = [
        {
          date: "2024-06-01",
          type: "buy",
          quantity: 5,
          price: 100,
          total: 500,
        },
      ];

      const ledger = computeCanonicalAssetLedger(txs, undefined, {
        currency: "USD",
        assetFxRateAtPurchase: 4.85, // Câmbio médio informado
        defaultFxRate: 5.25,
      });

      expect(ledger.totalCostBRL).toBe(2425); // 500 * 4.85 = R$ 2.425,00
    });

    it("produz retorno total em BRL diferente do retorno em USD quando há variação cambial real", () => {
      // Compra a US$ 100 com câmbio R$ 5,00 (Custo BRL: R$ 500,00)
      // Cotação atual: US$ 110 (+10,0% em USD). PTAX atual: R$ 5,50 (+10,0% no câmbio).
      // Valor atual em BRL: 110 * 5,50 = R$ 605,00. Retorno em BRL: (605 - 500) / 500 = +21,0%!
      const asset: PortfolioAsset = {
        id: "asset-voo-fx",
        user_id: "u1",
        ticker: "VOO",
        asset_class: "Internacional",
        currency: "USD",
        quantity: 1,
        average_price: 100,
        fx_rate_at_purchase: 5.0,
        notes: null,
        score: null,
        allocation_status: "active",
        thesis_summary: null,
        score_criteria: null,
        last_reviewed_at: null,
      };

      const tx: PortfolioTransaction = {
        id: "tx-voo-1",
        user_id: "u1",
        asset_id: "asset-voo-fx",
        type: "buy",
        date: "2024-01-15",
        quantity: 1,
        price: 100,
        total: 100,
        fx_rate: 5.0,
      };

      const state = evaluatePortfolioCanonicalState({
        asOfDate: "2026-11-18",
        assets: [asset],
        transactions: [tx],
        cashBalance: 0,
        usdRate: 5.5,
        assetPrices: {
          VOO: 110,
        },
      });

      const holding = state.holdings[0];
      expect(holding).toBeDefined();
      expect(holding?.totalCostBRL).toBe(500.0); // 100 * 5.0
      expect(holding?.marketValueBRL).toBe(605.0); // 110 * 5.5
      expect(holding?.unrealizedPnl).toBe(105.0); // 605 - 500
      expect(holding?.unrealizedPct).toBe(21.0); // +21,0% em BRL vs +10,0% em USD
    });
  });

  describe("Critério 2: Transparência Metodológica no Modo Retroativo", () => {
    it("usa fallback de PTAX atual para posições sem câmbio histórico informado preservando congruência", () => {
      const asset: PortfolioAsset = {
        id: "asset-gld-retro",
        user_id: "u1",
        ticker: "GLD",
        asset_class: "Internacional",
        currency: "USD",
        quantity: 2,
        average_price: 150, // Custo US$ 300,00
        notes: null,
        score: null,
        allocation_status: "active",
        thesis_summary: null,
        score_criteria: null,
        last_reviewed_at: null,
      };

      const state = evaluatePortfolioCanonicalState({
        asOfDate: "2026-11-18",
        assets: [asset],
        transactions: [],
        cashBalance: 0,
        usdRate: 5.25,
        assetPrices: {
          GLD: 165, // +10% em USD
        },
      });

      const holding = state.holdings[0];
      expect(holding?.totalCostBRL).toBe(1575.0); // 300 * 5.25
      expect(holding?.marketValueBRL).toBe(1732.5); // 330 * 5.25
      expect(holding?.unrealizedPct).toBe(10.0); // +10% em BRL idêntico a USD pela estimativa PTAX
    });
  });
});
