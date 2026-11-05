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
  });

  describe("em ambiente Localhost / Desenvolvimento local", () => {
    it("deve ignorar http://localhost e utilizar fallback canonico https://axisfinance.app", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("http://localhost:5173");

      expect(getPublicAppUrl("/entrar")).toBe("https://axisfinance.app/entrar");
      expect(getPublicAppUrl()).toBe("https://axisfinance.app");
    });

    it("deve ignorar http://127.0.0.1 e utilizar fallback canonico https://axisfinance.app", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("http://127.0.0.1:5173");

      expect(getPublicAppUrl("/entrar")).toBe("https://axisfinance.app/entrar");
      expect(getPublicAppUrl()).toBe("https://axisfinance.app");
    });
  });
});
