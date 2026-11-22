export type InstitutionCategory = "traditional_digital" | "payment_wallets" | "investments_crypto";

export interface HomologatedInstitution {
  id: string;
  name: string;
  category: InstitutionCategory;
  packages: string[];
  supportsCardPurchases: boolean;
  supportsInvestments: boolean;
}

export const HOMOLOGATED_INSTITUTIONS: readonly HomologatedInstitution[] = [
  // Bancos Tradicionais & Digitais
  {
    id: "nubank",
    name: "Nubank",
    category: "traditional_digital",
    packages: ["com.nu.production"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "itau",
    name: "Itaú",
    category: "traditional_digital",
    packages: ["com.itau", "com.itau.personnalite"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "bradesco",
    name: "Bradesco",
    category: "traditional_digital",
    packages: ["com.bradesco", "com.bradesco.cartoes"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "santander",
    name: "Santander",
    category: "traditional_digital",
    packages: ["com.santander.app", "br.com.santander.way"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "banco-do-brasil",
    name: "Banco do Brasil",
    category: "traditional_digital",
    packages: ["br.com.bb.android"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "inter",
    name: "Inter",
    category: "traditional_digital",
    packages: ["br.com.intermedium"],
    supportsCardPurchases: true,
    supportsInvestments: true,
  },
  {
    id: "c6-bank",
    name: "C6 Bank",
    category: "traditional_digital",
    packages: ["com.c6bank.app"],
    supportsCardPurchases: true,
    supportsInvestments: true,
  },
  {
    id: "caixa",
    name: "Caixa",
    category: "traditional_digital",
    packages: ["br.gov.caixa.tem", "br.com.gabba.Caixa"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "neon",
    name: "Neon",
    category: "traditional_digital",
    packages: ["br.com.neon"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "next",
    name: "Next",
    category: "traditional_digital",
    packages: ["br.com.bradesco.next"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "btg-pactual",
    name: "BTG Pactual",
    category: "traditional_digital",
    packages: ["com.btg.pactual.banking"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "sicoob",
    name: "Sicoob",
    category: "traditional_digital",
    packages: ["br.com.sicoob.net"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "sicredi",
    name: "Sicredi",
    category: "traditional_digital",
    packages: ["br.com.sicredi.mobile"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "safra",
    name: "Banco Safra",
    category: "traditional_digital",
    packages: ["br.com.safra.mobile"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "sofisa-direto",
    name: "Sofisa Direto",
    category: "traditional_digital",
    packages: ["br.com.sofisa.direto"],
    supportsCardPurchases: true,
    supportsInvestments: true,
  },
  {
    id: "banco-pan",
    name: "Banco Pan",
    category: "traditional_digital",
    packages: ["br.com.bancopan.app"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "banco-bv",
    name: "Banco BV",
    category: "traditional_digital",
    packages: ["br.com.bv.banco"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "cora",
    name: "Cora",
    category: "traditional_digital",
    packages: ["com.cora.app"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "inter-empresas",
    name: "Inter Empresas",
    category: "traditional_digital",
    packages: ["br.com.intermedium.pj"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "c6-empresas",
    name: "C6 Empresas",
    category: "traditional_digital",
    packages: ["com.c6bank.empresa"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "btg-empresas",
    name: "BTG Empresas",
    category: "traditional_digital",
    packages: ["com.btgpactual.empresas"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "will-bank",
    name: "Will Bank",
    category: "traditional_digital",
    packages: ["com.willbank.app", "br.com.willbank"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "banco-original",
    name: "Banco Original",
    category: "traditional_digital",
    packages: ["br.com.original.bank"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "agibank",
    name: "Agibank",
    category: "traditional_digital",
    packages: ["br.com.agibank"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },

  // Carteiras Digitais & Pagamentos
  {
    id: "google-wallet",
    name: "Carteira Google",
    category: "payment_wallets",
    packages: ["com.google.android.apps.walletnfcrel"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "samsung-pay",
    name: "Samsung Pay",
    category: "payment_wallets",
    packages: [
      "com.samsung.android.spay",
      "com.samsung.android.raja.spay",
      "com.samsung.android.app.spay",
    ],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "mercado-pago",
    name: "Mercado Pago",
    category: "payment_wallets",
    packages: ["com.mercadopago.wallet"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "picpay",
    name: "PicPay",
    category: "payment_wallets",
    packages: ["com.picpay"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "pagbank",
    name: "PagBank",
    category: "payment_wallets",
    packages: ["br.com.uol.ps", "br.com.uol.ps.myaccount"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "pagbank-vendedor",
    name: "PagBank Vendedor",
    category: "payment_wallets",
    packages: ["br.com.uol.ps.seller"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "ton",
    name: "Ton",
    category: "payment_wallets",
    packages: ["br.com.stone.ton"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "stone",
    name: "Stone",
    category: "payment_wallets",
    packages: ["co.stone.stone"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "recargapay",
    name: "RecargaPay",
    category: "payment_wallets",
    packages: ["com.recargapay"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },

  // Investimentos, Cripto & Contas Globais
  {
    id: "btg-investimentos",
    name: "BTG Investimentos",
    category: "investments_crypto",
    packages: ["com.btgpactual.investimentos", "br.com.btg.pactual.digital"],
    supportsCardPurchases: false,
    supportsInvestments: true,
  },
  {
    id: "xp",
    name: "XP Investimentos",
    category: "investments_crypto",
    packages: ["br.com.xp.carteira", "com.xpinc.investments", "br.com.xp.investimentos"],
    supportsCardPurchases: true,
    supportsInvestments: true,
  },
  {
    id: "rico",
    name: "Rico",
    category: "investments_crypto",
    packages: ["br.com.rico", "br.com.rico.investimentos", "br.com.rico.rico"],
    supportsCardPurchases: true,
    supportsInvestments: true,
  },
  {
    id: "binance",
    name: "Binance",
    category: "investments_crypto",
    packages: ["com.binance.dev"],
    supportsCardPurchases: false,
    supportsInvestments: true,
  },
  {
    id: "nomad",
    name: "Nomad",
    category: "investments_crypto",
    packages: ["com.nomadfinancial.app", "com.nomadglobal.app"],
    supportsCardPurchases: true,
    supportsInvestments: true,
  },
  {
    id: "wise",
    name: "Wise",
    category: "investments_crypto",
    packages: ["com.transferwise.android"],
    supportsCardPurchases: true,
    supportsInvestments: false,
  },
  {
    id: "avenue",
    name: "Avenue",
    category: "investments_crypto",
    packages: ["us.avenue.app"],
    supportsCardPurchases: true,
    supportsInvestments: true,
  },
] as const;

export const HOMOLOGATED_BANKS: readonly string[] = HOMOLOGATED_INSTITUTIONS.map(
  (inst) => inst.name,
);

export type HomologatedBankName = (typeof HOMOLOGATED_BANKS)[number];

export const ALL_HOMOLOGATED_PACKAGES: readonly string[] = Array.from(
  new Set(HOMOLOGATED_INSTITUTIONS.flatMap((inst) => inst.packages)),
);

export type UnknownCategoryStrategy = "assign_generic_and_prompt" | "open_quick_wizard";

export interface BankAssistantPreferences {
  /** Habilita ou desabilita a captura passiva geral de notificações de bancos */
  passiveCaptureEnabled: boolean;
  /** Envia notificação rica no celular com ações Adicionar Rápido e Editar */
  interactiveNotificationsEnabled: boolean;
  /** Calcula e desmembra automaticamente compras parceladas */
  autoInstallmentsEnabled: boolean;
  /** Infere deterministicamente a categoria pelo nome do estabelecimento */
  autoCategoryInferenceEnabled: boolean;
  /** Comportamento quando a categoria do estabelecimento for desconhecida ao confirmar */
  unknownCategoryHandling: UnknownCategoryStrategy;
  /** Lista de nomes de bancos ativos para monitoramento */
  monitoredBanks: string[];
}

export const DEFAULT_BANK_ASSISTANT_PREFERENCES: BankAssistantPreferences = {
  passiveCaptureEnabled: false,
  interactiveNotificationsEnabled: true,
  autoInstallmentsEnabled: true,
  autoCategoryInferenceEnabled: true,
  unknownCategoryHandling: "assign_generic_and_prompt",
  monitoredBanks: [],
};

/**
 * Normaliza e valida um objeto bruto de preferências garantindo valores seguros por fallback.
 */
export function normalizeBankPreferences(raw?: unknown): BankAssistantPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_BANK_ASSISTANT_PREFERENCES };
  }

  const record = raw as Record<string, unknown>;

  const passiveCaptureEnabled =
    typeof record.passiveCaptureEnabled === "boolean"
      ? record.passiveCaptureEnabled
      : DEFAULT_BANK_ASSISTANT_PREFERENCES.passiveCaptureEnabled;

  const interactiveNotificationsEnabled =
    typeof record.interactiveNotificationsEnabled === "boolean"
      ? record.interactiveNotificationsEnabled
      : DEFAULT_BANK_ASSISTANT_PREFERENCES.interactiveNotificationsEnabled;

  const autoInstallmentsEnabled =
    typeof record.autoInstallmentsEnabled === "boolean"
      ? record.autoInstallmentsEnabled
      : DEFAULT_BANK_ASSISTANT_PREFERENCES.autoInstallmentsEnabled;

  const autoCategoryInferenceEnabled =
    typeof record.autoCategoryInferenceEnabled === "boolean"
      ? record.autoCategoryInferenceEnabled
      : DEFAULT_BANK_ASSISTANT_PREFERENCES.autoCategoryInferenceEnabled;

  const unknownCategoryHandling: UnknownCategoryStrategy =
    record.unknownCategoryHandling === "open_quick_wizard"
      ? "open_quick_wizard"
      : "assign_generic_and_prompt";

  let monitoredBanks: string[] = [...DEFAULT_BANK_ASSISTANT_PREFERENCES.monitoredBanks];
  if (Array.isArray(record.monitoredBanks)) {
    const validSet = new Set<string>(HOMOLOGATED_BANKS);
    const filtered = record.monitoredBanks.filter(
      (b): b is string => typeof b === "string" && validSet.has(b),
    );
    // Se o usuário passou array (mesmo que vazio ou filtrado), respeita
    monitoredBanks = filtered;
  }

  return {
    passiveCaptureEnabled,
    interactiveNotificationsEnabled,
    autoInstallmentsEnabled,
    autoCategoryInferenceEnabled,
    unknownCategoryHandling,
    monitoredBanks,
  };
}

export const BANK_NAME_TO_PACKAGES: Record<string, string[]> = Object.fromEntries(
  HOMOLOGATED_INSTITUTIONS.map((inst) => [inst.name, [...inst.packages]]),
);

/**
 * Retorna instituições homologadas pertencentes a uma categoria específica.
 */
export function getInstitutionsByCategory(
  category: InstitutionCategory,
): readonly HomologatedInstitution[] {
  return HOMOLOGATED_INSTITUTIONS.filter((inst) => inst.category === category);
}

/**
 * Busca uma instituição homologada por ID único.
 */
export function getInstitutionById(id: string): HomologatedInstitution | undefined {
  return HOMOLOGATED_INSTITUTIONS.find((inst) => inst.id === id);
}

/**
 * Retorna todos os pacotes Android associados aos bancos monitorados selecionados.
 */
export function getPackagesForMonitoredBanks(monitoredBanks: string[]): string[] {
  const packages: string[] = [];
  for (const bank of monitoredBanks) {
    const pkgs = BANK_NAME_TO_PACKAGES[bank];
    if (pkgs) {
      packages.push(...pkgs);
    }
  }
  return packages;
}

/**
 * Verifica se um banco específico está habilitado para monitoramento nas preferências.
 */
export function isBankMonitored(
  bankName: string,
  preferences: BankAssistantPreferences = DEFAULT_BANK_ASSISTANT_PREFERENCES,
): boolean {
  if (!bankName) return false;
  if (!preferences.passiveCaptureEnabled) return false;

  const cleanTarget = bankName.toLowerCase().trim();

  // "Banco" genérico é estritamente rejeitado para evitar falsos positivos de apps desconhecidos
  if (cleanTarget === "banco" || cleanTarget === "") {
    return false;
  }

  return preferences.monitoredBanks.some(
    (b) => b.toLowerCase().trim() === cleanTarget || cleanTarget.includes(b.toLowerCase().trim()),
  );
}
