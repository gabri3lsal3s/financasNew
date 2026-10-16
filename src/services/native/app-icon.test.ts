import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAppIconPlugin = vi.hoisted(() => ({
  setAppIcon: vi.fn(),
  getAppIcon: vi.fn(),
}));

vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return {
    ...actual,
    registerPlugin: () => mockAppIconPlugin,
  };
});

import { getNativeAppIcon, setNativeAppIcon } from "./app-icon";
import * as platformModule from "./platform";

describe("Native AppIcon Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna true imediatamente quando não está em ambiente nativo (Web/PWA)", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    const result = await setNativeAppIcon("pro");
    expect(result).toBe(true);
    expect(mockAppIconPlugin.setAppIcon).not.toHaveBeenCalled();
  });

  it("retorna 'default' quando não está em ambiente nativo", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    const result = await getNativeAppIcon();
    expect(result).toBe("default");
    expect(mockAppIconPlugin.getAppIcon).not.toHaveBeenCalled();
  });

  it("chama o plugin nativo AppIconPlugin.setAppIcon com 'pro' quando isPro for true", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    mockAppIconPlugin.setAppIcon.mockResolvedValue({
      success: true,
      currentIcon: "pro",
      isPro: true,
    });

    const success = await setNativeAppIcon(true);
    expect(success).toBe(true);
    expect(mockAppIconPlugin.setAppIcon).toHaveBeenCalledWith({ icon: "pro", isPro: true });
  });

  it("chama o plugin nativo AppIconPlugin.setAppIcon com 'default' quando isPro for false", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    mockAppIconPlugin.setAppIcon.mockResolvedValue({
      success: true,
      currentIcon: "default",
      isPro: false,
    });

    const success = await setNativeAppIcon(false);
    expect(success).toBe(true);
    expect(mockAppIconPlugin.setAppIcon).toHaveBeenCalledWith({ icon: "default", isPro: false });
  });

  it("trata erro do plugin nativo com fallback seguro retornando false", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    mockAppIconPlugin.setAppIcon.mockRejectedValue(new Error("Native error"));

    const success = await setNativeAppIcon("pro");
    expect(success).toBe(false);
  });

  it("obtém o ícone nativo quando em ambiente nativo", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    mockAppIconPlugin.getAppIcon.mockResolvedValue({
      currentIcon: "pro",
      isPro: true,
    });

    const current = await getNativeAppIcon();
    expect(current).toBe("pro");
    expect(mockAppIconPlugin.getAppIcon).toHaveBeenCalled();
  });
});
