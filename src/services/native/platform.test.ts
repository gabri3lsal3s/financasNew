import { Capacitor } from "@capacitor/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPlatform,
  getActivePlatform,
  hasNativeBrowserBackToTop,
  isAndroidNative,
  isIOSDevice,
  isIOSNative,
  isMobileDevice,
  isNativePlatform,
  isSamsungInternetBrowser,
  isStandaloneDisplay,
  isWebPlatform,
} from "./platform";

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

  it("detecta isSamsungInternetBrowser apenas quando o userAgent contém SamsungBrowser", () => {
    const originalUa = navigator.userAgent;

    try {
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
        configurable: true,
      });
      expect(isSamsungInternetBrowser()).toBe(true);

      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
        configurable: true,
      });
      expect(isSamsungInternetBrowser()).toBe(false);
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
    }
  });

  it("hasNativeBrowserBackToTop retorna true apenas no Samsung Internet fora de standalone e fora do app nativo", () => {
    const originalUa = navigator.userAgent;
    const samsungUa =
      "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
    const chromeUa =
      "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36";

    try {
      // 1. Samsung Internet em navegador comum (não standalone, não nativo) -> true
      Object.defineProperty(navigator, "userAgent", { value: samsungUa, configurable: true });
      vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
      vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
      expect(hasNativeBrowserBackToTop()).toBe(true);

      // 2. Samsung Internet rodando como PWA standalone -> false
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
      expect(hasNativeBrowserBackToTop()).toBe(false);

      // 3. Plataforma nativa Capacitor -> false
      vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
      vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
      expect(hasNativeBrowserBackToTop()).toBe(false);

      // 4. Chrome Android / outros navegadores -> false
      vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
      Object.defineProperty(navigator, "userAgent", { value: chromeUa, configurable: true });
      expect(hasNativeBrowserBackToTop()).toBe(false);
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
    }
  });
});

