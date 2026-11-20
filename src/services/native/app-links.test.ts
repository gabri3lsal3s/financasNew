import { Capacitor } from "@capacitor/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AXIR_APK_DOWNLOAD_URL,
  AXIR_APK_FILENAME,
  AXIR_APP_NAME,
  AXIR_APP_VERSION,
  AXIR_DEEP_LINK_SCHEME,
  AXIR_LEGACY_DEEP_LINK_SCHEME,
  buildAppDeepLink,
  shouldOfferAndroidApk,
} from "./app-links";

describe("app-links — URLs, versão, deep-links e elegibilidade Android (M10)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("web");
  });

  it("expõe versão vigente compatível com package.json, URL canônica do APK e schemes oficiais", () => {
    expect(AXIR_APP_NAME).toBe("Axir");
    expect(AXIR_APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(AXIR_APK_FILENAME).toBe("axir-pro.apk");
    expect(AXIR_APK_DOWNLOAD_URL).toMatch(/^https:\/\/.+\.apk$/);
    expect(AXIR_DEEP_LINK_SCHEME).toBe("axir://");
    expect(AXIR_LEGACY_DEEP_LINK_SCHEME).toBe("com.guiafinanceiro.app://");
  });

  it("constrói deep-links normalizando barras iniciais", () => {
    expect(buildAppDeepLink("/transacoes?novo=despesa")).toBe("axir://transacoes?novo=despesa");
    expect(buildAppDeepLink("viagem/abc123")).toBe("axir://viagem/abc123");
    expect(buildAppDeepLink("/r/token-1", AXIR_LEGACY_DEEP_LINK_SCHEME)).toBe(
      "com.guiafinanceiro.app://r/token-1",
    );
    expect(buildAppDeepLink("cartoes", "axir")).toBe("axir://cartoes");
  });

  it("retorna true em Capacitor Android", () => {
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    expect(shouldOfferAndroidApk()).toBe(true);
  });

  it("retorna true em navegador Android Web", () => {
    const originalUa = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
      configurable: true,
    });

    try {
      expect(shouldOfferAndroidApk()).toBe(true);
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
    }
  });

  it("retorna false em iOS, iPadOS e Desktop (Windows/macOS/Linux)", () => {
    expect(
      shouldOfferAndroidApk(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
    expect(
      shouldOfferAndroidApk(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(
      shouldOfferAndroidApk(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(
      shouldOfferAndroidApk(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ),
    ).toBe(false);

    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
    expect(shouldOfferAndroidApk()).toBe(false);
  });
});
