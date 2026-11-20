import { describe, expect, it } from "vitest";
import {
  enrichBreakdown,
  formatBreakdownValue,
  formatOperator,
  generatePlainTextBreakdown,
  normalizeSpaces,
} from "./formatters";
import type { CalculationBreakdown } from "./types";

describe("formatters de Memória de Cálculo", () => {
  describe("formatBreakdownValue", () => {
    it("formata moedas em centavos inteiros no padrão pt-BR", () => {
      expect(normalizeSpaces(formatBreakdownValue(154230, "currency"))).toBe("R$ 1.542,30");
      expect(normalizeSpaces(formatBreakdownValue(0, "currency"))).toBe("R$ 0,00");
      expect(normalizeSpaces(formatBreakdownValue(-5000, "currency"))).toBe("-R$ 50,00");
    });

    it("formata percentuais com vírgula pt-BR e símbolo %", () => {
      expect(formatBreakdownValue(12.345, "percent")).toBe("12,3%");
      expect(formatBreakdownValue(0, "percent")).toBe("0,0%");
      expect(formatBreakdownValue(100, "percent")).toBe("100,0%");
    });

    it("formata meses com singular e plural", () => {
      expect(formatBreakdownValue(1, "months")).toBe("1,0 mês");
      expect(formatBreakdownValue(4.5, "months")).toBe("4,5 meses");
      expect(formatBreakdownValue(0, "months")).toBe("0,0 meses");
    });

    it("formata contadores inteiros com separador de milhar", () => {
      expect(formatBreakdownValue(1250, "count")).toBe("1.250");
      expect(formatBreakdownValue(0, "count")).toBe("0");
    });

    it("formata múltiplos e ratios", () => {
      expect(formatBreakdownValue(1.45, "ratio")).toBe("1,45x");
      expect(formatBreakdownValue(0, "ratio")).toBe("0,00x");
    });

    it("protege contra NaN e Infinity", () => {
      expect(normalizeSpaces(formatBreakdownValue(Number.NaN, "currency"))).toBe("R$ 0,00");
      expect(formatBreakdownValue(Number.POSITIVE_INFINITY, "percent")).toBe("0,0%");
      expect(formatBreakdownValue(Number.NEGATIVE_INFINITY, "months")).toBe("0,0 meses");
    });
  });

  describe("formatOperator", () => {
    it("substitui hífen por menos tipográfico unicode", () => {
      expect(formatOperator("-")).toBe("−");
      expect(formatOperator("+")).toBe("+");
      expect(formatOperator("=")).toBe("=");
      expect(formatOperator(undefined)).toBe(" ");
    });
  });

  describe("generatePlainTextBreakdown e enrichBreakdown", () => {
    it("gera texto estruturado limpo para cópia", () => {
      const breakdown: CalculationBreakdown = enrichBreakdown({
        id: "test-calc",
        title: "Saldo Livre Teste",
        description: "Exemplo para teste",
        periodLabel: "Hoje",
        formulaExpression: "A - B",
        unit: "currency",
        steps: [
          { label: "Saldo A", rawValue: 10000, operator: "+" },
          { label: "Despesa B", rawValue: 3000, operator: "-" },
        ],
        result: {
          label: "Saldo Livre",
          rawValue: 7000,
          unit: "currency",
        },
        inclusions: ["Item 1", "Item 2"],
        exclusions: ["Exclusão 1"],
      });

      const text = generatePlainTextBreakdown(breakdown);
      expect(text).toContain("[Axi] Saldo Livre Teste");
      expect(text).toContain("Período: Hoje");
      expect(text).toContain("+ Saldo A: R$ 100,00");
      expect(text).toContain("− Despesa B: R$ 30,00");
      expect(text).toContain("= Saldo Livre: R$ 70,00");
      expect(text).toContain("Inclui: Item 1; Item 2.");
      expect(text).toContain("Exclui: Exclusão 1.");
      expect(breakdown.copyText).toBe(text);
    });
  });
});
