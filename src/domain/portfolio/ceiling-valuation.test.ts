import { describe, expect, it } from "vitest";
import {
  calculateBazinCeiling,
  calculateFiiBazinCeiling,
  calculateFiiHybridCeiling,
  calculateFiiPvpCeiling,
  calculateGordonCeiling,
  calculateGrahamCeiling,
  calculateMarginOfSafety,
  calculateMultipleCeiling,
  generateYieldSensitivityTable,
  getValuationStatus,
  resolveConsensusCeiling,
  round2,
} from "./ceiling-valuation";

describe("Ceiling Valuation Engine (Fase 1)", () => {
  describe("round2", () => {
    it("arredonda para 2 casas decimais de forma financeira", () => {
      expect(round2(45.678)).toBe(45.68);
      expect(round2(45.672)).toBe(45.67);
      expect(round2(NaN)).toBe(0);
      expect(round2(Infinity)).toBe(0);
    });
  });

  describe("calculateBazinCeiling", () => {
    it("calcula preço teto padrão Bazin com DPA e Yield corretos", () => {
      // DPA = R$ 2,40; Yield Alvo = 6% a.a. (0.06) -> R$ 40,00
      expect(calculateBazinCeiling(2.4, 0.06)).toBe(40);
      expect(calculateBazinCeiling(3.2, 0.06)).toBe(53.33);
    });

    it("retorna null para DPA ou Yield inválidos", () => {
      expect(calculateBazinCeiling(0, 0.06)).toBeNull();
      expect(calculateBazinCeiling(-1, 0.06)).toBeNull();
      expect(calculateBazinCeiling(2.4, 0)).toBeNull();
      expect(calculateBazinCeiling(2.4, -0.05)).toBeNull();
      expect(calculateBazinCeiling(NaN, 0.06)).toBeNull();
    });
  });

  describe("calculateGrahamCeiling", () => {
    it("calcula o valor intrínseco e preço teto com margem de segurança", () => {
      // LPA = 4.00, VPA = 25.00 -> 22.5 * 4 * 25 = 2250 -> sqrt(2250) = 47.434...
      // intrinsicValue = 47.43
      // Com margem 20%: 47.43 * 0.80 = 37.944 -> 37.94
      const res = calculateGrahamCeiling(4.0, 25.0, 0.2);
      expect(res).not.toBeNull();
      expect(res?.intrinsicValue).toBe(47.43);
      expect(res?.price).toBe(37.94);
    });

    it("retorna null para LPA ou VPA negativos (anti-crash em prejuízo)", () => {
      expect(calculateGrahamCeiling(-2.0, 20.0)).toBeNull();
      expect(calculateGrahamCeiling(2.0, -5.0)).toBeNull();
      expect(calculateGrahamCeiling(0, 20.0)).toBeNull();
    });

    it("retorna null para margens de segurança fora do domínio [0, 1)", () => {
      expect(calculateGrahamCeiling(4.0, 25.0, -0.1)).toBeNull();
      expect(calculateGrahamCeiling(4.0, 25.0, 1.0)).toBeNull();
      expect(calculateGrahamCeiling(4.0, 25.0, 1.2)).toBeNull();
    });
  });

  describe("calculateGordonCeiling", () => {
    it("calcula preço teto por dividendo com crescimento perpétuo", () => {
      // DPA = 3.00, g = 2% (0.02), k = 9% (0.09) -> 3 * 1.02 / (0.09 - 0.02) = 3.06 / 0.07 = 43.71
      expect(calculateGordonCeiling(3.0, 0.02, 0.09)).toBe(43.71);
    });

    it("retorna null quando o custo de oportunidade k <= crescimento g", () => {
      expect(calculateGordonCeiling(3.0, 0.08, 0.08)).toBeNull();
      expect(calculateGordonCeiling(3.0, 0.1, 0.08)).toBeNull();
    });

    it("retorna null para valores negativos ou zero", () => {
      expect(calculateGordonCeiling(0, 0.02, 0.09)).toBeNull();
      expect(calculateGordonCeiling(3.0, -0.01, 0.09)).toBeNull();
      expect(calculateGordonCeiling(3.0, 0.02, 0)).toBeNull();
    });
  });

  describe("calculateMultipleCeiling", () => {
    it("calcula preço teto multiplicando métrica pelo múltiplo desejado", () => {
      // LPA = 7.50 e P/L máx = 6x -> 45.00
      expect(calculateMultipleCeiling(7.5, 6.0)).toBe(45);
      // VPA = 30.00 e P/VP máx = 1.2x -> 36.00
      expect(calculateMultipleCeiling(30.0, 1.2)).toBe(36);
    });

    it("retorna null para entradas não positivas", () => {
      expect(calculateMultipleCeiling(0, 6)).toBeNull();
      expect(calculateMultipleCeiling(7.5, 0)).toBeNull();
      expect(calculateMultipleCeiling(-1, 6)).toBeNull();
    });
  });

  describe("calculateFiiBazinCeiling", () => {
    it("anualiza o rendimento mensal e divide pelo yield anual", () => {
      // Rendimento mensal = R$ 0,85, Yield alvo = 8,5% a.a. (0.085) -> (0.85 * 12) / 0.085 = 120.00
      expect(calculateFiiBazinCeiling(0.85, 0.085)).toBe(120);
    });

    it("retorna null para valores inválidos", () => {
      expect(calculateFiiBazinCeiling(0, 0.085)).toBeNull();
      expect(calculateFiiBazinCeiling(0.85, 0)).toBeNull();
    });
  });

  describe("calculateFiiPvpCeiling", () => {
    it("multiplica VPA da cota pelo P/VP máximo", () => {
      expect(calculateFiiPvpCeiling(100.0, 1.0)).toBe(100);
      expect(calculateFiiPvpCeiling(100.0, 1.02)).toBe(102);
    });

    it("retorna null para valores inválidos", () => {
      expect(calculateFiiPvpCeiling(0, 1.0)).toBeNull();
      expect(calculateFiiPvpCeiling(100, 0)).toBeNull();
    });
  });

  describe("calculateFiiHybridCeiling", () => {
    it("seleciona o menor valor entre o teto de Yield e o teto de P/VP", () => {
      // Yield teto: (1.00 * 12) / 0.08 = 150.00
      // P/VP teto: 100 * 1.02 = 102.00 -> Preço deve ser 102.00 (mais conservador)
      const res1 = calculateFiiHybridCeiling(1.0, 0.08, 100.0, 1.02);
      expect(res1?.price).toBe(102);

      // Invertido: Yield teto menor que P/VP teto
      // Rendimento: 0.60 * 12 / 0.08 = 90.00
      // P/VP teto: 100 * 1.02 = 102.00 -> Preço deve ser 90.00
      const res2 = calculateFiiHybridCeiling(0.6, 0.08, 100.0, 1.02);
      expect(res2?.price).toBe(90);
    });
  });

  describe("calculateMarginOfSafety", () => {
    it("calcula margem de segurança positiva quando mercado está abaixo do teto", () => {
      // Teto = 50, Mercado = 40 -> Margem = 20%, Diff = -20%
      const res = calculateMarginOfSafety(50, 40);
      expect(res.marginOfSafetyPct).toBe(20);
      expect(res.diffVsCeilingPct).toBe(-20);
    });

    it("calcula margem negativa quando mercado está acima do teto", () => {
      // Teto = 50, Mercado = 60 -> Margem = -20%, Diff = +20%
      const res = calculateMarginOfSafety(50, 60);
      expect(res.marginOfSafetyPct).toBe(-20);
      expect(res.diffVsCeilingPct).toBe(20);
    });

    it("retorna null se teto ou mercado forem ausentes ou zero", () => {
      expect(calculateMarginOfSafety(null, 40)).toEqual({ marginOfSafetyPct: null, diffVsCeilingPct: null });
      expect(calculateMarginOfSafety(50, 0)).toEqual({ marginOfSafetyPct: null, diffVsCeilingPct: null });
      expect(calculateMarginOfSafety(undefined, 40)).toEqual({ marginOfSafetyPct: null, diffVsCeilingPct: null });
    });
  });

  describe("getValuationStatus", () => {
    it("classifica oportunidade com margem >= 15%", () => {
      const status = getValuationStatus(18.5, -18.5);
      expect(status.zone).toBe("opportunity");
      expect(status.badgeVariant).toBe("positive");
      expect(status.label).toContain("+18.5% margem");
    });

    it("classifica preço justo com margem entre 0% e 15%", () => {
      const status = getValuationStatus(8.0, -8.0);
      expect(status.zone).toBe("fair");
      expect(status.badgeVariant).toBe("muted");
      expect(status.label).toBe("Preço Justo");
    });

    it("classifica esticado quando margem < 0%", () => {
      const status = getValuationStatus(-10.0, 10.0);
      expect(status.zone).toBe("stretched");
      expect(status.badgeVariant).toBe("negative");
      expect(status.label).toContain("+10.0% acima do teto");
    });

    it("retorna neutro quando não há margem calculada", () => {
      const status = getValuationStatus(null, null);
      expect(status.zone).toBe("fair");
      expect(status.badgeVariant).toBe("muted");
      expect(status.label).toBe("Sem teto definido");
    });
  });

  describe("resolveConsensusCeiling", () => {
    const models = {
      bazin: { dpa: 3.2, targetYield: 0.06, price: 53.33 },
      graham: { lpa: 7.5, vpa: 35.0, marginOfSafety: 0.2, intrinsicValue: 76.85, price: 61.48 },
      gordon: { dpa: 3.2, growthRate: 0.02, requiredRate: 0.09, price: 46.63 },
      multiple: { metricType: "pe" as const, metricValue: 7.5, targetMultiple: 6.0, price: 45.0 },
    };

    it("aplica a regra conservadora (menor preço teto)", () => {
      const res = resolveConsensusCeiling(models, "conservative");
      expect(res.effectivePrice).toBe(45.0);
      expect(res.effectiveMethod).toBe("conservative");
    });

    it("aplica a regra da média aritmética dos modelos", () => {
      // (53.33 + 61.48 + 46.63 + 45.00) / 4 = 206.44 / 4 = 51.61
      const res = resolveConsensusCeiling(models, "average");
      expect(res.effectivePrice).toBe(51.61);
      expect(res.effectiveMethod).toBe("average");
    });

    it("seleciona um método específico eleito pelo investidor", () => {
      const res = resolveConsensusCeiling(models, "specific", "bazin");
      expect(res.effectivePrice).toBe(53.33);
      expect(res.effectiveMethod).toBe("bazin");
    });

    it("retorna o método único diretamente quando houver apenas 1 preenchido", () => {
      const single = {
        bazin: { dpa: 2.4, targetYield: 0.06, price: 40.0 },
      };
      const res = resolveConsensusCeiling(single, "conservative");
      expect(res.effectivePrice).toBe(40.0);
      expect(res.effectiveMethod).toBe("bazin");
    });

    it("retorna null para modelos vazios", () => {
      expect(resolveConsensusCeiling(undefined)).toEqual({ effectivePrice: null, effectiveMethod: null });
      expect(resolveConsensusCeiling({})).toEqual({ effectivePrice: null, effectiveMethod: null });
    });
  });

  describe("generateYieldSensitivityTable", () => {
    it("gera tabela de sensibilidade com diferentes percentuais de yield", () => {
      const table = generateYieldSensitivityTable(3.0);
      expect(table.length).toBe(6);
      expect(table[0]).toEqual({ yieldPct: 5, ceilingPrice: 60 });
      expect(table[1]).toEqual({ yieldPct: 6, ceilingPrice: 50 });
    });

    it("retorna lista vazia para DPA inválido", () => {
      expect(generateYieldSensitivityTable(0)).toEqual([]);
      expect(generateYieldSensitivityTable(-2)).toEqual([]);
    });
  });
});
