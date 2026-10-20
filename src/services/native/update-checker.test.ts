import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAppUpdatePlugin = vi.hoisted(() => ({
  canRequestPackageInstalls: vi.fn().mockResolvedValue({ canInstall: true }),
  openInstallPermissionSettings: vi.fn().mockResolvedValue(undefined),
  installApk: vi.fn().mockResolvedValue(undefined),
  downloadAndInstall: vi.fn().mockResolvedValue({ downloadId: 123, status: "downloading" }),
}));

vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return {
    ...actual,
    registerPlugin: () => mockAppUpdatePlugin,
  };
});

vi.mock("@capacitor/app", () => ({
  App: {
    getInfo: vi.fn().mockResolvedValue({
      version: "1.0.0",
      build: "1",
    }),
  },
}));

import { checkAppUpdate, triggerAppUpdate } from "./update-checker";
import * as platformModule from "./platform";

describe("update-checker service", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("detecta quando existe versão mais recente disponível", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        version: "1.1.0",
        versionCode: 2,
        releaseDate: "2026-10-20T16:00:00Z",
        apkUrl: "/releases/guia-financeiro-release.apk",
        changelog: ["Novas funcionalidades"],
      }),
    });

    const result = await checkAppUpdate();

    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe("1.1.0");
    expect(result.latestVersionCode).toBe(2);
    expect(result.currentVersionCode).toBe(1);
    expect(result.manifest?.apkUrl).toBe("/releases/guia-financeiro-release.apk");
  });

  it("identifica quando o app já está atualizado (versionCode igual)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        version: "1.0.0",
        versionCode: 1,
        releaseDate: "2026-10-20T16:00:00Z",
        apkUrl: "/releases/guia-financeiro-release.apk",
        changelog: [],
      }),
    });

    const result = await checkAppUpdate();

    expect(result.hasUpdate).toBe(false);
    expect(result.currentVersionCode).toBe(1);
    expect(result.latestVersionCode).toBe(1);
  });

  it("trata erro HTTP do servidor graciosamente", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const result = await checkAppUpdate();

    expect(result.hasUpdate).toBe(false);
    expect(result.error).toContain("404");
  });

  it("trata schema JSON inválido graciosamente", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        invalidField: true,
      }),
    });

    const result = await checkAppUpdate();

    expect(result.hasUpdate).toBe(false);
    expect(result.error).toContain("formato inválido");
  });

  it("dispara download na web simulando clique em link", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    const clickSpy = vi.fn();
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue({
      set href(_val: string) {},
      set download(_val: string) {},
      set target(_val: string) {},
      set rel(_val: string) {},
      click: clickSpy,
    } as unknown as HTMLAnchorElement);

    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    await triggerAppUpdate({
      version: "1.1.0",
      versionCode: 2,
      releaseDate: "2026-10-20T16:00:00Z",
      apkUrl: "https://dl.guiafinanceiro.app/axis-pro.apk",
      changelog: [],
    });

    expect(clickSpy).toHaveBeenCalled();
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it("dispara download nativo quando em plataforma nativa", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    await triggerAppUpdate({
      version: "1.1.0",
      versionCode: 2,
      releaseDate: "2026-10-20T16:00:00Z",
      apkUrl: "/releases/axis-pro.apk",
      sha256: "hash123",
      changelog: [],
    });

    expect(mockAppUpdatePlugin.downloadAndInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        sha256: "hash123",
      })
    );
  });
});
