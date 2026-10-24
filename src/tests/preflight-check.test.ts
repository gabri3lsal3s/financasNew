import { describe, expect, it } from "vitest";
import {
  checkEnvironmentVariables,
  checkNodeVersion,
  compareSemver,
  formatStatusBadge,
} from "../../scripts/preflight-check.ts";

describe("Preflight Check — Checagens Automáticas de Saúde", () => {
  describe("compareSemver", () => {
    it("compara versões idênticas retornando 0", () => {
      expect(compareSemver("22.23.4", "22.23.4")).toBe(0);
      expect(compareSemver("v22.23.4", "22.23.4")).toBe(0);
    });

    it("identifica versão maior", () => {
      expect(compareSemver("22.23.5", "22.23.4")).toBeGreaterThan(0);
      expect(compareSemver("24.0.0", "22.23.4")).toBeGreaterThan(0);
    });

    it("identifica versão menor", () => {
      expect(compareSemver("22.23.1", "22.23.4")).toBeLessThan(0);
      expect(compareSemver("20.10.0", "22.23.4")).toBeLessThan(0);
    });
  });

  describe("checkNodeVersion", () => {
    it("aprova com SUCESSO quando a versão do Node for maior ou igual à do .nvmrc", () => {
      const result = checkNodeVersion("22.23.4", "/non/existent/path");
      expect(result.status).toBe("SUCCESS");
      expect(result.message).toContain("em conformidade estrita");
    });

    it("emite ALERTA quando estiver em Node 22 com patch inferior ao recomendado", () => {
      const result = checkNodeVersion("22.23.1", "/non/existent/path");
      expect(result.status).toBe("WARNING");
      expect(result.message).toContain("Recomendado v22.23.4");
    });

    it("emite FALHA quando estiver em versão legada (ex.: Node 18 ou 20)", () => {
      const result = checkNodeVersion("20.12.0", "/non/existent/path");
      expect(result.status).toBe("FAILURE");
      expect(result.message).toContain("incompatível");
    });
  });

  describe("checkEnvironmentVariables", () => {
    it("aprova com SUCESSO quando todas as variáveis obrigatórias estiverem válidas", () => {
      const result = checkEnvironmentVariables({
        VITE_SUPABASE_URL: "https://abcdefgh123.supabase.co",
        VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdef1234567890",
        VITE_DEFAULT_BILLING_PROVIDER: "asaas",
        VITE_SENTRY_DSN: "https://mock@sentry.io/123",
      });

      expect(result.status).toBe("SUCCESS");
      expect(result.message).toContain("validadas com sucesso");
    });

    it("emite FALHA quando VITE_SUPABASE_URL estiver ausente", () => {
      const result = checkEnvironmentVariables({
        VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdef1234567890",
      });

      expect(result.status).toBe("FAILURE");
      expect(result.message).toContain("VITE_SUPABASE_URL");
    });

    it("emite FALHA quando VITE_SUPABASE_URL não for uma URL válida", () => {
      const result = checkEnvironmentVariables({
        VITE_SUPABASE_URL: "invalid-url",
        VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdef1234567890",
      });

      expect(result.status).toBe("FAILURE");
      expect(result.message).toContain("formato de URL inválido");
    });

    it("emite FALHA quando VITE_SUPABASE_ANON_KEY for muito curta", () => {
      const result = checkEnvironmentVariables({
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_ANON_KEY: "short_key",
      });

      expect(result.status).toBe("FAILURE");
      expect(result.message).toContain("VITE_SUPABASE_ANON_KEY");
    });

    it("emite aviso amigável quando VITE_DEFAULT_BILLING_PROVIDER não for explicitado", () => {
      const result = checkEnvironmentVariables({
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdef1234567890",
      });

      expect(result.status).toBe("SUCCESS");
      expect(result.details?.some((d) => d.includes("asaas"))).toBe(true);
    });
  });

  describe("formatStatusBadge", () => {
    it("formata crachás legíveis com cores para cada status", () => {
      expect(formatStatusBadge("SUCCESS")).toContain("SUCESSO");
      expect(formatStatusBadge("WARNING")).toContain("ALERTA");
      expect(formatStatusBadge("FAILURE")).toContain("FALHA");
    });
  });
});
