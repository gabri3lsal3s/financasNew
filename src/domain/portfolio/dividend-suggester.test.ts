import { describe, expect, it } from "vitest";
import { calculateSuggestedDividends, getCustodyAtComDate } from "./dividend-suggester";
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

      const qtyAtCom = getCustodyAtComDate(assetPetr, txs, "2026-05-31");
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

      const qtyAtCom = getCustodyAtComDate(assetPetr, txs, "2026-05-31");
      expect(qtyAtCom).toBe(60);
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
  });
});
