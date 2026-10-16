import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAssetClassMeta } from "@/components/modules/portfolio/position-types";

describe("Sistema Unificado de Ícones e Reatividade ao Tema (Tarefa 23)", () => {
  const tokensCssPath = resolve(process.cwd(), "src/styles/tokens.css");
  const globalsCssPath = resolve(process.cwd(), "src/styles/globals.css");
  const tokensCss = readFileSync(tokensCssPath, "utf-8");
  const globalsCss = readFileSync(globalsCssPath, "utf-8");

  describe("Ação 1: Escala de tamanhos e espessura única de traço (stroke-width)", () => {
    it("define --icon-stroke-width: 1.85px nos tokens CSS para tema light", () => {
      expect(tokensCss).toMatch(/--icon-stroke-width:\s*1\.85px;/);
    });

    it("define --icon-stroke-width: 1.85px nos temas dark e oled", () => {
      const darkBlock = tokensCss.slice(tokensCss.indexOf('data-theme="dark"'));
      expect(darkBlock).toMatch(/--icon-stroke-width:\s*1\.85px;/);

      const oledBlock = tokensCss.slice(tokensCss.indexOf('data-theme="oled"'));
      expect(oledBlock).toMatch(/--icon-stroke-width:\s*1\.85px;/);
    });

    it("aplica a espessura unificada globalmente para svg.lucide e .lucide no globals.css", () => {
      expect(globalsCss).toContain("svg.lucide");
      expect(globalsCss).toContain(".lucide");
      expect(globalsCss).toMatch(/stroke-width:\s*var\(--icon-stroke-width,\s*1\.85px\);/);
      expect(globalsCss).toMatch(/flex-shrink:\s*0;/);
    });

    it("expõe a escala canônica de utilitários de ícones (.icon-xs até .icon-2xl)", () => {
      expect(globalsCss).toContain(".icon-xs");
      expect(globalsCss).toContain(".icon-sm");
      expect(globalsCss).toContain(".icon-md");
      expect(globalsCss).toContain(".icon-lg");
      expect(globalsCss).toContain(".icon-xl");
      expect(globalsCss).toContain(".icon-2xl");
    });
  });

  describe("Ação 2: Substituição de cores estáticas por variáveis de tema", () => {
    it("getAssetClassMeta resolve tokens de tema dinâmicos para todas as classes de ativos", () => {
      const acoes = getAssetClassMeta("Ações");
      expect(acoes.badgeClass).toContain("bg-cat-2/10");
      expect(acoes.badgeClass).toContain("text-cat-2");
      expect(acoes.badgeClass).toContain("border-cat-2/25");

      const fiis = getAssetClassMeta("FIIs");
      expect(fiis.badgeClass).toContain("bg-cat-5/10");
      expect(fiis.badgeClass).toContain("text-cat-5");
      expect(fiis.badgeClass).toContain("border-cat-5/25");

      const inter = getAssetClassMeta("Internacional");
      expect(inter.badgeClass).toContain("bg-cat-1/10");
      expect(inter.badgeClass).toContain("text-cat-1");
      expect(inter.badgeClass).toContain("border-cat-1/25");

      const etf = getAssetClassMeta("ETFs");
      expect(etf.badgeClass).toContain("bg-cat-7/10");
      expect(etf.badgeClass).toContain("text-cat-7");
      expect(etf.badgeClass).toContain("border-cat-7/25");

      const rf = getAssetClassMeta("Renda Fixa");
      expect(rf.badgeClass).toContain("bg-warning/10");
      expect(rf.badgeClass).toContain("text-warning-strong");
      expect(rf.badgeClass).toContain("border-warning/25");

      const caixa = getAssetClassMeta("Caixa");
      expect(caixa.badgeClass).toContain("bg-portfolio/10");
      expect(caixa.badgeClass).toContain("text-portfolio");
      expect(caixa.badgeClass).toContain("border-portfolio/25");

      const outros = getAssetClassMeta("Outros");
      expect(outros.badgeClass).toContain("bg-surface-hover/80");
      expect(outros.badgeClass).toContain("text-muted-foreground");
      expect(outros.badgeClass).toContain("border-border/80");
    });

    it("não contém cores estáticas legadas em getAssetClassMeta", () => {
      const classes = ["Ações", "FIIs", "Internacional", "ETFs", "Renda Fixa", "Caixa", "Outros"];
      for (const cls of classes) {
        const meta = getAssetClassMeta(cls);
        expect(meta.badgeClass).not.toContain("emerald-500");
        expect(meta.badgeClass).not.toContain("indigo-500");
        expect(meta.badgeClass).not.toContain("sky-500");
        expect(meta.badgeClass).not.toContain("violet-500");
        expect(meta.badgeClass).not.toContain("amber-500");
        expect(meta.badgeClass).not.toContain("slate-500");
      }
    });
  });

  describe("Ação 3: Harmonização de contraste e transparência dos containers de ícones", () => {
    it("declara classes utilitárias padronizadas de icon-box reativas ao tema", () => {
      expect(globalsCss).toContain(".icon-box-primary");
      expect(globalsCss).toContain(".icon-box-positive");
      expect(globalsCss).toContain(".icon-box-negative");
      expect(globalsCss).toContain(".icon-box-warning");
      expect(globalsCss).toContain(".icon-box-critical");
      expect(globalsCss).toContain(".icon-box-portfolio");
      expect(globalsCss).toContain(".icon-box-neutral");
      expect(globalsCss).toContain(".icon-box-accent");
    });

    it("assegura contraste harmonizado com bordas sutis nos containers", () => {
      expect(globalsCss).toMatch(/\.icon-box-primary\s*\{[^}]*border:\s*1px solid hsl\(var\(--primary\) \/ 0\.20\);/);
      expect(globalsCss).toMatch(/\.icon-box-positive\s*\{[^}]*border:\s*1px solid hsl\(var\(--positive\) \/ 0\.20\);/);
      expect(globalsCss).toMatch(/\.icon-box-warning\s*\{[^}]*border:\s*1px solid hsl\(var\(--warning\) \/ 0\.20\);/);
      expect(globalsCss).toMatch(/\.icon-box-portfolio\s*\{[^}]*border:\s*1px solid hsl\(var\(--portfolio\) \/ 0\.20\);/);
    });
  });
});
