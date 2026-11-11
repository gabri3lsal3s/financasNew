import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getOrCreateDeviceId,
  detectOS,
  detectBrowser,
  getFriendlyDeviceName,
  getDeviceInfo,
  shouldSyncDeviceSession,
  markDeviceSessionSynced,
  clearDeviceSessionSync,
  DEVICE_ID_STORAGE_KEY,
  DEVICE_LAST_SYNC_STORAGE_KEY,
  SYNC_THROTTLE_MS,
} from "./device-info";

describe("device-info service", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("getOrCreateDeviceId", () => {
    it("gera e armazena um novo ID caso não exista no localStorage", () => {
      const id = getOrCreateDeviceId();
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
      expect(localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(id);
    });

    it("recupera o ID existente caso já esteja salvo no localStorage", () => {
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, "meu-dispositivo-salvo-123");
      const id = getOrCreateDeviceId();
      expect(id).toBe("meu-dispositivo-salvo-123");
    });
  });

  describe("detectOS", () => {
    it("detecta Windows a partir do User-Agent", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
      expect(detectOS(ua)).toBe("Windows 10/11");
    });

    it("detecta macOS a partir do User-Agent", () => {
      const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
      expect(detectOS(ua)).toBe("macOS");
    });

    it("detecta Linux a partir do User-Agent", () => {
      const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36";
      expect(detectOS(ua)).toBe("Linux");
    });

    it("detecta Android a partir do User-Agent", () => {
      const ua = "Mozilla/5.0 (Linux; U; Android 13; pt-br; Pixel 7)";
      expect(detectOS(ua)).toBe("Android");
    });

    it("detecta iOS a partir do User-Agent", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
      expect(detectOS(ua)).toBe("iOS");
    });

    it("retorna Desconhecido para User-Agent vazio", () => {
      expect(detectOS("")).toBe("Desconhecido");
    });
  });

  describe("detectBrowser", () => {
    it("detecta Google Chrome", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
      expect(detectBrowser(ua)).toBe("Google Chrome");
    });

    it("detecta Microsoft Edge", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
      expect(detectBrowser(ua)).toBe("Microsoft Edge");
    });

    it("detecta Mozilla Firefox", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0";
      expect(detectBrowser(ua)).toBe("Mozilla Firefox");
    });

    it("detecta Safari (quando não tem Chrome)", () => {
      const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15";
      expect(detectBrowser(ua)).toBe("Safari");
    });

    it("detecta Opera", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";
      expect(detectBrowser(ua)).toBe("Opera");
    });

    it("detecta Samsung Internet", () => {
      const ua = "Mozilla/5.0 (Linux; Android 13) Chrome/115.0 SamsungBrowser/22.0";
      expect(detectBrowser(ua)).toBe("Samsung Internet");
    });
  });

  describe("getFriendlyDeviceName", () => {
    it("formata nome para desktop", () => {
      expect(getFriendlyDeviceName("Google Chrome", "Windows 10/11", false)).toBe("Google Chrome no Windows 10/11");
    });

    it("formata nome para mobile", () => {
      expect(getFriendlyDeviceName("Safari", "iOS", true)).toBe("Safari no iOS (Mobile)");
    });
  });

  describe("getDeviceInfo", () => {
    it("retorna payload de registro de dispositivo completo", () => {
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, "dev-test-123");
      const info = getDeviceInfo();
      expect(info.deviceId).toBe("dev-test-123");
      expect(info.deviceName).toBeDefined();
      expect(info.browser).toBeDefined();
      expect(info.os).toBeDefined();
    });
  });

  describe("sincronização e throttle", () => {
    it("shouldSyncDeviceSession retorna true quando nunca sincronizou", () => {
      expect(shouldSyncDeviceSession()).toBe(true);
    });

    it("shouldSyncDeviceSession retorna true quando forçado", () => {
      localStorage.setItem(DEVICE_LAST_SYNC_STORAGE_KEY, Date.now().toString());
      expect(shouldSyncDeviceSession(true)).toBe(true);
    });

    it("shouldSyncDeviceSession retorna false dentro da janela de throttle de 24h", () => {
      localStorage.setItem(DEVICE_LAST_SYNC_STORAGE_KEY, (Date.now() - 1000).toString());
      expect(shouldSyncDeviceSession(false)).toBe(false);
    });

    it("shouldSyncDeviceSession retorna true se expirou o throttle de 24h", () => {
      localStorage.setItem(DEVICE_LAST_SYNC_STORAGE_KEY, (Date.now() - (SYNC_THROTTLE_MS + 1000)).toString());
      expect(shouldSyncDeviceSession(false)).toBe(true);
    });

    it("markDeviceSessionSynced grava o timestamp atual", () => {
      markDeviceSessionSynced();
      const val = localStorage.getItem(DEVICE_LAST_SYNC_STORAGE_KEY);
      expect(val).toBeDefined();
      expect(parseInt(val!, 10)).toBeGreaterThan(0);
    });

    it("clearDeviceSessionSync limpa o storage de sync", () => {
      markDeviceSessionSynced();
      clearDeviceSessionSync();
      expect(localStorage.getItem(DEVICE_LAST_SYNC_STORAGE_KEY)).toBeNull();
    });
  });
});
