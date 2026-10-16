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

  // Se o banco for genérico "Banco" ou desconhecido, só monitora se nenhum banco tiver sido desmarcado
  if (cleanTarget === "banco") {
    return preferences.monitoredBanks.length === HOMOLOGATED_BANKS.length;
  }

  return preferences.monitoredBanks.some(
    (b) => b.toLowerCase().trim() === cleanTarget || cleanTarget.includes(b.toLowerCase().trim()),
  );
}
