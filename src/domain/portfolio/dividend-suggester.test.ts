import { describe, expect, it } from "vitest";
import {
  calculateSuggestedDividends,
  getCustodyAtComDate,
  resolveDividendAntiFloodCutoff,
} from "./dividend-suggester";
import type { CorporateDividend, PortfolioAsset, PortfolioTransaction } from "@/types";

describe("dividend-suggester: Apuração de Proventos na Data COM", () => {
  const assetPetr: PortfolioAsset = {
    id: "asset-petr",
    user_id: "user-1",
    ticker: "PETR4",
    asset_class: "Ações",
    currency: "BRL",
    quantity: 100,
    average_price: 30,
  };

  const assetVale: PortfolioAsset = {
    id: "asset-vale",
    user_id: "user-1",
    ticker: "VALE3",
    asset_class: "Ações",
    currency: "BRL",
    quantity: 50,
    average_price: 60,
  };

  describe("getCustodyAtComDate", () => {
    it("deve calcular custódia considerando compras antes da data COM e ignorando compras posteriores", () => {
      const txs: PortfolioTransaction[] = [
        {
          id: "t1",
          user_id: "user-1",
          asset_id: "asset-petr",
          type: "buy",
          date: "2026-05-10",
          quantity: 100,
          price: 30,
          total: 3000,
        },
        {
          id: "t2",
          user_id: "user-1",
          asset_id: "asset-petr",
          type: "buy",
          date: "2026-06-05", // Após a data COM de 2026-05-31
          quantity: 50,
          price: 32,
          total: 1600,
        },
      ];

      const qtyAtCom = getCustodyAtComDate({ ...assetPetr, quantity: 150 }, txs, "2026-05-31");
      expect(qtyAtCom).toBe(100);
    });

    it("deve abater vendas ocorridas antes da data COM", () => {
      const txs: PortfolioTransaction[] = [
        {
          id: "t1",
          user_id: "user-1",
          asset_id: "asset-petr",
          type: "buy",
          date: "2026-05-10",
          quantity: 100,
          price: 30,
          total: 3000,
        },
        {
          id: "t2",
          user_id: "user-1",
          asset_id: "asset-petr",
          type: "sell",
          date: "2026-05-20",
          quantity: 40,
          price: 35,
          total: 1400,
        },
      ];

      const qtyAtCom = getCustodyAtComDate({ ...assetPetr, quantity: 60 }, txs, "2026-05-31");
      expect(qtyAtCom).toBe(60);
    });

    it("deve preservar custódia baseline pré-ledger combinada com movimentações posteriores", () => {
      const txsWithSell: PortfolioTransaction[] = [
        {
          id: "t1",
          user_id: "user-1",
          asset_id: "asset-petr",
          type: "buy",
          date: "2026-05-10",
          quantity: 100,
          price: 30,
          total: 3000,
        },
        {
          id: "t2",
          user_id: "user-1",
          asset_id: "asset-petr",
          type: "sell",
          date: "2026-05-20",
          quantity: 40,
          price: 35,
          total: 1400,
        },
      ];

      // Saldo final declarado = 100 e ledger líquido = +60 -> baseline pré-ledger = 40 -> na COM = 40 + 100 - 40 = 100
      const qtyBaselineWithSell = getCustodyAtComDate(
        { ...assetPetr, quantity: 100 },
        txsWithSell,
        "2026-05-31",
      );
      expect(qtyBaselineWithSell).toBe(100);

      const txsFutureBuy: PortfolioTransaction[] = [
        {
          id: "t3",
          user_id: "user-1",
          asset_id: "asset-petr",
          type: "buy",
          date: "2026-06-05",
          quantity: 50,
          price: 32,
          total: 1600,
        },
      ];

      // Saldo final declarado = 150 com compra posterior de 50 -> baseline na COM = 100
      const qtyBaselineFutureBuy = getCustodyAtComDate(
        { ...assetPetr, quantity: 150 },
        txsFutureBuy,
        "2026-05-31",
      );
      expect(qtyBaselineFutureBuy).toBe(100);
    });
  });

  describe("calculateSuggestedDividends", () => {
    const corpEvents: CorporateDividend[] = [
      {
        id: "corp-div-1",
        ticker: "PETR4",
        type: "DIVIDENDO",
        com_date: "2026-10-15",
        payment_date: "2026-11-05", // Já liquidado relativo a 2026-11-06
        rate: 1.25,
        net_rate: 1.25,
        currency: "BRL",
      },
      {
        id: "corp-div-2",
        ticker: "VALE3",
        type: "JCP",
        com_date: "2026-10-20",
        payment_date: "2026-11-25", // Futuro / Previsto
        rate: 2.0,
        net_rate: 1.7, // após IR 15%
        currency: "BRL",
      },
      {
        id: "corp-div-3",
        ticker: "PETR4",
        type: "RENDIMENTO",
        com_date: "2026-10-10",
        payment_date: "2026-11-01",
        rate: 0.5,
        net_rate: 0.5,
        currency: "BRL",
      },
    ];

    it("deve sugerir proventos separando por disponíveis e previstos", () => {
      const result = calculateSuggestedDividends({
        corporateEvents: corpEvents,
        dismissals: [
          // Evento corp-div-3 foi dispensado
          {
            id: "d1",
            user_id: "user-1",
            corporate_dividend_id: "corp-div-3",
            reason: "manual_ignore",
          },
        ],
        assets: [assetPetr, assetVale],
        transactions: [], // usa quantidade declarada
        manualDividends: [],
        referenceDate: "2026-11-06",
      });

      // Disponível: PETR4 (payment_date 2026-11-05 <= 2026-11-06)
      expect(result.available).toHaveLength(1);
      expect(result.available[0]?.ticker).toBe("PETR4");
      expect(result.available[0]?.totalAmount).toBe(125); // 100 * 1.25
      expect(result.totalAvailableAmount).toBe(125);

      // Previsto: VALE3 (payment_date 2026-11-25 > 2026-11-06)
      expect(result.projected).toHaveLength(1);
      expect(result.projected[0]?.ticker).toBe("VALE3");
      expect(result.projected[0]?.totalAmount).toBe(85); // 50 * 1.70
      expect(result.totalProjectedAmount).toBe(85);
    });

    it("deve ignorar proventos já lançados manualmente pelo usuário (deduplicação)", () => {
      const result = calculateSuggestedDividends({
        corporateEvents: corpEvents,
        dismissals: [],
        assets: [assetPetr, assetVale],
        transactions: [],
        manualDividends: [
          // Já lançou manualmente o provento de PETR4
          {
            id: "manual-1",
            user_id: "user-1",
            asset_id: "asset-petr",
            ticker: "PETR4",
            date: "2026-11-05",
            amount: 125,
          },
        ],
        referenceDate: "2026-11-06",
      });

      // O evento corp-div-1 (R$ 125) deve ter sido filtrado pela deduplicação
      const hasCorp1 = result.available.some((d) => d.corporateDividendId === "corp-div-1");
      expect(hasCorp1).toBe(false);
      // Já o evento corp-div-3 (R$ 50) não lançado manualmente permanece disponível
      const hasCorp3 = result.available.some((d) => d.corporateDividendId === "corp-div-3");
      expect(hasCorp3).toBe(true);
    });

    it("trata payment_date nula como provisionado (projected), reconcilia baseline+split e segrega USD/BRL", () => {
      const assetUsd: PortfolioAsset = {
        id: "asset-aapl",
        user_id: "user-1",
        ticker: "AAPL",
        asset_class: "Internacional",
        currency: "USD",
        quantity: 20, // baseline 10 antes de split 2:1 em 2026-11-05
        average_price: 150,
      };
      const txs: PortfolioTransaction[] = [
        {
          id: "tx-split",
          user_id: "user-1",
          asset_id: "asset-aapl",
          type: "split",
          date: "2026-11-05",
          quantity: 2,
          price: 0,
          total: 0,
        },
      ];
      const events: CorporateDividend[] = [
        {
          id: "c-no-date",
          ticker: "PETR4",
          type: "DIVIDENDO",
          com_date: "2026-11-01",
          payment_date: null,
          rate: 0.5,
          net_rate: 0.5,
          currency: "BRL",
        },
        {
          id: "c-us",
          ticker: "AAPL",
          type: "DIVIDENDO",
          com_date: "2026-11-02", // Antes do split 2:1 -> custódia = 10
          payment_date: "2026-11-06",
          rate: 1.0,
          net_rate: 0.7,
          tax_rate_pct: 30,
          currency: "USD",
          provider: "yahoo",
          is_type_uncertain: false,
        },
      ];

      const res = calculateSuggestedDividends({
        corporateEvents: events,
        dismissals: [],
        assets: [assetPetr, assetUsd],
        transactions: txs,
        manualDividends: [],
        referenceDate: "2026-11-10",
        usdRate: 5.5,
      });

      expect(res.projected).toHaveLength(1);
      expect(res.projected[0]?.paymentDate).toBeNull();
      expect(res.totalProjectedBRL).toBe(50);

      expect(res.available).toHaveLength(1);
      expect(res.available[0]?.ticker).toBe("AAPL");
      expect(res.available[0]?.quantityOnComDate).toBe(10);
      expect(res.available[0]?.totalAmount).toBe(7); // 10 * 0.70 USD
      expect(res.totalAvailableUSD).toBe(7);
      expect(res.totalAvailableAmount).toBe(38.5); // 7 * 5.50 BRL
      expect(resolveDividendAntiFloodCutoff("2026-11-08", "2026-11-10", 7)).toBe("2026-11-08");
    });
  });
});
