/**
 * Configurações e dados institucionais oficiais da plataforma.
 *
 * Provê a identidade jurídica exigida pelo Decreto do Comércio Eletrônico (Decreto nº 7.962/2013),
 * pela Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018) e pelo Código de Defesa do Consumidor (CDC).
 *
 * Suporta customização via variáveis de ambiente com prefixo VITE_* mantendo fallbacks seguros
 * e canônicos para produção e desenvolvimento.
 */

export interface InstitutionalConfig {
  /** Razão Social da empresa fornecedora do serviço (Decreto 7.962/2013). */
  companyName: string;
  /** Cadastro Nacional da Pessoa Jurídica (CNPJ formatado). */
  cnpj: string;
  /** Endereço físico completo da sede do prestador de serviços. */
  address: string;
  /** Canal eletrônico direto do Encarregado de Proteção de Dados (DPO) (LGPD Art. 41). */
  dpoEmail: string;
  /** Canal eletrônico oficial de suporte e atendimento ao consumidor (CDC). */
  supportEmail: string;
  /** Nome comercial / marca da aplicação. */
  appName: string;
  /** Foro de eleição legal para dirimir conflitos contratuais. */
  legalJurisdiction: string;
}

export const DEFAULT_INSTITUTIONAL_CONFIG: InstitutionalConfig = Object.freeze({
  companyName: "Áxis Tecnologia & Gestão Financeira Ltda.",
  cnpj: "00.000.000/0001-00",
  address: "São Paulo/SP — Brasil",
  dpoEmail: "privacidade@axis.app",
  supportEmail: "suporte@axis.app",
  appName: "Áxis Finance",
  legalJurisdiction: "Comarca da Capital do Estado de São Paulo",
});

/**
 * Lê as configurações institucionais combinando variáveis de ambiente ativas com fallbacks seguros.
 */
export function getInstitutionalConfig(): InstitutionalConfig {
  const env = import.meta.env;

  const companyName = (env.VITE_APP_COMPANY_NAME as string | undefined)?.trim();
  const cnpj = (env.VITE_APP_CNPJ as string | undefined)?.trim();
  const address = (env.VITE_APP_ADDRESS as string | undefined)?.trim();
  const dpoEmail = (env.VITE_APP_DPO_EMAIL as string | undefined)?.trim();
  const supportEmail = (env.VITE_APP_SUPPORT_EMAIL as string | undefined)?.trim();
  const appName = (env.VITE_APP_NAME as string | undefined)?.trim();
  const legalJurisdiction = (env.VITE_APP_LEGAL_JURISDICTION as string | undefined)?.trim();

  return {
    companyName: companyName || DEFAULT_INSTITUTIONAL_CONFIG.companyName,
    cnpj: cnpj || DEFAULT_INSTITUTIONAL_CONFIG.cnpj,
    address: address || DEFAULT_INSTITUTIONAL_CONFIG.address,
    dpoEmail: dpoEmail || DEFAULT_INSTITUTIONAL_CONFIG.dpoEmail,
    supportEmail: supportEmail || DEFAULT_INSTITUTIONAL_CONFIG.supportEmail,
    appName: appName || DEFAULT_INSTITUTIONAL_CONFIG.appName,
    legalJurisdiction: legalJurisdiction || DEFAULT_INSTITUTIONAL_CONFIG.legalJurisdiction,
  };
}

/**
 * Constante institucional oficial do aplicativo.
 * Utiliza getters dinâmicos para refletir variáveis de ambiente atualizadas mantendo
 * imutabilidade e compatibilidade com acessos estáticos INSTITUTIONAL_CONFIG.<prop>.
 */
export const INSTITUTIONAL_CONFIG: InstitutionalConfig = {
  get companyName(): string {
    const val = (import.meta.env.VITE_APP_COMPANY_NAME as string | undefined)?.trim();
    return val || DEFAULT_INSTITUTIONAL_CONFIG.companyName;
  },
  get cnpj(): string {
    const val = (import.meta.env.VITE_APP_CNPJ as string | undefined)?.trim();
    return val || DEFAULT_INSTITUTIONAL_CONFIG.cnpj;
  },
  get address(): string {
    const val = (import.meta.env.VITE_APP_ADDRESS as string | undefined)?.trim();
    return val || DEFAULT_INSTITUTIONAL_CONFIG.address;
  },
  get dpoEmail(): string {
    const val = (import.meta.env.VITE_APP_DPO_EMAIL as string | undefined)?.trim();
    return val || DEFAULT_INSTITUTIONAL_CONFIG.dpoEmail;
  },
  get supportEmail(): string {
    const val = (import.meta.env.VITE_APP_SUPPORT_EMAIL as string | undefined)?.trim();
    return val || DEFAULT_INSTITUTIONAL_CONFIG.supportEmail;
  },
  get appName(): string {
    const val = (import.meta.env.VITE_APP_NAME as string | undefined)?.trim();
    return val || DEFAULT_INSTITUTIONAL_CONFIG.appName;
  },
  get legalJurisdiction(): string {
    const val = (import.meta.env.VITE_APP_LEGAL_JURISDICTION as string | undefined)?.trim();
    return val || DEFAULT_INSTITUTIONAL_CONFIG.legalJurisdiction;
  },
};

