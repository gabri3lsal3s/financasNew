export type SettingsTabId =
  | "account"
  | "appearance"
  | "notifications"
  | "security"
  | "subscription"
  | "support";

const TAB_ALIASES: Record<SettingsTabId, readonly string[]> = {
  account: [
    "account",
    "conta",
    "perfil",
    "usuario",
    "usuário",
    "profile",
    "minha-conta",
    "dados-pessoais",
  ],
  appearance: [
    "appearance",
    "aparencia",
    "aparência",
    "personalizacao",
    "personalização",
    "tema",
    "visual",
    "customizacao",
    "customização",
    "experiencia",
    "experiência",
    "sensorial",
    "modos",
    "modo",
    "sons",
    "som",
    "audio",
    "haptic",
    "widgets",
    "interface",
    "dashboard",
    "family",
    "familia",
    "família",
  ],
  notifications: [
    "notifications",
    "notificacoes",
    "notificações",
    "notificacao",
    "notificação",
    "lembretes",
    "lembrete",
    "bancos",
    "assistente",
  ],
  security: [
    "security",
    "seguranca",
    "segurança",
    "dados",
    "exportar",
    "backup",
    "importar",
    "privacidade",
    "devices",
    "dispositivos",
    "app",
    "aplicativo",
    "instalacao",
    "instalação",
    "apk",
    "download",
    "versao",
    "versão",
  ],
  subscription: ["subscription", "plano", "assinatura", "upgrade"],
  support: [
    "support",
    "suporte",
    "ajuda",
    "help",
    "faq",
    "atendimento",
    "chamados",
  ],
};

/**
 * Resolve o identificador canônico da aba de configurações a partir do parâmetro
 * de rota (`tab`, `subtab` ou aliases comuns de deep-link).
 * Por padrão, abre em `"account"`.
 */
export function resolveSettingsTab(param: string | null): SettingsTabId {
  if (!param) return "account";
  const normalized = param.toLowerCase().trim();

  for (const [tabId, aliases] of Object.entries(TAB_ALIASES) as Array<
    [SettingsTabId, readonly string[]]
  >) {
    if (aliases.includes(normalized)) {
      return tabId;
    }
  }

  return "account";
}
