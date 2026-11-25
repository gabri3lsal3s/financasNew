import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertAsaasEnvironmentMatch,
  getAsaasApiKey,
  getAsaasBaseUrl,
} from "../../supabase/functions/_shared/asaas.ts";
import { timingSafeEqualString } from "../../supabase/functions/_shared/http.ts";

describe("Credenciais e Configuração Asaas (Edge Functions)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ASAAS_API_KEY;
    delete process.env.ASAAS_API_URL;
    delete process.env.ASAAS_ENVIRONMENT;
    delete process.env.ASAAS_WEBHOOK_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getAsaasBaseUrl", () => {
    it("utiliza ASAAS_API_URL quando definida, removendo barras finais", () => {
      process.env.ASAAS_API_URL = "https://api.asaas.com/v3///";
      expect(getAsaasBaseUrl()).toBe("https://api.asaas.com/v3");
    });

    it("utiliza URL de produção quando ASAAS_ENVIRONMENT for 'production'", () => {
      process.env.ASAAS_ENVIRONMENT = "production";
      expect(getAsaasBaseUrl()).toBe("https://api.asaas.com/v3");
    });

    it("utiliza URL de sandbox quando ASAAS_ENVIRONMENT for 'sandbox'", () => {
      process.env.ASAAS_ENVIRONMENT = "sandbox";
      expect(getAsaasBaseUrl()).toBe("https://api-sandbox.asaas.com/v3");
    });

    it("falha fechado (throw) quando ASAAS_API_URL e ASAAS_ENVIRONMENT estão ausentes (M-06)", () => {
      expect(() => getAsaasBaseUrl()).toThrowError(/Ambiente Asaas não configurado/);
    });

    it("prioriza ASAAS_API_URL mesmo se ASAAS_ENVIRONMENT estiver configurado", () => {
      process.env.ASAAS_API_URL = "https://custom-gateway.asaas.com/v3";
      process.env.ASAAS_ENVIRONMENT = "sandbox";
      expect(getAsaasBaseUrl()).toBe("https://custom-gateway.asaas.com/v3");
    });
  });

  describe("getAsaasApiKey", () => {
    it("retorna a chave de API limpa quando presente no ambiente", () => {
      process.env.ASAAS_API_KEY = "  $aact_sample_token_123  ";
      expect(getAsaasApiKey()).toBe("$aact_sample_token_123");
    });

    it("lança erro amigável em pt-BR quando ASAAS_API_KEY estiver ausente", () => {
      expect(() => getAsaasApiKey()).toThrowError("Chave ASAAS_API_KEY não configurada no ambiente.");
    });

    it("lança erro amigável em pt-BR quando ASAAS_API_KEY estiver vazia ou com apenas espaços", () => {
      process.env.ASAAS_API_KEY = "   ";
      expect(() => getAsaasApiKey()).toThrowError("Chave ASAAS_API_KEY não configurada no ambiente.");
    });
  });

  describe("ASAAS_WEBHOOK_TOKEN e timingSafeEqualString", () => {
    it("autentica com sucesso quando o token recebido for idêntico ao esperado", async () => {
      const secret = "whsec_super_secret_token_2026";
      const isValid = await timingSafeEqualString(secret, secret);
      expect(isValid).toBe(true);
    });

    it("rejeita quando o token recebido for diferente do esperado", async () => {
      const secret = "whsec_super_secret_token_2026";
      const invalid = "whsec_wrong_token";
      const isValid = await timingSafeEqualString(invalid, secret);
      expect(isValid).toBe(false);
    });
  });

  describe("assertAsaasEnvironmentMatch", () => {
    it("rejeita chave sandbox ($aact_hmlg_) configurada com URL de produção", () => {
      expect(() =>
        assertAsaasEnvironmentMatch("$aact_hmlg_sample_123", "https://api.asaas.com/v3"),
      ).toThrowError(/Incompatibilidade de segurança/);
    });

    it("rejeita chave produção ($aact_prod_) configurada com URL de sandbox", () => {
      expect(() =>
        assertAsaasEnvironmentMatch("$aact_prod_sample_123", "https://api-sandbox.asaas.com/v3"),
      ).toThrowError(/Incompatibilidade de segurança/);
    });

    it("aceita chave produção ($aact_prod_) com URL de produção", () => {
      expect(() =>
        assertAsaasEnvironmentMatch("$aact_prod_sample_123", "https://api.asaas.com/v3"),
      ).not.toThrow();
    });
  });
});
