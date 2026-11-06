import { describe, it, expect } from "vitest";
import {
  calculateFamilyEmergencyReserveHealth,
  calculateFamilyPassiveIncomeRunrate,
  calculateGoalProgress,
  isAssetCashLike,
  isAssetSharedWithFamily,
} from "./wealth";

describe("Motor Puro de Patrimônio & Metas Familiares (wealth.ts)", () => {
  describe("calculateFamilyEmergencyReserveHealth", () => {
    it("classifica como crítico se a reserva cobrir menos de 3 meses", () => {
      // Gastos: R$ 5.000,00 (500000 cents). Reserva: R$ 10.000,00 (1000000 cents) -> 2 meses
      const report = calculateFamilyEmergencyReserveHealth(1000000, 500000);
      expect(report.months_covered).toBe(2);
      expect(report.status).toBe("critical");
      expect(report.label).toBe("Crítico (< 3 meses)");
    });

    it("classifica como moderado se cobrir entre 3 e 5.9 meses", () => {
      // Gastos: R$ 4.000,00. Reserva: R$ 18.000,00 -> 4.5 meses
      const report = calculateFamilyEmergencyReserveHealth(1800000, 400000);
      expect(report.months_covered).toBe(4.5);
      expect(report.status).toBe("moderate");
      expect(report.label).toBe("Moderado (3 a 6 meses)");
    });

    it("classifica como sólido se cobrir entre 6 e 11.9 meses", () => {
      // Gastos: R$ 5.000,00. Reserva: R$ 40.000,00 -> 8 meses
      const report = calculateFamilyEmergencyReserveHealth(4000000, 500000);
      expect(report.months_covered).toBe(8);
      expect(report.status).toBe("solid");
      expect(report.label).toBe("Sólido (6 a 12 meses)");
    });

    it("classifica como excelente se cobrir 12 meses ou mais", () => {
      // Gastos: R$ 5.000,00. Reserva: R$ 75.000,00 -> 15 meses
      const report = calculateFamilyEmergencyReserveHealth(7500000, 500000);
      expect(report.months_covered).toBe(15);
      expect(report.status).toBe("excellent");
      expect(report.label).toBe("Excelente (> 12 meses)");
    });

    it("lida com gastos zero ou inválidos sem quebrar (fail-safe)", () => {
      const report = calculateFamilyEmergencyReserveHealth(1000000, 0);
      expect(report.months_covered).toBe(12);
      expect(report.status).toBe("excellent");
      expect(report.progress_percent).toBe(100);
      expect(report.remaining_cents).toBe(0);
    });

    it("calcula autonomia e meta de 6 meses corretamente quando baseado no teto familiar", () => {
      // Cenário real: Reserva R$ 2.570,57 (257057 cents), Teto familiar R$ 5.000,00 (500000 cents)
      const report = calculateFamilyEmergencyReserveHealth(257057, 500000, {
        isCeiling: true,
        targetMonths: 6,
      });

      expect(report.months_covered).toBe(0.5);
      expect(report.status).toBe("critical");
      expect(report.has_ceiling).toBe(true);
      expect(report.target_months).toBe(6);
      expect(report.target_cents).toBe(3000000); // R$ 30.000,00
      expect(report.progress_percent).toBe(9); // round(257057 / 3000000 * 100) = 9%
      expect(report.remaining_cents).toBe(2742943); // R$ 27.429,43 faltantes
    });
  });

  describe("calculateFamilyPassiveIncomeRunrate", () => {
    it("calcula percentual de gastos fixos cobertos por dividendos", () => {
      // Gastos fixos: R$ 4.000,00/mês (400000 cents).
      // Proventos últimos 12 meses: R$ 24.000,00 (2400000 cents) -> R$ 2.000/mês -> 50%
      const report = calculateFamilyPassiveIncomeRunrate(2400000, 400000);
      expect(report.fixed_expenses_coverage_percent).toBe(50);
      expect(report.is_independent).toBe(false);
    });

    it("indica independência financeira quando cobertura for >= 100%", () => {
      // Gastos fixos: R$ 5.000,00/mês. Proventos 12m: R$ 60.000,00 -> 100%
      const report = calculateFamilyPassiveIncomeRunrate(6000000, 500000);
      expect(report.fixed_expenses_coverage_percent).toBe(100);
      expect(report.is_independent).toBe(true);
    });
  });

  describe("calculateGoalProgress", () => {
    it("calcula percentual com teto de 100%", () => {
      expect(calculateGoalProgress(500000, 1000000)).toBe(50);
      expect(calculateGoalProgress(1200000, 1000000)).toBe(100);
      expect(calculateGoalProgress(0, 1000000)).toBe(0);
      expect(calculateGoalProgress(500, 0)).toBe(0);
    });
  });

  describe("isAssetSharedWithFamily", () => {
    it("retorna true se share_all_portfolio for true", () => {
      expect(
        isAssetSharedWithFamily({
          share_all_portfolio: true,
          asset_class: "Ações",
          is_family: false,
        }),
      ).toBe(true);
    });

    it("retorna true se a classe do ativo estiver em shared_asset_classes", () => {
      expect(
        isAssetSharedWithFamily({
          share_all_portfolio: false,
          asset_class: "Renda Fixa",
          shared_asset_classes: ["Caixa", "Renda Fixa"],
          is_family: false,
        }),
      ).toBe(true);
    });

    it("retorna true se o ativo tiver is_family = true explicitamente", () => {
      expect(
        isAssetSharedWithFamily({
          share_all_portfolio: false,
          asset_class: "Ações",
          shared_asset_classes: ["Caixa"],
          is_family: true,
        }),
      ).toBe(true);
    });

    it("retorna false se nenhuma das 3 condições for atendida", () => {
      expect(
        isAssetSharedWithFamily({
          share_all_portfolio: false,
          asset_class: "Cripto",
          shared_asset_classes: ["Caixa", "Renda Fixa"],
          is_family: false,
        }),
      ).toBe(false);
    });
  });

  describe("isAssetCashLike", () => {
    it("reconhece classes de caixa e reserva (imune a maiúsculas e acentos)", () => {
      expect(isAssetCashLike("FUNDO-RESERVA", "Caixa")).toBe(true);
      expect(isAssetCashLike("POUPANCA", "Reserva")).toBe(true);
      expect(isAssetCashLike("EMERGENCIA", "Reserva de Emergência")).toBe(true);
      expect(isAssetCashLike("EMERGENCIA", "reserva de emergencia")).toBe(true);
    });

    it("reconhece ticker exatamente CAIXA", () => {
      expect(isAssetCashLike("CAIXA", "Outros")).toBe(true);
      expect(isAssetCashLike("caixa", null)).toBe(true);
    });

    it("reconhece tickers com SELIC ou CDI independente da classe", () => {
      expect(isAssetCashLike("TESOURO-SELIC", "Renda Fixa")).toBe(true);
      expect(isAssetCashLike("TESOURO SELIC 2029", "Títulos Públicos")).toBe(true);
      expect(isAssetCashLike("CDB BANCO INTER 100% CDI", "Renda Fixa")).toBe(true);
      expect(isAssetCashLike("LCI DI", "Renda Fixa")).toBe(false);
      expect(isAssetCashLike("CDB 110% CDI", null)).toBe(true);
    });

    it("rejeita ativos voláteis ou de longo prazo que não são reserva", () => {
      expect(isAssetCashLike("TESOURO-IPCA", "Renda Fixa")).toBe(false);
      expect(isAssetCashLike("CDB ORIGINAL", "Renda Fixa")).toBe(false);
      expect(isAssetCashLike("PETR4", "Ações")).toBe(false);
      expect(isAssetCashLike("HGLG11", "FIIs")).toBe(false);
      expect(isAssetCashLike("BTC", "Cripto")).toBe(false);
    });
  });
});
