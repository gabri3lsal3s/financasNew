import { beforeEach, describe, expect, it } from "vitest";
import {
  getVisualCustomization,
  initVisualCustomization,
  updateVisualCustomization,
  resetVisualCustomization,
  syncVisualWithCloud,
} from "./use-visual-customization";
import { setActiveUserId, getUserStorageKey } from "@/services/user-storage";

describe("useVisualCustomization (F11)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActiveUserId(null);
    resetVisualCustomization(null);
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.removeAttribute("data-surface-style");
    document.documentElement.removeAttribute("data-motion");
    document.documentElement.removeAttribute("data-density");
  });

  it("retorna as configurações padrão", () => {
    const config = getVisualCustomization();
    expect(config.experiencePreset).toBe("dynamic");
    expect(config.accent).toBe("teal");
    expect(config.surfaceStyle).toBe("glass");
    expect(config.motionLevel).toBe("fluid");
    expect(config.density).toBe("comfortable");
    expect(config.soundEnabled).toBe(true);
    expect(config.hapticEnabled).toBe(true);
    expect(config.numberTickerEnabled).toBe(true);
    expect(config.dashboardWidgets.kpis).toBe(true);
    expect(config.dashboardWidgets.contextBanners).toBe(true);
  });

  it("aplica presets de experiência e reflete nos atributos do DOM e storage", () => {
    setActiveUserId("user-presets");
    updateVisualCustomization({ experiencePreset: "minimal" }, "user-presets");

    const config = getVisualCustomization();
    expect(config.experiencePreset).toBe("minimal");
    expect(config.motionLevel).toBe("eco");
    expect(config.density).toBe("compact");
    expect(config.soundEnabled).toBe(false);
    expect(config.hapticEnabled).toBe(true);
    expect(config.numberTickerEnabled).toBe(false);
    expect(document.documentElement.getAttribute("data-motion")).toBe("eco");
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
    expect(window.localStorage.getItem(getUserStorageKey("experience_preset", "user-presets"))).toBe("minimal");

    // Aplicar preset discreto
    updateVisualCustomization({ experiencePreset: "discreet" }, "user-presets");
    const discreetCfg = getVisualCustomization();
    expect(discreetCfg.experiencePreset).toBe("discreet");
    expect(discreetCfg.soundEnabled).toBe(false);
    expect(discreetCfg.hapticEnabled).toBe(false);
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");

    // Alteração manual migra automaticamente para custom
    updateVisualCustomization({ soundEnabled: true }, "user-presets");
    expect(getVisualCustomization().experiencePreset).toBe("custom");
  });

  it("permite ligar e desligar sons e vibrações", () => {
    setActiveUserId("user-vis");
    updateVisualCustomization({ soundEnabled: false }, "user-vis");
    expect(getVisualCustomization().soundEnabled).toBe(false);
    expect(window.localStorage.getItem(getUserStorageKey("sound_enabled", "user-vis"))).toBe("false");

    updateVisualCustomization({ hapticEnabled: false }, "user-vis");
    expect(getVisualCustomization().hapticEnabled).toBe(false);
    expect(window.localStorage.getItem(getUserStorageKey("haptic_enabled", "user-vis"))).toBe("false");
  });

  it("restaura a personalização salva no storage do usuário no init", () => {
    setActiveUserId("user-vis2");
    window.localStorage.setItem("financas_user-vis2_accent_theme", "mono");
    window.localStorage.setItem("financas_user-vis2_surface_style", "flat");
    window.localStorage.setItem("financas_user-vis2_motion_level", "reduced");
    window.localStorage.setItem("financas_user-vis2_density_level", "compact");

    const config = initVisualCustomization("user-vis2");
    expect(config.accent).toBe("mono");
    expect(document.documentElement.getAttribute("data-accent")).toBe("mono");
    expect(document.documentElement.getAttribute("data-surface-style")).toBe("flat");
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
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

  it("sincroniza configurações recebidas da nuvem via syncVisualWithCloud", () => {
    syncVisualWithCloud({
      experiencePreset: "minimal",
      surfaceStyle: "elevated",
      dashboardWidgets: { kpis: true, summary: false, flow: false, donut: true, budgets: true },
    });

    const config = getVisualCustomization();
    expect(config.experiencePreset).toBe("minimal");
    expect(config.surfaceStyle).toBe("elevated");
    expect(config.motionLevel).toBe("eco");
    expect(config.density).toBe("compact");
    expect(config.soundEnabled).toBe(false);
    expect(config.dashboardWidgets.summary).toBe(false);
    expect(document.documentElement.getAttribute("data-surface-style")).toBe("elevated");
    expect(document.documentElement.getAttribute("data-motion")).toBe("eco");
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
  });

  it("reseta para configurações padrão no resetVisualCustomization", () => {
    updateVisualCustomization({ accent: "rose", surfaceStyle: "flat" });
    expect(getVisualCustomization().accent).toBe("rose");

    resetVisualCustomization(null);
    expect(getVisualCustomization().accent).toBe("teal");
    expect(document.documentElement.getAttribute("data-accent")).toBeNull();
    expect(document.documentElement.getAttribute("data-surface-style")).toBeNull();
  });
});
