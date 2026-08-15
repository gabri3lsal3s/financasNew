import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Auditoria estática PWA (F5.6) — proxy automatizado dos checks de
 * "instalabilidade" do Lighthouse: manifest válido, ícones 192/512/maskable,
 * meta tags iOS/splash e o fluxo do Service Worker. A auditoria Lighthouse
 * completa (≥ 90) exige app servido em HTTPS — ver docs/PWA_GUIDELINES.md §7.
 */
describe("Auditoria PWA (instalabilidade)", () => {
  const root = process.cwd();

  it("manifest válido com os campos e ícones obrigatórios", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "public/pwa/manifest.webmanifest"), "utf8"));

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("portrait");
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.lang).toBe("pt-BR");

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
  });

  it("ícones PWA existem em disco (192/512/maskable/apple-touch)", () => {
    for (const file of ["icon-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon-180.png"]) {
      expect(existsSync(resolve(root, "public/pwa/icons", file))).toBe(true);
    }
  });

  it("index.html tem meta tags PWA/iOS e viewport com safe areas", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");

    expect(html).toContain('rel="manifest"');
    expect(html).toContain('name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"');
    expect(html).toContain('name="theme-color" media="(prefers-color-scheme: light)"');
    expect(html).toContain('name="theme-color" media="(prefers-color-scheme: dark)"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Guia Financeiro"');
  });

  it("Service Worker: autoUpdate com onNeedReload (toast, sem reload automático)", () => {
    const pwa = readFileSync(resolve(root, "src/app/pwa.ts"), "utf8");

    expect(pwa).toContain("registerSW(");
    expect(pwa).toContain("onNeedReload");
    expect(pwa).toContain("beforeinstallprompt");
    expect(pwa).toContain("appinstalled");
  });
});
