import { describe, expect, it } from "vitest";
import {
  calculateInvestmentPreview,
  canProceed,
  defaultWizardState,
  getWizardSteps,
  parseNumber,
  type InvestmentWizardState,
} from "./wizard-state";
import type { PortfolioAsset } from "@/types";

describe("wizard-state — Máquina de Estados do Investment Wizard (Fase 41 & Modelo B)", () => {
  it("parseNumber trata decimais com vírgula e ponto com robustez", () => {
    expect(parseNumber("10")).toBe(10);
    expect(parseNumber("10,5")).toBe(10.5);
    expect(parseNumber(" 1.234,56 ")).toBe(1234.56);
    expect(parseNumber("-5")).toBe(0);
    expect(parseNumber("abc")).toBe(0);
  });

  it("retorna 3 passos para operações em ativos existentes e 4 passos para novo ativo", () => {
    expect(getWizardSteps("buy").length).toBe(3);
    expect(getWizardSteps("sell").length).toBe(3);
    expect(getWizardSteps("dividend").length).toBe(3);
    expect(getWizardSteps("split").length).toBe(3);
    expect(getWizardSteps("new_asset").length).toBe(4);
  });

  describe("canProceed", () => {
    const mockAsset: PortfolioAsset = {
      id: "a-1",
      user_id: "u-1",
      ticker: "PETR4",
      asset_class: "Ações",
      currency: "BRL",
      quantity: 100,
      average_price: 35.0,
    };

    it("valida modo buy / existing_aporte", () => {
      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "buy",
        step: 1,
        selectedAsset: mockAsset,
        ticker: "PETR4",
      };

      expect(canProceed(state)).toBe(true);

      // Passo 2 sem quantidade deve bloquear
      const step2Invalid: InvestmentWizardState = {
        ...state,
        step: 2,
        quantityStr: "",
        priceCents: 3850,
      };
      expect(canProceed(step2Invalid)).toBe(false);

      // Passo 2 com quantidade e preço válidos pode avançar
      const step2Valid: InvestmentWizardState = {
        ...state,
        step: 2,
        quantityStr: "10",
        priceCents: 3850,
      };
      expect(canProceed(step2Valid)).toBe(true);
    });

    it("valida modo sell (bloqueia se quantidade exceder custódia)", () => {
      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "sell",
        step: 2,
        selectedAsset: mockAsset,
        ticker: "PETR4",
        quantityStr: "150", // Excede 100 cotas
        priceCents: 4000,
      };
      expect(canProceed(state)).toBe(false);

      expect(canProceed({ ...state, quantityStr: "50" })).toBe(true);
    });

    it("valida modo dividend (requer total > 0)", () => {
      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "dividend",
        step: 2,
        selectedAsset: mockAsset,
        totalCents: 0,
      };
      expect(canProceed(state)).toBe(false);
      expect(canProceed({ ...state, totalCents: 4580 })).toBe(true);
    });

    it("valida modo split (requer fator >= 2)", () => {
      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "split",
        step: 2,
        selectedAsset: mockAsset,
        splitFactor: 1,
      };
      expect(canProceed(state)).toBe(false);
      expect(canProceed({ ...state, splitFactor: 2 })).toBe(true);
    });

    it("valida modo new_asset", () => {
      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "new_asset",
        step: 1,
        ticker: "WEGE3",
        assetClass: "Ações",
      };
      expect(canProceed(state)).toBe(true);

      // Passo 1 sem ticker bloqueia
      expect(canProceed({ ...state, ticker: "" })).toBe(false);

      // Passo 2 com quantidade e preço
      expect(canProceed({ ...state, step: 2, quantityStr: "100", priceCents: 5000 })).toBe(true);
      expect(canProceed({ ...state, step: 2, quantityStr: "0", priceCents: 5000 })).toBe(false);

      // Passo 3 meta válida
      expect(canProceed({ ...state, step: 3, targetPercentage: 15 })).toBe(true);
      expect(canProceed({ ...state, step: 3, targetPercentage: 120 })).toBe(false);
    });
  });

  describe("calculateInvestmentPreview", () => {
    const mockAsset: PortfolioAsset = {
      id: "a-1",
      user_id: "u-1",
      ticker: "PETR4",
      asset_class: "Ações",
      currency: "BRL",
      quantity: 100,
      average_price: 30.0,
    };

    it("calcula novo preço médio ponderado no aporte", () => {
      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "buy",
        selectedAsset: mockAsset,
        quantityStr: "100",
        priceCents: 4000, // R$ 40,00
      };

      const preview = calculateInvestmentPreview(state);
      expect(preview.currentQuantity).toBe(100);
      expect(preview.currentAveragePrice).toBe(30.0);
      expect(preview.newQuantity).toBe(200);
      expect(preview.newAveragePrice).toBe(35.0); // (100*30 + 100*40) / 200 = 35
      expect(preview.totalOrderValueBRL).toBe(4000);
    });

    it("calcula ganho de capital na venda", () => {
      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "sell",
        selectedAsset: mockAsset,
        assetClass: "Ações",
        quantityStr: "50",
        priceCents: 4000, // Venda a R$ 40,00 (PM 30,00 -> Lucro 10,00 * 50 = 500)
      };

      const preview = calculateInvestmentPreview(state);
      expect(preview.newQuantity).toBe(50);
      expect(preview.realizedPnl).toBe(500);
      expect(preview.realizedPnlPct).toBeCloseTo(33.33, 1);
    });

    it("calcula desdobramento / split com preservação de custo", () => {
      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "split",
        selectedAsset: mockAsset,
        splitFactor: 2,
      };

      const preview = calculateInvestmentPreview(state);
      expect(preview.newQuantity).toBe(200);
      expect(preview.newAveragePrice).toBe(15.0);
    });

    it("valida e calcula Aporte em Renda Fixa / Tesouro Direto sem exigência de cotas", () => {
      const rfAsset: PortfolioAsset = {
        id: "rf-1",
        user_id: "u-1",
        ticker: "TESOURO-SELIC",
        asset_class: "Renda Fixa",
        currency: "BRL",
        quantity: 1,
        average_price: 1496.51,
        notes: "",
      };

      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "buy",
        step: 2,
        selectedAsset: rfAsset,
        ticker: "TESOURO-SELIC",
        assetClass: "Renda Fixa",
        quantityStr: "", // Sem cotas
        priceCents: 19636, // R$ 196,36
        totalCents: 19636,
      };

      // canProceed deve permitir avançar sem quantidade de cotas
      expect(canProceed(state)).toBe(true);

      // preview deve somar ao saldo aplicado
      const preview = calculateInvestmentPreview(state);
      expect(preview.currentAveragePrice).toBe(1496.51);
      expect(preview.newAveragePrice).toBeCloseTo(1692.87, 2);
      expect(preview.totalOrderValueBRL).toBe(196.36);
    });

    it("valida e calcula Resgate em Renda Fixa / Tesouro Direto", () => {
      const rfAsset: PortfolioAsset = {
        id: "rf-1",
        user_id: "u-1",
        ticker: "CDB 110% CDI",
        asset_class: "Renda Fixa",
        currency: "BRL",
        quantity: 1,
        average_price: 5000.0,
      };

      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "sell",
        step: 2,
        selectedAsset: rfAsset,
        ticker: "CDB 110% CDI",
        assetClass: "Renda Fixa",
        totalCents: 200000, // R$ 2.000,00
      };

      expect(canProceed(state)).toBe(true);

      const preview = calculateInvestmentPreview(state);
      expect(preview.newAveragePrice).toBe(3000.0);
      expect(preview.totalOrderValueBRL).toBe(2000.0);

      // Bloqueia se valor do resgate for maior que o limite máximo disponível sem metadados
      expect(canProceed({ ...state, totalCents: 600000 })).toBe(false);
    });

    it("permite e calcula resgate total e liquidação de Renda Fixa pelo valor rentabilizado acumulado", () => {
      const rfAssetWithGrowth: PortfolioAsset = {
        id: "rf-growth-1",
        user_id: "u-1",
        ticker: "CDB-FACTA",
        asset_class: "Renda Fixa",
        currency: "BRL",
        quantity: 1,
        average_price: 1236.27, // Custo inicial aplicado
        fixed_income_metadata: {
          rate_type: "pre",
          rate_value: 15.0, // 15% a.a. pré
          base_date: "2025-01-01",
          initial_investment_date: "2025-01-01",
          maturity_date: "2026-09-02",
          is_tax_exempt: false,
          base_value: 1236.27,
        },
      };

      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "sell",
        step: 2,
        selectedAsset: rfAssetWithGrowth,
        ticker: "CDB-FACTA",
        assetClass: "Renda Fixa",
        date: "2026-09-02",
        syncCash: true,
        totalCents: 140000, // R$ 1.400,00 (maior que o aplicado R$ 1.236,27 devido aos juros)
      };

      // canProceed deve permitir valor rentabilizado
      expect(canProceed(state)).toBe(true);

      const preview = calculateInvestmentPreview(state);
      expect(preview.totalOrderValueBRL).toBe(1400.0);
      expect(preview.newQuantity).toBe(0); // Liquidação total
      expect(preview.newAveragePrice).toBe(0);
      expect(preview.cashCreditBRL).toBeGreaterThan(1236.27);
      expect(preview.realizedPnl).toBeGreaterThan(0);
    });

    it("calcula preview de compra de ativo em USD convertendo impacto em caixa e aporte para BRL", () => {
      const usdAsset: PortfolioAsset = {
        id: "usd-1",
        user_id: "u-1",
        ticker: "AAPL",
        asset_class: "Internacional",
        currency: "USD",
        quantity: 10,
        average_price: 150.0,
      };

      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "buy",
        selectedAsset: usdAsset,
        currency: "USD",
        quantityStr: "5",
        priceCents: 20000, // $ 200.00
        syncCash: true,
        recordContribution: true,
      };

      // usdRate = 5.0 -> Ordem: 5 * $200 = $1,000.00 -> BRL: R$ 5.000,00
      // Caixa disponível: R$ 3.000,00 -> Débito: R$ 3.000,00 -> Aporte adicional: R$ 2.000,00
      // Novo PM: (10 * 150 + 5 * 200) / 15 = $ 166.67
      const preview = calculateInvestmentPreview(state, 3000, 5.0);
      expect(preview.currentQuantity).toBe(10);
      expect(preview.currentAveragePrice).toBe(150.0);
      expect(preview.newQuantity).toBe(15);
      expect(preview.newAveragePrice).toBeCloseTo(166.67, 2);
      expect(preview.totalOrderValueNative).toBe(1000.0);
      expect(preview.totalOrderValueBRL).toBe(5000.0);
      expect(preview.cashDebitBRL).toBe(3000.0);
      expect(preview.contributionBRL).toBe(2000.0);
    });

    it("calcula preview de provento de ativo em USD convertendo total para BRL", () => {
      const usdAsset: PortfolioAsset = {
        id: "usd-1",
        user_id: "u-1",
        ticker: "AAPL",
        asset_class: "Internacional",
        currency: "USD",
        quantity: 10,
        average_price: 150.0,
      };

      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "dividend",
        selectedAsset: usdAsset,
        currency: "USD",
        totalCents: 5000, // $ 50.00
        syncCash: true,
      };

      // usdRate = 5.20 -> $50.00 * 5.20 = R$ 260.00
      const preview = calculateInvestmentPreview(state, 0, 5.2);
      expect(preview.totalOrderValueNative).toBe(50.0);
      expect(preview.totalOrderValueBRL).toBe(260.0);
      expect(preview.cashCreditBRL).toBe(260.0);
    });
  });
});
