import { describe, expect, it } from "vitest";
import {
  EXPERIENCE_PRESETS,
  PRESET_METADATA_LIST,
  applyExperiencePreset,
  detectActivePreset,
  type ExperienceConfig,
} from "./index";

describe("domain/preferences — Modos de Experiência (§3.10 / §3.11)", () => {
  it("contém os 3 presets canônicos com valores imutáveis e coerentes", () => {
    expect(EXPERIENCE_PRESETS.dynamic.motionLevel).toBe("fluid");
    expect(EXPERIENCE_PRESETS.dynamic.density).toBe("comfortable");
    expect(EXPERIENCE_PRESETS.dynamic.soundEnabled).toBe(true);
    expect(EXPERIENCE_PRESETS.dynamic.hapticEnabled).toBe(true);
    expect(EXPERIENCE_PRESETS.dynamic.numberTickerEnabled).toBe(true);
    expect(EXPERIENCE_PRESETS.dynamic.disabledSensoryIntents).toEqual([]);

    expect(EXPERIENCE_PRESETS.minimal.motionLevel).toBe("eco");
    expect(EXPERIENCE_PRESETS.minimal.density).toBe("compact");
    expect(EXPERIENCE_PRESETS.minimal.soundEnabled).toBe(false);
    expect(EXPERIENCE_PRESETS.minimal.hapticEnabled).toBe(true);
    expect(EXPERIENCE_PRESETS.minimal.numberTickerEnabled).toBe(false);
    expect(EXPERIENCE_PRESETS.minimal.disabledSensoryIntents).toEqual([
      "selection",
      "action",
      "toggle",
    ]);

    expect(EXPERIENCE_PRESETS.discreet.motionLevel).toBe("reduced");
    expect(EXPERIENCE_PRESETS.discreet.density).toBe("compact");
    expect(EXPERIENCE_PRESETS.discreet.soundEnabled).toBe(false);
    expect(EXPERIENCE_PRESETS.discreet.hapticEnabled).toBe(false);
    expect(EXPERIENCE_PRESETS.discreet.numberTickerEnabled).toBe(false);
    expect(EXPERIENCE_PRESETS.discreet.disabledSensoryIntents).toEqual([
      "selection",
      "action",
      "toggle",
      "success",
      "warning",
      "destructive",
      "error",
    ]);
  });

  it("exporta metadados descritivos para todos os presets de experiência", () => {
    expect(PRESET_METADATA_LIST).toHaveLength(3);
    const ids = PRESET_METADATA_LIST.map((m) => m.id);
    expect(ids).toEqual(["dynamic", "minimal", "discreet"]);
    PRESET_METADATA_LIST.forEach((m) => {
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.badgeLabel.length).toBeGreaterThan(0);
      expect(m.highlights.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("detectActivePreset", () => {
    it("detecta dynamic quando todos os atributos coincidem", () => {
      const config: ExperienceConfig = { ...EXPERIENCE_PRESETS.dynamic };
      expect(detectActivePreset(config)).toBe("dynamic");
    });

    it("detecta dynamic como fallback padrão para null/undefined", () => {
      expect(detectActivePreset(null)).toBe("dynamic");
      expect(detectActivePreset(undefined)).toBe("dynamic");
    });

    it("detecta minimal quando todos os atributos coincidem", () => {
      const config: ExperienceConfig = { ...EXPERIENCE_PRESETS.minimal };
      expect(detectActivePreset(config)).toBe("minimal");
    });

    it("detecta discreet quando todos os atributos coincidem", () => {
      const config: ExperienceConfig = { ...EXPERIENCE_PRESETS.discreet };
      expect(detectActivePreset(config)).toBe("discreet");
    });

    it("detecta custom se houver qualquer divergência em relação aos presets", () => {
      // Divergência de som no minimal
      expect(
        detectActivePreset({
          ...EXPERIENCE_PRESETS.minimal,
          soundEnabled: true,
        }),
      ).toBe("custom");

      // Divergência de ticker no dynamic
      expect(
        detectActivePreset({
          ...EXPERIENCE_PRESETS.dynamic,
          numberTickerEnabled: false,
        }),
      ).toBe("custom");

      // Divergência de intenções desativadas no discreet
      expect(
        detectActivePreset({
          ...EXPERIENCE_PRESETS.discreet,
          disabledSensoryIntents: ["selection"],
        }),
      ).toBe("custom");
    });
  });

  describe("applyExperiencePreset", () => {
    it("aplica o preset dynamic preservando propriedades externas", () => {
      const initial = {
        accent: "emerald",
        surfaceStyle: "elevated",
        motionLevel: "reduced" as const,
        density: "compact" as const,
        soundEnabled: false,
        hapticEnabled: false,
        numberTickerEnabled: false,
        disabledSensoryIntents: ["error" as const],
      };

      const result = applyExperiencePreset("dynamic", initial);

      expect(result.accent).toBe("emerald");
      expect(result.surfaceStyle).toBe("elevated");
      expect(result.motionLevel).toBe("fluid");
      expect(result.density).toBe("comfortable");
      expect(result.soundEnabled).toBe(true);
      expect(result.hapticEnabled).toBe(true);
      expect(result.numberTickerEnabled).toBe(true);
      expect(result.disabledSensoryIntents).toEqual([]);
    });

    it("aplica o preset minimal preservando propriedades externas", () => {
      const initial = {
        customField: "keep-me",
        motionLevel: "fluid" as const,
        density: "comfortable" as const,
        soundEnabled: true,
        hapticEnabled: true,
        numberTickerEnabled: true,
        disabledSensoryIntents: [],
      };

      const result = applyExperiencePreset("minimal", initial);

      expect(result.customField).toBe("keep-me");
      expect(result.motionLevel).toBe("eco");
      expect(result.density).toBe("compact");
      expect(result.soundEnabled).toBe(false);
      expect(result.hapticEnabled).toBe(true);
      expect(result.numberTickerEnabled).toBe(false);
      expect(result.disabledSensoryIntents).toEqual(["selection", "action", "toggle"]);
    });

    it("aplica o preset discreet preservando propriedades externas", () => {
      const initial = {
        motionLevel: "fluid" as const,
        density: "comfortable" as const,
        soundEnabled: true,
        hapticEnabled: true,
        numberTickerEnabled: true,
        disabledSensoryIntents: [],
      };

      const result = applyExperiencePreset("discreet", initial);

      expect(result.motionLevel).toBe("reduced");
      expect(result.density).toBe("compact");
      expect(result.soundEnabled).toBe(false);
      expect(result.hapticEnabled).toBe(false);
      expect(result.numberTickerEnabled).toBe(false);
      expect(result.disabledSensoryIntents).toHaveLength(7);
    });

    it("mantém os valores atuais quando preset é custom", () => {
      const initial = {
        motionLevel: "eco" as const,
        density: "compact" as const,
        soundEnabled: true,
        hapticEnabled: false,
        numberTickerEnabled: true,
        disabledSensoryIntents: ["selection" as const],
      };

      const result = applyExperiencePreset("custom", initial);
      expect(result).toEqual(initial);
    });
  });
});
