import { describe, expect, it } from "vitest";
import { normalizeSpaces } from "../formatters";
import {
  buildCashGapBreakdown,
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

    it("deduz a Reserva de Caixa Meu Negócio (PJ) como passo explícito na memória de cálculo quando houver caixa PJ", () => {
      const breakdown = buildSafeToSpendBreakdown({
        realCashBalanceCents: 500000, // R$ 5.000 em conta compartilhada
        openInvoicesCents: 100000,    // R$ 1.000
        payablePendingCents: 50000,   // R$ 500
        derivedBusinessCashCents: 150000, // R$ 1.500 reservados para a PJ
        committedObligationsCents: 300000, // R$ 3.000 (1000 + 500 + 1500)
        safeToSpendCents: 200000,          // R$ 2.000 (5000 - 3000)
        includeReceivablesInTotal: false,
      });

      // Passos: Saldo em Contas, Obrigações do Ciclo (1500) e Reserva Caixa PJ (1500)
      expect(breakdown.steps).toHaveLength(3);
      expect(breakdown.steps[0]?.rawValue).toBe(500000);
      expect(breakdown.steps[1]?.rawValue).toBe(150000); // 1000 + 500
      expect(breakdown.steps[2]?.label).toBe("Reserva Caixa Meu Negócio (PJ)");
      expect(breakdown.steps[2]?.rawValue).toBe(150000);
      expect(breakdown.steps[2]?.operator).toBe("-");

      expect(breakdown.result.rawValue).toBe(200000);
      expect(breakdown.formulaExpression).toContain("Reserva Caixa PJ");
    });
  });

  describe("buildCashGapBreakdown", () => {
    it("detalha saldo atual, obrigações causadoras e entradas previstas em regime de caixa", () => {
      const breakdown = buildCashGapBreakdown({
        currentBalanceCents: 100000,
        predictedInflowsTotalCents: 50000,
        result: {
          isCashGapDetected: true,
          severity: "warning",
          gapDate: "2026-08-20",
          daysUntilGap: 5,
          maxDeficitCents: 150000,
          nextInflowDate: "2026-08-25",
          causingObligations: [
            {
              id: "inv-1",
              name: "Fatura Nubank",
              dueDate: "2026-08-20",
              amountCents: 250000,
              kind: "invoice",
            },
          ],
          recommendationMessage: "Risco de saldo negativo em 20/08.",
          runway: [],
        },
      });

      expect(breakdown.id).toBe("dash-cash-gap");
      expect(breakdown.steps.some((s) => s.label === "Fatura Nubank" && s.rawValue === 250000)).toBe(true);
      expect(breakdown.steps.some((s) => s.label === "Entradas Previstas até o Déficit" && s.rawValue === 50000)).toBe(true);
      expect(breakdown.result.rawValue).toBe(-150000);
      expect(breakdown.notes?.[0]).toContain("Lente Caixa estrita");
    });

    it("exibe data real vencida para faturas atrasadas e filtra entradas posteriores ao gapDate", () => {
      const breakdown = buildCashGapBreakdown({
        currentBalanceCents: 50000,
        predictedInflows: [
          { expectedDate: "2026-11-24", amountCents: 10000 },
          { expectedDate: "2026-11-30", amountCents: 200000 }, // após gapDate -> não entra
        ],
        result: {
          isCashGapDetected: true,
          severity: "critical",
          gapDate: "2026-11-24",
          daysUntilGap: 0,
          maxDeficitCents: 40000,
          nextInflowDate: "2026-11-30",
          causingObligations: [
            {
              id: "invoice-c1-2026-08",
              name: "Fatura Rico (2026-08)",
              dueDate: "2026-11-24",
              nominalDueDate: "2026-08-10",
              isOverdue: true,
              amountCents: 100000,
              kind: "invoice",
            },
          ],
          recommendationMessage: "Risco de saldo negativo.",
          runway: [],
        },
      });

      const invStep = breakdown.steps.find((s) => s.label === "Fatura Rico (2026-08)");
      expect(invStep?.hint).toBe("Vencida em 10/08/2026 — exigível hoje");
      const inflowStep = breakdown.steps.find((s) => s.label === "Entradas Previstas até o Déficit");
      expect(inflowStep?.rawValue).toBe(10000);
    });
  });
});
