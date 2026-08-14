import { describe, expect, it } from "vitest";
import {
  clampTargetPercentage,
  parseTargetInput,
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

    it("soma exatamente 100 é válida (remaining 0)", () => {
      const result = validateTargetsSum([{ target: 60 }, { target: 40 }]);
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(0);
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
});
