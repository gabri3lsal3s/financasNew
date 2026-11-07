import { describe, expect, it } from "vitest";
import {
  isDividendLiquidationDue,
  validateDividendReversalSafeguard,
} from "./dividend-cash-governance";

describe("dividend-cash-governance: Liquidação e Estorno Seguro no Caixa", () => {
  describe("isDividendLiquidationDue", () => {
    it("deve permitir liquidação quando data de pagamento for igual ou anterior à data de referência", () => {
      expect(isDividendLiquidationDue("2026-11-05", "2026-11-06")).toBe(true);
      expect(isDividendLiquidationDue("2026-11-06", "2026-11-06")).toBe(true);
    });

    it("deve bloquear liquidação de proventos futuros (previstos)", () => {
      expect(isDividendLiquidationDue("2026-11-20", "2026-11-06")).toBe(false);
    });
  });

  describe("validateDividendReversalSafeguard", () => {
    it("deve considerar seguro quando o saldo de caixa cobre integralmente o estorno", () => {
      const result = validateDividendReversalSafeguard(500, 150);
      expect(result.isSafe).toBe(true);
      expect(result.newBalance).toBe(350);
      expect(result.shortfall).toBe(0);
      expect(result.warningMessage).toBeUndefined();
    });

    it("deve alertar e apontar déficit quando parte dos recursos já foi reinvestida", () => {
      const result = validateDividendReversalSafeguard(50, 150);
      expect(result.isSafe).toBe(false);
      expect(result.newBalance).toBe(0);
      expect(result.shortfall).toBe(100);
      expect(result.warningMessage).toContain("menor que o estorno");
      expect(result.warningMessage).toContain("já foi reinvestido");
    });
  });
});