/**
 * Disclaimer regulatório oficial de isenção CVM (Resoluções CVM nº 19/2021 e nº 20/2021)
 * em conformidade estrita com o Contrato 1 (§7) e Contrato 5 da plataforma Áxis Finance.
 */
export const OFFICIAL_CVM_DISCLAIMER =
  "Documento estritamente informativo gerado automaticamente com base nos dados e metas parametrizados pelo titular. O Áxis Finance opera como mero instrumento tecnológico de consolidação matemática e orçamentária, não constituindo consultoria de valores mobiliários (Resolução CVM nº 19/2021), análise de investimentos ou recomendação de compra, venda ou alocação de ativos (Resolução CVM nº 20/2021). Rentabilidade passada não representa garantia de retorno futuro.";

/**
 * Disclaimer especializado para a Síntese Executiva de Patrimônio (Wealth Tear Sheet),
 * incorporando as especificidades contábeis e fiscais de proventos líquidos e custódia aberta.
 */
export const OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER =
  "Documento estritamente informativo gerado automaticamente com base nos dados e metas parametrizados pelo titular. Proventos reportados com base no valor líquido creditado em conta (isentos para dividendos e FIIs locais; líquidos de 15% retidos na fonte para JCP e 30% retidos pelo IRS para ativos nos EUA). Valores de retorno contábil sob custódia aberta não deduzem IR latente sobre ganhos não realizados. O Áxis Finance opera como mero instrumento tecnológico de consolidação matemática e orçamentária, não constituindo consultoria de valores mobiliários (Resolução CVM nº 19/2021), análise de investimentos ou recomendação de compra, venda ou alocação de ativos (Resolução CVM nº 20/2021). Rentabilidade passada não representa garantia de retorno futuro.";

/**
 * Disclaimer contábil e fiscal oficial de responsabilidade tributária perante a Receita Federal do Brasil (RFB)
 * e Conselho Federal de Contabilidade (CFC), em conformidade estrita com o Contrato 5 (§2) da plataforma Áxis Finance.
 */
export const OFFICIAL_TAX_DISCLAIMER =
  "As apurações fiscais, estimativas de DARF e facilitadores de IRPF têm caráter estritamente informativo e auxiliar, elaborados a partir dos lançamentos e parâmetros inseridos pelo próprio usuário. O Áxis Finance não presta serviços de contabilidade regulamentados pelo CFC e este demonstrativo não substitui o trabalho de um contador habilitado nem a tempestiva entrega da Declaração de Ajuste Anual perante a Receita Federal do Brasil. É dever indelegável do contribuinte conferir os valores com os informes de rendimentos oficiais e notas de corretagem das instituições custodiantes.";

/**
 * Disclaimer especializado para o facilitador de preenchimento de IRPF e dossiê fiscal anual impresso.
 */
export const OFFICIAL_TAX_FACILITATOR_DISCLAIMER =
  "Documento auxiliar e orientativo gerado pelo Áxis Finance para facilitar o preenchimento do programa da Receita Federal. O cálculo tem caráter estimativo e não substitui o trabalho de um contador habilitado nem a Declaração de Ajuste Anual. A conferência final com os informes oficiais de custódia e o recolhimento tempestivo de tributos cabem exclusivamente ao contribuinte.";

/**
 * Divulgação destacada oficial (Prominent Disclosure — Contrato 4) para permissão de leitura
 * de notificações no Android (BIND_NOTIFICATION_LISTENER_SERVICE), em conformidade estrita com as
 * Políticas de Privacidade e Serviços Financeiros da Google Play Store.
 */
export const PROMINENT_DISCLOSURE_INFO = Object.freeze({
  title: "Consentimento para Leitura de Notificações Bancárias",
  subtitle: "Termo de Consentimento Específico — Captura Passiva Android (Contrato 4)",
  onDeviceBadge: "Processamento 100% Local no Aparelho (On-Device)",
  onDeviceDescription:
    "Toda a leitura, extração de valores e categorização de notificações ocorrem exclusivamente no processador do seu celular. O conteúdo bruto das suas notificações nunca é enviado à internet ou a servidores externos.",
  strictPurposeTitle: "Finalidade Estrita",
  strictPurposeDescription:
    "A permissão (BIND_NOTIFICATION_LISTENER_SERVICE) destina-se unicamente a identificar compras no cartão, transferências Pix e confirmações de pagamento dos bancos que você autorizar, transformando-os em sugestões rápidas de lançamento financeiro.",
  dataDiscardTitle: "Descarte Instantâneo de Dados Críticos",
  dataDiscardDescription:
    "Senhas, tokens de autenticação (2FA/SMS), mensagens de uso pessoal e alertas de aplicativos não autorizados são descartados imediatamente na memória temporária sem qualquer persistência ou transmissão.",
  revocabilityTitle: "Revogabilidade Total e Controle",
  revocabilityDescription:
    "Você tem autonomia completa para desativar esta captura ou revogar a autorização a qualquer momento nesta tela de configurações ou diretamente no menu de Acesso a Notificações do sistema operacional Android.",
});



