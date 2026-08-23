import { describe, expect, it } from "vitest";
import {
  assetMetadataSchema,
  assetTickerSchema,
  newAssetSchema,
  quickTransactionSchema,
} from "./schemas";

describe("schemas — Módulo de Investimentos (Fase 41)", () => {
  describe("assetTickerSchema", () => {
    it("converte tickers para caixa alta e remove espaços", () => {
      const result = assetTickerSchema.parse("  petr4  ");
      expect(result).toBe("PETR4");
    });

    it("valida tickers da B3 e internacionais", () => {
      expect(assetTickerSchema.parse("MXRF11")).toBe("MXRF11");
      expect(assetTickerSchema.parse("AAPL")).toBe("AAPL");
      expect(assetTickerSchema.parse("IVVB11")).toBe("IVVB11");
      expect(assetTickerSchema.parse("TESOURO-SELIC")).toBe("TESOURO-SELIC");
      expect(assetTickerSchema.parse("BTC")).toBe("BTC");
    });

    it("rejeita tickers vazios ou com caracteres proibidos", () => {
      expect(() => assetTickerSchema.parse("")).toThrow();
      expect(() => assetTickerSchema.parse("PETR@4")).toThrow();
      expect(() => assetTickerSchema.parse("A".repeat(25))).toThrow();
    });
  });

  describe("newAssetSchema", () => {
    it("valida e normaliza a criação de um novo ativo válido", () => {
      const input = {
        ticker: "  vale3 ",
        asset_class: "Ações",
        currency: "BRL" as const,
        quantity: 100,
        average_price: 65.5,
        target_percentage: 15,
        notes: " Aporte para longo prazo ",
      };
      const parsed = newAssetSchema.parse(input);
      expect(parsed.ticker).toBe("VALE3");
      expect(parsed.asset_class).toBe("Ações");
      expect(parsed.quantity).toBe(100);
      expect(parsed.average_price).toBe(65.5);
      expect(parsed.target_percentage).toBe(15);
      expect(parsed.notes).toBe("Aporte para longo prazo");
    });

    it("rejeita valores negativos", () => {
      expect(() =>
        newAssetSchema.parse({
          ticker: "PETR4",
          asset_class: "Ações",
          quantity: -10,
          average_price: 35,
        }),
      ).toThrow();

      expect(() =>
        newAssetSchema.parse({
          ticker: "PETR4",
          asset_class: "Ações",
          quantity: 10,
          average_price: -5,
        }),
      ).toThrow();

      expect(() =>
        newAssetSchema.parse({
          ticker: "PETR4",
          asset_class: "Ações",
          quantity: 10,
          average_price: 35,
          target_percentage: 105,
        }),
      ).toThrow();
    });
  });

  describe("quickTransactionSchema", () => {
    it("valida ordem de compra com quantidade e preço", () => {
      const parsed = quickTransactionSchema.parse({
        asset_id: "asset-123",
        type: "buy",
        date: "2026-08-22",
        quantity: 10,
        price: 38.5,
        total: 385.0,
        syncCash: true,
        recordContribution: true,
      });
      expect(parsed.type).toBe("buy");
      expect(parsed.total).toBe(385.0);
    });

    it("valida ordem de provento apenas com valor total", () => {
      const parsed = quickTransactionSchema.parse({
        asset_id: "asset-123",
        type: "dividend",
        date: "2026-08-22",
        quantity: 0,
        price: 0,
        total: 45.8,
      });
      expect(parsed.type).toBe("dividend");
      expect(parsed.total).toBe(45.8);
    });

    it("valida evento de desdobramento (split)", () => {
      const parsed = quickTransactionSchema.parse({
        asset_id: "asset-123",
        type: "split",
        date: "2026-08-22",
        quantity: 2,
        price: 0,
        total: 0,
      });
      expect(parsed.type).toBe("split");
      expect(parsed.quantity).toBe(2);
    });

    it("rejeita ordem de compra com quantidade zerada", () => {
      expect(() =>
        quickTransactionSchema.parse({
          asset_id: "asset-123",
          type: "buy",
          date: "2026-08-22",
          quantity: 0,
          price: 38.5,
          total: 0,
        }),
      ).toThrow();
    });
  });

  describe("assetMetadataSchema", () => {
    it("valida e normaliza edição de metadados cadastrais", () => {
      const parsed = assetMetadataSchema.parse({
        ticker: "  mxrf11 ",
        asset_class: "FIIs",
        currency: "BRL",
        notes: " Fundo imobiliário de papel ",
      });
      expect(parsed.ticker).toBe("MXRF11");
      expect(parsed.notes).toBe("Fundo imobiliário de papel");
    });
  });
});
