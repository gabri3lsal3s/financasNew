export const HOMOLOGATED_BANKS = [
  "Nubank",
  "Itaú",
  "Bradesco",
  "Santander",
  "Banco do Brasil",
  "Inter",
  "C6 Bank",
  "Mercado Pago",
  "Caixa",
  "PicPay",
  "BTG Pactual",
  "XP Investimentos",
  "PagBank",
  "Neon",
  "Next",
  "Nomad",
  "Wise",
] as const;

export type HomologatedBankName = (typeof HOMOLOGATED_BANKS)[number];

export interface BankAssistantPreferences {
  /** Habilita ou desabilita a captura passiva geral de notificações de bancos */
  passiveCaptureEnabled: boolean;
  /** Envia notificação rica no celular com ações Adicionar Rápido e Editar */
  interactiveNotificationsEnabled: boolean;
  /** Calcula e desmembra automaticamente compras parceladas */
  autoInstallmentsEnabled: boolean;
  /** Infere deterministicamente a categoria pelo nome do estabelecimento */
  autoCategoryInferenceEnabled: boolean;
  /** Lista de nomes de bancos ativos para monitoramento */
  monitoredBanks: string[];
}

export const DEFAULT_BANK_ASSISTANT_PREFERENCES: BankAssistantPreferences = {
  passiveCaptureEnabled: true,
  interactiveNotificationsEnabled: true,
  autoInstallmentsEnabled: true,
  autoCategoryInferenceEnabled: true,
  monitoredBanks: [...HOMOLOGATED_BANKS],
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
    monitoredBanks,
  };
}

export const BANK_NAME_TO_PACKAGES: Record<string, string[]> = {
  Nubank: ["com.nu.production"],
  Inter: ["br.com.intermedium"],
  "C6 Bank": ["com.c6bank.app"],
  "Mercado Pago": ["com.mercadopago.wallet"],
  PicPay: ["com.picpay"],
  PagBank: ["br.com.uol.ps", "br.com.uol.ps.myaccount"],
  Neon: ["br.com.neon"],
  Next: ["br.com.bradesco.next"],
  "BTG Pactual": ["com.btg.pactual.banking", "com.btgpactual.investimentos"],
  "XP Investimentos": ["br.com.xp.carteira", "com.xpinc.investments"],
  Nomad: ["com.nomadfinancial.app"],
  Wise: ["com.transferwise.android"],
  Itaú: ["com.itau", "com.itau.personnalite"],
  Bradesco: ["com.bradesco"],
  Santander: ["com.santander.app", "br.com.santander.way"],
  Caixa: ["br.gov.caixa.tem", "br.com.gabba.Caixa"],
  "Banco do Brasil": ["br.com.bb.android"],
};

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
