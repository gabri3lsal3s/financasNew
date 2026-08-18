import { beforeEach, describe, expect, it } from "vitest";
import {
  getVisualCustomization,
  initVisualCustomization,
  updateVisualCustomization,
} from "./use-visual-customization";

describe("useVisualCustomization (F11)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.removeAttribute("data-surface-style");
    document.documentElement.removeAttribute("data-motion");
  });

  it("retorna as configurações padrão", () => {
    const config = getVisualCustomization();
    expect(config.accent).toBe("teal");
    expect(config.surfaceStyle).toBe("glass");
    expect(config.motionLevel).toBe("fluid");
    expect(config.soundEnabled).toBe(false);
    expect(config.hapticEnabled).toBe(true);
    expect(config.numberTickerEnabled).toBe(true);
    expect(config.dashboardWidgets.kpis).toBe(true);
  });

  it("permite ligar e desligar sons e vibrações", () => {
    updateVisualCustomization({ soundEnabled: true });
    expect(getVisualCustomization().soundEnabled).toBe(true);
    expect(window.localStorage.getItem("financas_sound_enabled")).toBe("true");

    updateVisualCustomization({ hapticEnabled: false });
    expect(getVisualCustomization().hapticEnabled).toBe(false);
    expect(window.localStorage.getItem("financas_haptic_enabled")).toBe("false");
  });

  it("restaura a personalização salva no localStorage imediatamente no init", () => {
    window.localStorage.setItem("financas_accent_theme", "mono");
    window.localStorage.setItem("financas_surface_style", "flat");
    window.localStorage.setItem("financas_motion_level", "reduced");

    const config = initVisualCustomization();
    expect(config.accent).toBe("mono");
    expect(document.documentElement.getAttribute("data-accent")).toBe("mono");
    expect(document.documentElement.getAttribute("data-surface-style")).toBe("flat");
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
  });

  it("atualiza a cor de destaque (accent) e reflete no DOM", () => {
    updateVisualCustomization({ accent: "emerald" });
    const config = getVisualCustomization();
    expect(config.accent).toBe("emerald");
    expect(document.documentElement.getAttribute("data-accent")).toBe("emerald");

    updateVisualCustomization({ accent: "mono" });
    expect(getVisualCustomization().accent).toBe("mono");
    expect(document.documentElement.getAttribute("data-accent")).toBe("mono");

    updateVisualCustomization({ accent: "teal" });
    expect(document.documentElement.getAttribute("data-accent")).toBeNull();
  });

  it("atualiza o estilo de superfície (surfaceStyle) e reflete no DOM", () => {
    updateVisualCustomization({ surfaceStyle: "flat" });
    const config = getVisualCustomization();
    expect(config.surfaceStyle).toBe("flat");
    expect(document.documentElement.getAttribute("data-surface-style")).toBe("flat");

    updateVisualCustomization({ surfaceStyle: "glass" });
    expect(document.documentElement.getAttribute("data-surface-style")).toBeNull();
  });

  it("atualiza o nível de movimento (motionLevel)", () => {
    updateVisualCustomization({ motionLevel: "reduced" });
    const config = getVisualCustomization();
    expect(config.motionLevel).toBe("reduced");
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");

    // Eco também aplica data-motion (CSS desliga shimmer/pulso/spring).
    updateVisualCustomization({ motionLevel: "eco" });
    expect(document.documentElement.getAttribute("data-motion")).toBe("eco");

    updateVisualCustomization({ motionLevel: "fluid" });
    expect(document.documentElement.getAttribute("data-motion")).toBeNull();
  });

  it("permite desligar a contagem animada (numberTickerEnabled)", () => {
    updateVisualCustomization({ numberTickerEnabled: false });
    expect(getVisualCustomization().numberTickerEnabled).toBe(false);
    updateVisualCustomization({ numberTickerEnabled: true });
    expect(getVisualCustomization().numberTickerEnabled).toBe(true);
  });

  it("permite salvar e restaurar disabledSensoryIntents para desativar categorias específicas", () => {
    updateVisualCustomization({ disabledSensoryIntents: ["warning", "error"] });
    expect(getVisualCustomization().disabledSensoryIntents).toEqual(["warning", "error"]);
    expect(window.localStorage.getItem("financas_disabled_sensory_intents")).toBe(
      JSON.stringify(["warning", "error"]),
    );

    // No init, recupera do localStorage
    const config = initVisualCustomization();
    expect(config.disabledSensoryIntents).toEqual(["warning", "error"]);
  });
});
