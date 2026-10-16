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

import {
  getCachedIconTier,
  setCachedIconTier,
  getNativeAppIcon,
  setNativeAppIcon,
  LAST_APPLIED_ICON_TIER_KEY,
} from "./app-icon";
import * as platformModule from "./platform";

describe("Native AppIcon Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("Cache Local do Launcher Tier (last_applied_icon_tier)", () => {
    it("retorna 'FREE' por padrão quando o cache está vazio", () => {
      expect(getCachedIconTier()).toBe("FREE");
    });

    it("armazena e recupera o tier 'PRO' corretamente", () => {
      setCachedIconTier("PRO");
      expect(getCachedIconTier()).toBe("PRO");
      expect(localStorage.getItem(LAST_APPLIED_ICON_TIER_KEY)).toBe("PRO");
    });

    it("armazena e recupera o tier 'FREE' corretamente", () => {
      setCachedIconTier("PRO");
      expect(getCachedIconTier()).toBe("PRO");
      setCachedIconTier("FREE");
      expect(getCachedIconTier()).toBe("FREE");
      expect(localStorage.getItem(LAST_APPLIED_ICON_TIER_KEY)).toBe("FREE");
    });

    it("retorna 'FREE' de forma defensiva se localStorage falhar", () => {
      const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError: Access Denied");
      });
      expect(getCachedIconTier()).toBe("FREE");
      getItemSpy.mockRestore();
    });
  });

  describe("Delta Check e Anti-Restart Protection", () => {
    it("não invoca o plugin nativo se o tier desejado já corresponder ao cache (delta check anti-loop)", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      setCachedIconTier("PRO");

      // Tentativa de definir 'pro' quando o cache já é 'PRO'
      const result = await setNativeAppIcon(true);
      expect(result).toBe(true);
      expect(mockAppIconPlugin.setAppIcon).not.toHaveBeenCalled();

      // Tentativa de definir 'default' quando o cache já é 'FREE'
      setCachedIconTier("FREE");
      const freeResult = await setNativeAppIcon(false);
      expect(freeResult).toBe(true);
      expect(mockAppIconPlugin.setAppIcon).not.toHaveBeenCalled();
    });

    it("invoca o plugin nativo e atualiza o cache quando há delta (FREE -> PRO)", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      setCachedIconTier("FREE");
      mockAppIconPlugin.setAppIcon.mockResolvedValue({
        success: true,
        currentIcon: "pro",
        isPro: true,
      });

      const success = await setNativeAppIcon(true);
      expect(success).toBe(true);
      expect(mockAppIconPlugin.setAppIcon).toHaveBeenCalledWith({ icon: "pro", isPro: true });
      expect(getCachedIconTier()).toBe("PRO");
    });

    it("invoca o plugin nativo e atualiza o cache quando há delta (PRO -> FREE)", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      setCachedIconTier("PRO");
      mockAppIconPlugin.setAppIcon.mockResolvedValue({
        success: true,
        currentIcon: "default",
        isPro: false,
      });

      const success = await setNativeAppIcon(false);
      expect(success).toBe(true);
      expect(mockAppIconPlugin.setAppIcon).toHaveBeenCalledWith({ icon: "default", isPro: false });
      expect(getCachedIconTier()).toBe("FREE");
    });

    it("retorna false e não atualiza o cache se o plugin nativo falhar", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      setCachedIconTier("FREE");
      mockAppIconPlugin.setAppIcon.mockRejectedValue(new Error("Android Launcher busy"));

      const success = await setNativeAppIcon("pro");
      expect(success).toBe(false);
      expect(getCachedIconTier()).toBe("FREE");
    });
  });

  describe("Ambiente Web / PWA", () => {
    it("atualiza o cache local e retorna true sem invocar plugin nativo", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
      setCachedIconTier("FREE");

      const result = await setNativeAppIcon("pro");
      expect(result).toBe(true);
      expect(mockAppIconPlugin.setAppIcon).not.toHaveBeenCalled();
      expect(getCachedIconTier()).toBe("PRO");
    });

    it("retorna o valor correspondente ao cache em ambiente Web", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
      setCachedIconTier("PRO");
      expect(await getNativeAppIcon()).toBe("pro");

      setCachedIconTier("FREE");
      expect(await getNativeAppIcon()).toBe("default");
      expect(mockAppIconPlugin.getAppIcon).not.toHaveBeenCalled();
    });
  });

  describe("Obtenção do Ícone Nativo (getNativeAppIcon)", () => {
    it("obtém o ícone nativo quando em ambiente nativo e sincroniza o cache", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      mockAppIconPlugin.getAppIcon.mockResolvedValue({
        currentIcon: "pro",
        isPro: true,
      });

      const current = await getNativeAppIcon();
      expect(current).toBe("pro");
      expect(mockAppIconPlugin.getAppIcon).toHaveBeenCalled();
      expect(getCachedIconTier()).toBe("PRO");
    });

    it("retorna o cache defensivo se o getAppIcon nativo falhar", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      setCachedIconTier("PRO");
      mockAppIconPlugin.getAppIcon.mockRejectedValue(new Error("Plugin error"));

      const current = await getNativeAppIcon();
      expect(current).toBe("pro");
    });
  });
});
