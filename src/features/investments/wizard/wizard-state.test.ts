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

describe("wizard-state — Máquina de Estados do Investment Wizard (Fase 41)", () => {
  it("parseNumber trata decimais com vírgula e ponto com robustez", () => {
    expect(parseNumber("10")).toBe(10);
    expect(parseNumber("10,5")).toBe(10.5);
    expect(parseNumber(" 1.234,56 ")).toBe(1234.56);
    expect(parseNumber("-5")).toBe(0);
    expect(parseNumber("abc")).toBe(0);
  });

  it("retorna 3 passos para aporte em ativo existente e 4 passos para novo ativo", () => {
    expect(getWizardSteps("existing_aporte").length).toBe(3);
    expect(getWizardSteps("new_asset").length).toBe(4);
  });

  describe("canProceed", () => {
    it("valida modo existing_aporte", () => {
      const mockAsset: PortfolioAsset = {
        id: "a-1",
        user_id: "u-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 35.0,
      };

      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "existing_aporte",
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
    it("calcula novo preço médio ponderado no aporte", () => {
      const mockAsset: PortfolioAsset = {
        id: "a-1",
        user_id: "u-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 30.0,
      };

      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "existing_aporte",
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

    it("calcula split inteligente de débito de caixa", () => {
      const mockAsset: PortfolioAsset = {
        id: "a-1",
        user_id: "u-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 30.0,
      };

      const state: InvestmentWizardState = {
        ...defaultWizardState,
        mode: "existing_aporte",
        selectedAsset: mockAsset,
        quantityStr: "10",
        priceCents: 5000, // R$ 500 total
        syncCash: true,
      };

      // Tendo apenas R$ 200 em caixa
      const preview = calculateInvestmentPreview(state, 200);
      expect(preview.totalOrderValueBRL).toBe(500);
      expect(preview.cashDebitBRL).toBe(200);
      expect(preview.contributionBRL).toBe(300);
    });
  });
});
