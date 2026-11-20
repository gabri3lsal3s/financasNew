import { describe, expect, it } from "vitest";
import { normalizeSpaces } from "../formatters";
import {
  buildRealCashBreakdown,
  buildSafeToSpendBreakdown,
} from "./cash-breakdown";

describe("Builders de Memória de Cálculo: Cash", () => {
  describe("buildRealCashBreakdown", () => {
    it("constrói a memória com checkpoint âncora", () => {
      const breakdown = buildRealCashBreakdown({
        currentBalanceCents: 520000,
        latestCheckpoint: {
          id: "chk-1",
          date: "2026-11-15",
          balanceCents: 500000,
        },
        checkpointBalanceCents: 500000,
        inflowSinceCheckpointCents: 100000,
        outflowSinceCheckpointCents: 80000,
        referenceDate: "2026-11-20",
      });

      expect(breakdown.id).toBe("dash-real-cash");
      expect(breakdown.title).toBe("Saldo Disponível em Conta");
      expect(breakdown.formulaExpression).toContain("Saldo do Checkpoint + Entradas Posteriores − Saídas Posteriores");
      expect(breakdown.steps).toHaveLength(3);
      expect(breakdown.steps[0]?.label).toContain("15/11/2026");
      expect(normalizeSpaces(breakdown.steps[0]?.formattedValue ?? "")).toBe("R$ 5.000,00");
      expect(normalizeSpaces(breakdown.steps[1]?.formattedValue ?? "")).toBe("R$ 1.000,00");
      expect(normalizeSpaces(breakdown.steps[2]?.formattedValue ?? "")).toBe("R$ 800,00");
      expect(breakdown.result.rawValue).toBe(520000);
      expect(normalizeSpaces(breakdown.result.formattedValue ?? "")).toBe("R$ 5.200,00");
      expect(breakdown.inclusions).toBeDefined();
      expect(breakdown.exclusions).toBeDefined();
    });

    it("constrói a memória sem checkpoint (acumulado do fluxo)", () => {
      const breakdown = buildRealCashBreakdown({
        currentBalanceCents: 350000,
        latestCheckpoint: null,
        checkpointBalanceCents: 0,
        inflowSinceCheckpointCents: 1000000,
        outflowSinceCheckpointCents: 650000,
        referenceDate: "2026-11-20",
      });

      expect(breakdown.steps).toHaveLength(2);
      expect(breakdown.formulaExpression).toBe("Entradas Acumuladas − Saídas Acumuladas");
      expect(breakdown.result.rawValue).toBe(350000);
      expect(normalizeSpaces(breakdown.result.formattedValue ?? "")).toBe("R$ 3.500,00");
    });
  });

  describe("buildSafeToSpendBreakdown (Cura do Bug AUD-01)", () => {
    it("visão prudencial conservadora: exclui recebíveis da equação principal e fecha centavo a centavo", () => {
      const breakdown = buildSafeToSpendBreakdown({
        realCashBalanceCents: 500000, // R$ 5.000
        openInvoicesCents: 150000,    // R$ 1.500
        payablePendingCents: 50000,   // R$ 500
        committedObligationsCents: 200000, // R$ 2.000
        receivablePendingCents: 100000,    // R$ 1.000
        safeToSpendCents: 300000,          // R$ 3.000 (5000 - 2000)
        safeToSpendWithReceivablesCents: 400000,
        includeReceivablesInTotal: false,
      });

      expect(breakdown.id).toBe("dash-safe-to-spend");
      // Na visão conservadora, os passos são apenas: Saldo em Contas e Obrigações
      expect(breakdown.steps).toHaveLength(2);
      expect(breakdown.steps[0]?.rawValue).toBe(500000);
      expect(breakdown.steps[1]?.rawValue).toBe(200000);
      expect(breakdown.steps[1]?.operator).toBe("-");

      // O total é rigorosamente 5.000 - 2.000 = 3.000
      expect(breakdown.result.rawValue).toBe(300000);
      expect(normalizeSpaces(breakdown.result.formattedValue ?? "")).toBe("R$ 3.000,00");
      expect(breakdown.formulaExpression).toBe("Saldo em Conta − Obrigações do Ciclo");
    });

    it("visão otimista com recebíveis: soma recebíveis na equação e bate exatamente com o total", () => {
      const breakdown = buildSafeToSpendBreakdown({
        realCashBalanceCents: 500000, // R$ 5.000
        openInvoicesCents: 150000,
        payablePendingCents: 50000,
        committedObligationsCents: 200000, // R$ 2.000
        receivablePendingCents: 100000,    // R$ 1.000
        safeToSpendCents: 300000,
        safeToSpendWithReceivablesCents: 400000, // R$ 4.000 (5000 + 1000 - 2000)
        includeReceivablesInTotal: true,
      });

      expect(breakdown.steps).toHaveLength(3);
      expect(breakdown.steps[0]?.rawValue).toBe(500000);
      expect(breakdown.steps[1]?.label).toContain("A Receber");
      expect(breakdown.steps[1]?.operator).toBe("+");
      expect(breakdown.steps[1]?.rawValue).toBe(100000);
      expect(breakdown.steps[2]?.operator).toBe("-");
      expect(breakdown.steps[2]?.rawValue).toBe(200000);

      // Total é rigorosamente 5.000 + 1.000 - 2.000 = 4.000
      expect(breakdown.result.rawValue).toBe(400000);
      expect(normalizeSpaces(breakdown.result.formattedValue ?? "")).toBe("R$ 4.000,00");
      expect(breakdown.formulaExpression).toBe("Saldo em Conta + Recebíveis Previstos − Obrigações do Ciclo");
    });
  });
});
