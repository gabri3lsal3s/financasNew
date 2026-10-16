import { StatusBar, Style } from "@capacitor/status-bar";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as platformModule from "./platform";
import { syncStatusBarTheme, THEME_STATUS_BAR_CONFIG } from "./status-bar";

vi.mock("@capacitor/status-bar", () => ({
  StatusBar: {
    setStyle: vi.fn(),
    setBackgroundColor: vi.fn(),
    setOverlaysWebView: vi.fn(),
  },
  Style: {
    Dark: "DARK",
    Light: "LIGHT",
    Default: "DEFAULT",
  },
}));

describe("Gateway Nativo — Status Bar Dinâmica", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não chama StatusBar em ambiente Web/PWA", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    await syncStatusBarTheme("light");

    expect(StatusBar.setStyle).not.toHaveBeenCalled();
    expect(StatusBar.setBackgroundColor).not.toHaveBeenCalled();
  });

  it("aplica estilo e cor corretos para tema light em plataforma nativa", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    await syncStatusBarTheme("light");

    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: Style.Light });
    expect(StatusBar.setBackgroundColor).toHaveBeenCalledWith({ color: "#F4F7F9" });
  });

  it("aplica estilo e cor corretos para tema dark em plataforma nativa", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    await syncStatusBarTheme("dark");

    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: Style.Dark });
    expect(StatusBar.setBackgroundColor).toHaveBeenCalledWith({ color: "#0C1923" });
  });

  it("aplica estilo e cor corretos para tema oled em plataforma nativa", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    await syncStatusBarTheme("oled");

    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: Style.Dark });
    expect(StatusBar.setBackgroundColor).toHaveBeenCalledWith({ color: "#000000" });
  });

  it("possui configurações mapeadas para light, dark e oled", () => {
    expect(THEME_STATUS_BAR_CONFIG.light.color).toBe("#F4F7F9");
    expect(THEME_STATUS_BAR_CONFIG.dark.color).toBe("#0C1923");
    expect(THEME_STATUS_BAR_CONFIG.oled.color).toBe("#000000");
  });
});
