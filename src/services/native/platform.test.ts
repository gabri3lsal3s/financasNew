import { Capacitor } from "@capacitor/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlatform, isAndroidNative, isIOSNative, isNativePlatform, isWebPlatform } from "./platform";

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
});
