import { existsSync, readFileSync, statSync } from "node:fs";
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
    expect(manifest.icons.some((icon: { purpose?: string; sizes: string }) => icon.purpose === "any" && icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((icon: { purpose?: string; sizes: string }) => icon.purpose === "any" && icon.sizes === "512x512")).toBe(true);
    expect(manifest.icons.some((icon: { purpose?: string; sizes: string }) => icon.purpose === "maskable" && icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((icon: { purpose?: string; sizes: string }) => icon.purpose === "maskable" && icon.sizes === "512x512")).toBe(true);
  });

  it("ícones PWA e favicons existem em disco (192/512/maskable/apple-touch/favicon)", () => {
    for (const file of [
      "icon-192.png",
      "icon-512.png",
      "icon-transparent-192.png",
      "icon-transparent-512.png",
      "maskable-192.png",
      "maskable-512.png",
      "apple-touch-icon-180.png",
    ]) {
      expect(existsSync(resolve(root, "public/pwa/icons", file))).toBe(true);
    }

    expect(existsSync(resolve(root, "public/favicon.svg"))).toBe(true);
    expect(existsSync(resolve(root, "public/favicon.ico"))).toBe(true);

    // Auditoria de assets estáticos (Tarefa 4.1): vetor puro sem raster embutido
    const svgFavicon = readFileSync(resolve(root, "public/favicon.svg"), "utf8");
    expect(svgFavicon).not.toContain("data:image/png;base64");
    expect(svgFavicon).toContain("<svg");
    expect(statSync(resolve(root, "public/favicon.svg")).size).toBeLessThan(10 * 1024);

    // Lockup da marca em formatos modernos leves (< 300 KB)
    expect(existsSync(resolve(root, "public/brand/logo-full.png"))).toBe(true);
    expect(existsSync(resolve(root, "public/brand/logo-full.webp"))).toBe(true);
    expect(statSync(resolve(root, "public/brand/logo-full.png")).size).toBeLessThan(300 * 1024);
    expect(statSync(resolve(root, "public/brand/logo-full.webp")).size).toBeLessThan(300 * 1024);
  });

  it("index.html tem meta tags PWA/iOS e viewport com safe areas", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");

    expect(html).toContain('rel="manifest"');
    expect(html).toContain(
      'name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"',
    );
    expect(html).toContain('name="color-scheme" content="light dark"');
    expect(html).toContain('name="theme-color" media="(prefers-color-scheme: light)"');
    expect(html).toContain('name="theme-color" media="(prefers-color-scheme: dark)"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Áxis Finance"');
  });

  it("Service Worker: autoUpdate com onNeedReload (toast, sem reload automático)", () => {
    const pwa = readFileSync(resolve(root, "src/app/pwa.ts"), "utf8");

    expect(pwa).toContain("registerSW(");
    expect(pwa).toContain("onNeedReload");
    expect(pwa).toContain("beforeinstallprompt");
    expect(pwa).toContain("appinstalled");
  });

  it("manifest possui ícones versionados determinísticos (?v=) para WebAPK", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "public/pwa/manifest.webmanifest"), "utf8"));
    expect(manifest.icons.every((icon: { src: string }) => icon.src.includes("?v="))).toBe(true);
  });

  it("Service Worker: configuração Workbox possui cleanupOutdatedCaches e isolamento de brand assets", () => {
    const viteConfig = readFileSync(resolve(root, "vite.config.ts"), "utf8");

    expect(viteConfig).toContain("cleanupOutdatedCaches: true");
    expect(viteConfig).toContain("pwa-brand-assets");
    expect(viteConfig).toContain("NetworkFirst");
    expect(viteConfig).toContain("static-images");
    expect(viteConfig).toContain("StaleWhileRevalidate");
  });

  it("Service Worker: fluxo atômico com controllerchange e purga de cache em pwa.ts", () => {
    const pwa = readFileSync(resolve(root, "src/app/pwa.ts"), "utf8");

    expect(pwa).toContain("applyPWAUpdate");
    expect(pwa).toContain("waitForControllerChange");
    expect(pwa).toContain("controllerchange");
    expect(pwa).toContain("purgeLegacyCaches");
  });

  it("cabeçalhos HTTP de borda (_headers) configuram políticas estritas de cache", () => {
    const headers = readFileSync(resolve(root, "public/_headers"), "utf8");

    expect(headers).toContain("/sw.js");
    expect(headers).toContain("/index.html");
    expect(headers).toContain("/pwa/manifest.webmanifest");
    expect(headers).toContain("max-age=0, must-revalidate");
    expect(headers).toContain("/assets/*");
    expect(headers).toContain("max-age=31536000, immutable");
  });

  it("Página de contingência offline.html existe em public/pwa/ e public/", () => {
    expect(existsSync(resolve(root, "public/pwa/offline.html"))).toBe(true);
    expect(existsSync(resolve(root, "public/offline.html"))).toBe(true);
    const offlineHtml = readFileSync(resolve(root, "public/pwa/offline.html"), "utf8");
    expect(offlineHtml).toContain("Sem conexão");
  });

  it("dist contém artefatos homologados para deploy (sw.js, manifest, offline.html, workbox)", () => {
    const distPath = resolve(root, "dist");
    if (!existsSync(distPath)) return;

    expect(existsSync(resolve(distPath, "index.html"))).toBe(true);
    expect(existsSync(resolve(distPath, "sw.js"))).toBe(true);
    expect(existsSync(resolve(distPath, "offline.html"))).toBe(true);
    expect(existsSync(resolve(distPath, "pwa/offline.html"))).toBe(true);
    expect(existsSync(resolve(distPath, "pwa/manifest.webmanifest"))).toBe(true);
    expect(existsSync(resolve(distPath, "_headers"))).toBe(true);

    const swContent = readFileSync(resolve(distPath, "sw.js"), "utf8");
    expect(swContent).toContain("workbox");
  });
});
