import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicAppUrl } from "./app-url";

describe("services/share-urls — Resolução Canônica de Links Compartilháveis", () => {
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

  describe("Cenário 1: App Nativo Android (WebView Capacitor com https://localhost)", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("https://localhost");
    });

    it("link de Racha (/r/:token) NÃO deve conter localhost", () => {
      const token = "split_abc123";
      const shareUrl = getPublicAppUrl(`r/${token}`);

      expect(shareUrl).not.toContain("localhost");
      expect(shareUrl).toBe("https://axisfinance.app/r/split_abc123");
    });

    it("link de Convite Familiar (/convite-familiar/:token) NÃO deve conter localhost", () => {
      const token = "invite_xyz789";
      const inviteUrl = getPublicAppUrl(`convite-familiar/${token}`);

      expect(inviteUrl).not.toContain("localhost");
      expect(inviteUrl).toBe("https://axisfinance.app/convite-familiar/invite_xyz789");
    });

    it("link de Orçamento Familiar compartilhado (/orcamento-familiar/:token) NÃO deve conter localhost", () => {
      const token = "budget_fam456";
      const budgetUrl = getPublicAppUrl(`orcamento-familiar/${token}`);

      expect(budgetUrl).not.toContain("localhost");
      expect(budgetUrl).toBe("https://axisfinance.app/orcamento-familiar/budget_fam456");
    });

    it("link de Meta Coletiva (/meta/:token) NÃO deve conter localhost", () => {
      const token = "goal_999000";
      const metaUrl = getPublicAppUrl(`meta/${token}`);

      expect(metaUrl).not.toContain("localhost");
      expect(metaUrl).toBe("https://axisfinance.app/meta/goal_999000");
    });

    it("URLs de retorno de checkout (/assinatura/sucesso) NÃO devem conter localhost", () => {
      const returnUrl = getPublicAppUrl("assinatura/sucesso?plano=pro");

      expect(returnUrl).not.toContain("localhost");
      expect(returnUrl).toBe("https://axisfinance.app/assinatura/sucesso?plano=pro");
    });
  });

  describe("Cenário 2: Produção com VITE_PUBLIC_SITE_URL customizada", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://minhafinanca.com.br");
      mockOrigin("https://localhost");
    });

    it("deve usar o domínio configurado em VITE_PUBLIC_SITE_URL mesmo se origin for localhost", () => {
      const splitUrl = getPublicAppUrl("r/tok-prod");
      const famUrl = getPublicAppUrl("convite-familiar/tok-fam");

      expect(splitUrl).toBe("https://minhafinanca.com.br/r/tok-prod");
      expect(famUrl).toBe("https://minhafinanca.com.br/convite-familiar/tok-fam");
    });
  });

  describe("Cenário 3: Navegador Web Público (ex: Cloudflare Pages)", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
      mockOrigin("https://axis-finance.pages.dev");
    });

    it("deve adotar automaticamente a origem pública do navegador", () => {
      const splitUrl = getPublicAppUrl("r/tok-pages");
      const famUrl = getPublicAppUrl("convite-familiar/tok-pages");

      expect(splitUrl).toBe("https://axis-finance.pages.dev/r/tok-pages");
      expect(famUrl).toBe("https://axis-finance.pages.dev/convite-familiar/tok-pages");
    });
  });
});
