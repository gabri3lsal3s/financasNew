import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicAppUrl } from "./app-url";

describe("services/app-url — getPublicAppUrl", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  function mockOrigin(origin: string) {
    Object.defineProperty(window, "location", {
      value: {
        ...originalLocation,
        origin,
      },
      writable: true,
      configurable: true,
    });
  }

  describe("com VITE_PUBLIC_SITE_URL configurada", () => {
    it("deve priorizar a variavel de ambiente sobre window.location.origin", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://preview.axisfinance.app");
      mockOrigin("https://producao.outrodominio.com");

      expect(getPublicAppUrl("/entrar")).toBe("https://preview.axisfinance.app/entrar");
    });

    it("deve remover barras finais da URL base configurada", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://preview.axisfinance.app///");

      expect(getPublicAppUrl("/redefinir-senha")).toBe("https://preview.axisfinance.app/redefinir-senha");
      expect(getPublicAppUrl()).toBe("https://preview.axisfinance.app");
    });

    it("deve formatar caminhos com ou sem barra inicial e com query params", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://preview.axisfinance.app");

      expect(getPublicAppUrl("entrar")).toBe("https://preview.axisfinance.app/entrar");
      expect(getPublicAppUrl("/configuracoes?tab=conta")).toBe("https://preview.axisfinance.app/configuracoes?tab=conta");
      expect(getPublicAppUrl("")).toBe("https://preview.axisfinance.app");
    });
  });

  describe("em ambiente Web de cloud ou producao (sem VITE_PUBLIC_SITE_URL)", () => {
    it("deve usar window.location.origin quando for um endereco HTTP(S) publico", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("https://financasnew.pages.dev");

      expect(getPublicAppUrl("/entrar")).toBe("https://financasnew.pages.dev/entrar");
      expect(getPublicAppUrl("redefinir-senha")).toBe("https://financasnew.pages.dev/redefinir-senha");
      expect(getPublicAppUrl()).toBe("https://financasnew.pages.dev");
    });

    it("deve usar dominio proprio customizado automaticamente quando configurado", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("https://app.meudominio.com.br");

      expect(getPublicAppUrl("/entrar")).toBe("https://app.meudominio.com.br/entrar");
      expect(getPublicAppUrl("r/tok-split")).toBe("https://app.meudominio.com.br/r/tok-split");
      expect(getPublicAppUrl()).toBe("https://app.meudominio.com.br");
    });
  });

  describe("em ambiente Mobile Nativo (Capacitor)", () => {
    it("deve ignorar origin capacitor://localhost e utilizar fallback canonico https://financasnew.pages.dev", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("capacitor://localhost");

      expect(getPublicAppUrl("/entrar")).toBe("https://financasnew.pages.dev/entrar");
      expect(getPublicAppUrl("/redefinir-senha")).toBe("https://financasnew.pages.dev/redefinir-senha");
      expect(getPublicAppUrl()).toBe("https://financasnew.pages.dev");
    });

    it("deve ignorar origin https://localhost (esquema padrao Android Pro) e resolver links sociais", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("https://localhost");

      // Links de Racha, Familia, Metas e Orcamento nunca devem conter localhost
      expect(getPublicAppUrl("r/tok-split-99")).toBe("https://financasnew.pages.dev/r/tok-split-99");
      expect(getPublicAppUrl("/convite-familiar/tok-fam-88")).toBe("https://financasnew.pages.dev/convite-familiar/tok-fam-88");
      expect(getPublicAppUrl("meta/tok-meta-77")).toBe("https://financasnew.pages.dev/meta/tok-meta-77");
      expect(getPublicAppUrl("orcamento-familiar/tok-orc-66")).toBe("https://financasnew.pages.dev/orcamento-familiar/tok-orc-66");
      expect(getPublicAppUrl("ferramentas/juros-compostos")).toBe("https://financasnew.pages.dev/ferramentas/juros-compostos");
      expect(getPublicAppUrl("criar-conta?convite=VIP2026")).toBe("https://financasnew.pages.dev/criar-conta?convite=VIP2026");
    });
  });

  describe("em ambiente Localhost / Desenvolvimento local", () => {
    it("deve usar http://localhost:5173 diretamente no navegador Web", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("http://localhost:5173");

      expect(getPublicAppUrl("/entrar")).toBe("http://localhost:5173/entrar");
      expect(getPublicAppUrl()).toBe("http://localhost:5173");
      expect(getPublicAppUrl("r/racha123")).toBe("http://localhost:5173/r/racha123");
    });

    it("deve usar http://127.0.0.1:5173 diretamente no navegador Web", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("http://127.0.0.1:5173");

      expect(getPublicAppUrl("/entrar")).toBe("http://127.0.0.1:5173/entrar");
      expect(getPublicAppUrl()).toBe("http://127.0.0.1:5173");
      expect(getPublicAppUrl("convite-familiar/fam123")).toBe("http://127.0.0.1:5173/convite-familiar/fam123");
    });
  });
});
