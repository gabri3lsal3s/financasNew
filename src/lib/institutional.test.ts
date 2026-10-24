import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_INSTITUTIONAL_CONFIG,
  INSTITUTIONAL_CONFIG,
  OFFICIAL_CVM_DISCLAIMER,
  OFFICIAL_TAX_DISCLAIMER,
  OFFICIAL_TAX_FACILITATOR_DISCLAIMER,
  OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER,
  PROMINENT_DISCLOSURE_INFO,
  getInstitutionalConfig,
} from "./institutional";

describe("lib/institutional — InstitutionalConfig & INSTITUTIONAL_CONFIG", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retorna as configurações institucionais padrão seguras quando variáveis de ambiente não estão definidas", () => {
    const config = getInstitutionalConfig();

    expect(config.companyName).toBe(DEFAULT_INSTITUTIONAL_CONFIG.companyName);
    expect(config.cnpj).toBe(DEFAULT_INSTITUTIONAL_CONFIG.cnpj);
    expect(config.address).toBe(DEFAULT_INSTITUTIONAL_CONFIG.address);
    expect(config.dpoEmail).toBe(DEFAULT_INSTITUTIONAL_CONFIG.dpoEmail);
    expect(config.supportEmail).toBe(DEFAULT_INSTITUTIONAL_CONFIG.supportEmail);
    expect(config.appName).toBe(DEFAULT_INSTITUTIONAL_CONFIG.appName);
    expect(config.legalJurisdiction).toBe(DEFAULT_INSTITUTIONAL_CONFIG.legalJurisdiction);
  });

  it("permite leitura via constante INSTITUTIONAL_CONFIG com valores padrão", () => {
    expect(INSTITUTIONAL_CONFIG.companyName).toBe("Áxis Tecnologia & Gestão Financeira Ltda.");
    expect(INSTITUTIONAL_CONFIG.cnpj).toBe("00.000.000/0001-00");
    expect(INSTITUTIONAL_CONFIG.address).toBe("São Paulo/SP — Brasil");
    expect(INSTITUTIONAL_CONFIG.dpoEmail).toBe("privacidade@axis.app");
    expect(INSTITUTIONAL_CONFIG.supportEmail).toBe("suporte@axis.app");
    expect(INSTITUTIONAL_CONFIG.appName).toBe("Áxis Finance");
  });

  it("utiliza variáveis de ambiente customizadas quando fornecidas", () => {
    vi.stubEnv("VITE_APP_COMPANY_NAME", "Minha Empresa SaaS Ltda.");
    vi.stubEnv("VITE_APP_CNPJ", "12.345.678/0001-99");
    vi.stubEnv("VITE_APP_ADDRESS", "Av. Paulista, 1000 - São Paulo/SP");
    vi.stubEnv("VITE_APP_DPO_EMAIL", "dpo@minhaempresa.com.br");
    vi.stubEnv("VITE_APP_SUPPORT_EMAIL", "atendimento@minhaempresa.com.br");
    vi.stubEnv("VITE_APP_NAME", "Áxis Custom");
    vi.stubEnv("VITE_APP_LEGAL_JURISDICTION", "Comarca de Campinas/SP");

    const config = getInstitutionalConfig();

    expect(config.companyName).toBe("Minha Empresa SaaS Ltda.");
    expect(config.cnpj).toBe("12.345.678/0001-99");
    expect(config.address).toBe("Av. Paulista, 1000 - São Paulo/SP");
    expect(config.dpoEmail).toBe("dpo@minhaempresa.com.br");
    expect(config.supportEmail).toBe("atendimento@minhaempresa.com.br");
    expect(config.appName).toBe("Áxis Custom");
    expect(config.legalJurisdiction).toBe("Comarca de Campinas/SP");

    // Constante INSTITUTIONAL_CONFIG com getters dinâmicos reflete as envs
    expect(INSTITUTIONAL_CONFIG.companyName).toBe("Minha Empresa SaaS Ltda.");
    expect(INSTITUTIONAL_CONFIG.cnpj).toBe("12.345.678/0001-99");
    expect(INSTITUTIONAL_CONFIG.address).toBe("Av. Paulista, 1000 - São Paulo/SP");
    expect(INSTITUTIONAL_CONFIG.dpoEmail).toBe("dpo@minhaempresa.com.br");
    expect(INSTITUTIONAL_CONFIG.supportEmail).toBe("atendimento@minhaempresa.com.br");
  });

  it("ignora variáveis com strings em branco e aplica o fallback seguro", () => {
    vi.stubEnv("VITE_APP_COMPANY_NAME", "   ");
    vi.stubEnv("VITE_APP_CNPJ", "");
    vi.stubEnv("VITE_APP_ADDRESS", "  ");
    vi.stubEnv("VITE_APP_DPO_EMAIL", " ");
    vi.stubEnv("VITE_APP_SUPPORT_EMAIL", "");

    const config = getInstitutionalConfig();

    expect(config.companyName).toBe(DEFAULT_INSTITUTIONAL_CONFIG.companyName);
    expect(config.cnpj).toBe(DEFAULT_INSTITUTIONAL_CONFIG.cnpj);
    expect(config.address).toBe(DEFAULT_INSTITUTIONAL_CONFIG.address);
    expect(config.dpoEmail).toBe(DEFAULT_INSTITUTIONAL_CONFIG.dpoEmail);
    expect(config.supportEmail).toBe(DEFAULT_INSTITUTIONAL_CONFIG.supportEmail);

    expect(INSTITUTIONAL_CONFIG.companyName).toBe(DEFAULT_INSTITUTIONAL_CONFIG.companyName);
    expect(INSTITUTIONAL_CONFIG.cnpj).toBe(DEFAULT_INSTITUTIONAL_CONFIG.cnpj);
  });

  it("exporta os disclaimers regulatórios oficiais alinhados às Resoluções CVM 19 e 20", () => {
    expect(OFFICIAL_CVM_DISCLAIMER).toContain("Resolução CVM nº 19/2021");
    expect(OFFICIAL_CVM_DISCLAIMER).toContain("Resolução CVM nº 20/2021");
    expect(OFFICIAL_CVM_DISCLAIMER).toContain("Rentabilidade passada não representa garantia de retorno futuro");

    expect(OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER).toContain("Resolução CVM nº 19/2021");
    expect(OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER).toContain("Resolução CVM nº 20/2021");
    expect(OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER).toContain("Proventos reportados com base no valor líquido creditado em conta");
  });

  it("exporta os disclaimers contábeis e fiscais oficiais alinhados ao CFC e Receita Federal", () => {
    expect(OFFICIAL_TAX_DISCLAIMER).toContain("Receita Federal do Brasil");
    expect(OFFICIAL_TAX_DISCLAIMER).toContain("contador habilitado");
    expect(OFFICIAL_TAX_DISCLAIMER).toContain("CFC");
    expect(OFFICIAL_TAX_DISCLAIMER).toContain("Declaração de Ajuste Anual");

    expect(OFFICIAL_TAX_FACILITATOR_DISCLAIMER).toContain("Receita Federal");
    expect(OFFICIAL_TAX_FACILITATOR_DISCLAIMER).toContain("contador habilitado");
    expect(OFFICIAL_TAX_FACILITATOR_DISCLAIMER).toContain("Declaração de Ajuste Anual");
  });

  it("exporta as especificações oficiais do Prominent Disclosure (Contrato 4) para a Google Play Store", () => {
    expect(PROMINENT_DISCLOSURE_INFO.title).toBe("Consentimento para Leitura de Notificações Bancárias");
    expect(PROMINENT_DISCLOSURE_INFO.onDeviceBadge).toContain("Processamento 100% Local no Aparelho");
    expect(PROMINENT_DISCLOSURE_INFO.onDeviceDescription).toContain("processador do seu celular");
    expect(PROMINENT_DISCLOSURE_INFO.strictPurposeDescription).toContain("BIND_NOTIFICATION_LISTENER_SERVICE");
    expect(PROMINENT_DISCLOSURE_INFO.dataDiscardDescription).toContain("2FA");
    expect(PROMINENT_DISCLOSURE_INFO.revocabilityDescription).toContain("revogar");
  });
});
