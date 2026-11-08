import { Capacitor } from "@capacitor/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlatform, getActivePlatform, isAndroidNative, isIOSDevice, isIOSNative, isMobileDevice, isNativePlatform, isStandaloneDisplay, isWebPlatform } from "./platform";

describe("Gateway Nativo — platform", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("detecta plataforma web por padrão", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("web");

    expect(isNativePlatform()).toBe(false);
    expect(isWebPlatform()).toBe(true);
    expect(isAndroidNative()).toBe(false);
    expect(isIOSNative()).toBe(false);
    expect(getPlatform()).toBe("web");
  });

  it("detecta plataforma Android nativo", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");

    expect(isNativePlatform()).toBe(true);
    expect(isWebPlatform()).toBe(false);
    expect(isAndroidNative()).toBe(true);
    expect(isIOSNative()).toBe(false);
    expect(getPlatform()).toBe("android");
  });

  it("detecta plataforma iOS nativo", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");

    expect(isNativePlatform()).toBe(true);
    expect(isWebPlatform()).toBe(false);
    expect(isAndroidNative()).toBe(false);
    expect(isIOSNative()).toBe(true);
    expect(getPlatform()).toBe("ios");
  });

  it("fallback gracioso para plataformas desconhecidas", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("custom" as unknown as "web");

    expect(getPlatform()).toBe("web");
  });

  it("detecta getActivePlatform como 'android_pro' quando isNativePlatform for true", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    expect(getActivePlatform()).toBe("android_pro");
  });

  it("detecta getActivePlatform como 'web_desktop' em navegador desktop padrão", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("web");
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);

    const originalUa = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      configurable: true,
    });

    try {
      expect(isMobileDevice()).toBe(false);
      expect(getActivePlatform()).toBe("web_desktop");
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
    }
  });

  it("detecta getActivePlatform como 'mobile_pwa' em dispositivo móvel ou PWA standalone", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);

    const originalUa = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      configurable: true,
    });

    try {
      expect(isIOSDevice()).toBe(true);
      expect(isMobileDevice()).toBe(true);
      expect(getActivePlatform()).toBe("mobile_pwa");
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
    }
  });

  it("detecta isStandaloneDisplay via matchMedia", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(isStandaloneDisplay()).toBe(true);
  });
});

