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

  describe("em ambiente Web de producao (sem VITE_PUBLIC_SITE_URL)", () => {
    it("deve usar window.location.origin quando for um endereco HTTP(S) publico", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("https://app.axisfinance.com");

      expect(getPublicAppUrl("/entrar")).toBe("https://app.axisfinance.com/entrar");
      expect(getPublicAppUrl("redefinir-senha")).toBe("https://app.axisfinance.com/redefinir-senha");
      expect(getPublicAppUrl()).toBe("https://app.axisfinance.com");
    });
  });

  describe("em ambiente Mobile Nativo (Capacitor)", () => {
    it("deve ignorar origin capacitor://localhost e utilizar fallback canonico https://axisfinance.app", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("capacitor://localhost");

      expect(getPublicAppUrl("/entrar")).toBe("https://axisfinance.app/entrar");
      expect(getPublicAppUrl("/redefinir-senha")).toBe("https://axisfinance.app/redefinir-senha");
      expect(getPublicAppUrl()).toBe("https://axisfinance.app");
    });

    it("deve ignorar origin https://localhost (esquema padrao Android Pro) e resolver links sociais", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("https://localhost");

      // Links de Racha, Familia, Metas e Orcamento nunca devem conter localhost
      expect(getPublicAppUrl("r/tok-split-99")).toBe("https://axisfinance.app/r/tok-split-99");
      expect(getPublicAppUrl("/convite-familiar/tok-fam-88")).toBe("https://axisfinance.app/convite-familiar/tok-fam-88");
      expect(getPublicAppUrl("meta/tok-meta-77")).toBe("https://axisfinance.app/meta/tok-meta-77");
      expect(getPublicAppUrl("orcamento-familiar/tok-orc-66")).toBe("https://axisfinance.app/orcamento-familiar/tok-orc-66");
      expect(getPublicAppUrl("ferramentas/juros-compostos")).toBe("https://axisfinance.app/ferramentas/juros-compostos");
      expect(getPublicAppUrl("criar-conta?convite=VIP2026")).toBe("https://axisfinance.app/criar-conta?convite=VIP2026");
    });
  });

  describe("em ambiente Localhost / Desenvolvimento local", () => {
    it("deve ignorar http://localhost e utilizar fallback canonico https://axisfinance.app", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("http://localhost:5173");

      expect(getPublicAppUrl("/entrar")).toBe("https://axisfinance.app/entrar");
      expect(getPublicAppUrl()).toBe("https://axisfinance.app");
      expect(getPublicAppUrl("r/racha123")).toBe("https://axisfinance.app/r/racha123");
    });

    it("deve ignorar http://127.0.0.1 e utilizar fallback canonico https://axisfinance.app", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("http://127.0.0.1:5173");

      expect(getPublicAppUrl("/entrar")).toBe("https://axisfinance.app/entrar");
      expect(getPublicAppUrl()).toBe("https://axisfinance.app");
      expect(getPublicAppUrl("convite-familiar/fam123")).toBe("https://axisfinance.app/convite-familiar/fam123");
    });
  });
});
