import { describe, expect, it } from "vitest";
import {
  calculateAssetAllocationDelta,
  clampTargetPercentage,
  distributeEquallyTargets,
  mirrorCurrentPositionTargets,
  parseTargetInput,
  sanitizeTargetsForSave,
  sectorExposure,
  targetsSum,
  validateSectorCaps,
  validateTargetsSum,
} from "./allocation";

describe("domain/portfolio/allocation (§3.11.1)", () => {
  describe("targetsSum / validateTargetsSum — soma ≤ 100", () => {
    it("soma correta das metas", () => {
      expect(targetsSum([{ target: 30 }, { target: 40 }, { target: 10.5 }])).toBe(80.5);
    });

    it("soma vazia = 0", () => {
      expect(targetsSum([])).toBe(0);
    });

    it("soma ≤ 100 é válida e reporta o restante", () => {
      const result = validateTargetsSum([{ target: 30 }, { target: 40 }]);
      expect(result.ok).toBe(true);
      expect(result.sum).toBe(70);
      expect(result.remaining).toBe(30);
      expect(result.error).toBeNull();
    });

    it("soma exatamente 100 com dízimas flutuantes (IEEE 754) é válida sem erro", () => {
      // 11.11 * 8 + 11.12 em JS puro resulta em 100.00000000000001
      const targets = [
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.12 },
      ];
      const result = validateTargetsSum(targets);
      expect(result.ok).toBe(true);
      expect(result.sum).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.error).toBeNull();
    });

    it("soma > 100 é bloqueada com mensagem pt-BR", () => {
      const result = validateTargetsSum([{ target: 40 }, { target: 40 }, { target: 40 }]);
      expect(result.ok).toBe(false);
      expect(result.sum).toBe(120);
      expect(result.remaining).toBe(0);
      expect(result.error).toContain("excede 100%");
    });
  });

  describe("clampTargetPercentage / parseTargetInput", () => {
    it("clampa acima de 100 e abaixo de 0", () => {
      expect(clampTargetPercentage(150)).toBe(100);
      expect(clampTargetPercentage(-10)).toBe(0);
      expect(clampTargetPercentage(42.567)).toBe(42.57);
    });

    it("parse aceita vírgula pt-BR e vazio → 0", () => {
      expect(parseTargetInput("12,5")).toBe(12.5);
      expect(parseTargetInput("")).toBe(0);
      expect(parseTargetInput("120")).toBe(100);
      expect(parseTargetInput("abc")).toBe(0);
    });
  });

  describe("sanitizeTargetsForSave", () => {
    it("arredonda todos os valores para 2 casas e preserva soma <= 100", () => {
      const input = [
        { assetId: "a1", target: 33.33333 },
        { assetId: "a2", target: 33.33333 },
        { assetId: "a3", target: 33.33334 },
      ];
      const result = sanitizeTargetsForSave(input);
      expect(result).toEqual([
        { assetId: "a1", target: 33.33 },
        { assetId: "a2", target: 33.33 },
        { assetId: "a3", target: 33.33 },
      ]);
      const sum = result.reduce((acc, t) => acc + t.target, 0);
      expect(sum).toBeLessThanOrEqual(100);
    });

    it("absorve resíduo que ultrapassaria 100% no último item positivo", () => {
      const input = [
        { assetId: "a1", target: 50.005 }, // -> 50.01
        { assetId: "a2", target: 50.005 }, // -> 50.01 (soma = 100.02)
      ];
      const result = sanitizeTargetsForSave(input);
      const sum = result.reduce((acc, t) => acc + t.target, 0);
      expect(sum).toBe(100);
      expect(result[1]?.target).toBe(49.99);
    });
  });

  describe("sectorExposure — travas setoriais", () => {
    it("exposição em % do patrimônio", () => {
      const e = sectorExposure(3000, 10000, 40);
      expect(e.pct).toBe(30);
      expect(e.exceeded).toBe(false);
    });

    it("excede quando pct > cap", () => {
      const e = sectorExposure(5000, 10000, 40);
      expect(e.pct).toBe(50);
      expect(e.exceeded).toBe(true);
    });

    it("sem trava (cap null) nunca excede", () => {
      const e = sectorExposure(9000, 10000, null);
      expect(e.exceeded).toBe(false);
    });

    it("patrimônio zero → exposição 0%", () => {
      const e = sectorExposure(100, 0, 40);
      expect(e.pct).toBe(0);
    });
  });

  describe("validateSectorCaps", () => {
    it("ok quando nenhum setor ultrapassa o teto", () => {
      const result = validateSectorCaps([
        { pct: 30, cap: 40 },
        { pct: 50, cap: null },
      ]);
      expect(result.ok).toBe(true);
      expect(result.violated).toHaveLength(0);
    });

    it("lista os setores violados", () => {
      const result = validateSectorCaps([
        { pct: 45, cap: 40 },
        { pct: 20, cap: 30 },
        { pct: 60, cap: null },
      ]);
      expect(result.ok).toBe(false);
      expect(result.violated).toHaveLength(1);
      expect(result.violated[0]).toContain("acima do teto");
    });
  });

  describe("distributeEquallyTargets (1/N)", () => {
    it("distribui 100% perfeitamente em 4 itens (25% cada)", () => {
      const items = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
      const res = distributeEquallyTargets(items, 100);
      expect(res.map((r) => r.targetPercentage)).toEqual([25, 25, 25, 25]);
    });

    it("compensa dízima periódica no último item para fechar exatamente 100%", () => {
      const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const res = distributeEquallyTargets(items, 100);
      expect(res.map((r) => r.targetPercentage)).toEqual([33.33, 33.33, 33.34]);
      const sum = res.reduce((acc, r) => acc + r.targetPercentage, 0);
      expect(sum).toBe(100);
    });

    it("distribui para um teto parcial customizado (ex: 40%)", () => {
      const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const res = distributeEquallyTargets(items, 40);
      expect(res.map((r) => r.targetPercentage)).toEqual([13.33, 13.33, 13.34]);
      const sum = res.reduce((acc, r) => acc + r.targetPercentage, 0);
      expect(sum).toBe(40);
    });

    it("retorna vazio se array vazio", () => {
      expect(distributeEquallyTargets([])).toEqual([]);
    });
  });

  describe("mirrorCurrentPositionTargets", () => {
    it("espelha a proporção atual normalizando para 100%", () => {
      const items = [
        { id: "1", currentPct: 10 },
        { id: "2", currentPct: 30 },
      ];
      const res = mirrorCurrentPositionTargets(items, 100);
      expect(res[0]?.targetPercentage).toBe(25);
      expect(res[1]?.targetPercentage).toBe(75);
    });

    it("faz fallback para 1/N se todos currentPct forem 0", () => {
      const items = [
        { id: "1", currentPct: 0 },
        { id: "2", currentPct: 0 },
      ];
      const res = mirrorCurrentPositionTargets(items, 100);
      expect(res.map((r) => r.targetPercentage)).toEqual([50, 50]);
    });
  });

  describe("calculateAssetAllocationDelta", () => {
    it("calcula delta positivo quando alvo > atual (precisa de aporte)", () => {
      const delta = calculateAssetAllocationDelta(5.2, 10.0);
      expect(delta.deltaPct).toBe(4.8);
      expect(delta.isUnderallocated).toBe(true);
      expect(delta.formattedDelta).toBe("+4.8%");
    });

    it("calcula delta negativo ou zero quando alvo <= atual", () => {
      const delta = calculateAssetAllocationDelta(12.5, 10.0);
      expect(delta.deltaPct).toBe(-2.5);
      expect(delta.isUnderallocated).toBe(false);
      expect(delta.formattedDelta).toBe("-2.5%");
    });
  });
});
