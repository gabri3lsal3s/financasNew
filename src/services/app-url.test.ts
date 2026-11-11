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

  describe("em ambiente Web (navegador comum)", () => {
    it("deve sempre adotar window.location.origin com base no dominio que esta sendo acessado", () => {
      mockOrigin("https://axir.com.br");
      expect(getPublicAppUrl("/entrar")).toBe("https://axir.com.br/entrar");
      expect(getPublicAppUrl("viagem/tok123")).toBe("https://axir.com.br/viagem/tok123");

      mockOrigin("https://preview.axisfinance.app");
      expect(getPublicAppUrl("/entrar")).toBe("https://preview.axisfinance.app/entrar");
      expect(getPublicAppUrl("r/tok-split")).toBe("https://preview.axisfinance.app/r/tok-split");

      mockOrigin("https://qualquer-dominio.com.br");
      expect(getPublicAppUrl("/redefinir-senha")).toBe("https://qualquer-dominio.com.br/redefinir-senha");
      expect(getPublicAppUrl()).toBe("https://qualquer-dominio.com.br");
    });

    it("deve formatar caminhos com ou sem barra inicial e com query params", () => {
      mockOrigin("https://axir.com.br");
      expect(getPublicAppUrl("entrar")).toBe("https://axir.com.br/entrar");
      expect(getPublicAppUrl("/configuracoes?tab=conta")).toBe("https://axir.com.br/configuracoes?tab=conta");
      expect(getPublicAppUrl("")).toBe("https://axir.com.br");
    });
  });

  describe("em ambiente Mobile Nativo (Capacitor)", () => {
    it("deve ignorar origin capacitor://localhost e utilizar fallback canonico https://axir.com.br", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("capacitor://localhost");

      expect(getPublicAppUrl("/entrar")).toBe("https://axir.com.br/entrar");
      expect(getPublicAppUrl("/redefinir-senha")).toBe("https://axir.com.br/redefinir-senha");
      expect(getPublicAppUrl()).toBe("https://axir.com.br");
    });

    it("deve normalizar VITE_PUBLIC_SITE_URL se contiver workers.dev ou pages.dev em ambiente nativo", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://financasnew.gabrielisaacsales.workers.dev");
      mockOrigin("https://localhost");

      expect(getPublicAppUrl("/entrar")).toBe("https://axir.com.br/entrar");
      expect(getPublicAppUrl("viagem/tok123")).toBe("https://axir.com.br/viagem/tok123");
    });

    it("deve respeitar VITE_PUBLIC_SITE_URL customizada valida em ambiente nativo", () => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://app.customdomain.com");
      mockOrigin("https://localhost");

      expect(getPublicAppUrl("/entrar")).toBe("https://app.customdomain.com/entrar");
      expect(getPublicAppUrl("r/tok-split")).toBe("https://app.customdomain.com/r/tok-split");
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
