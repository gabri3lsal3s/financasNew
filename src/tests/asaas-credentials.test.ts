import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAsaasApiKey, getAsaasBaseUrl } from "../../supabase/functions/_shared/asaas.ts";
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

    it("faz fallback para sandbox quando nenhuma URL ou ambiente for especificado", () => {
      expect(getAsaasBaseUrl()).toBe("https://sandbox.asaas.com/api/v3");
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
});
