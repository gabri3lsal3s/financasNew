import type { ModuleAccessLevel, SystemFeatureKey } from "@/types";

export type AdminModuleCategory =
  | "core"
  | "wealth"
  | "expansions"
  | "ai_and_beta"
  | "apk_distribution";

export interface AdminModuleDescriptor {
  readonly key: SystemFeatureKey;
  readonly label: string;
  readonly desc: string;
  readonly category: AdminModuleCategory;
}

export const MODULE_CATEGORY_LABELS: Record<AdminModuleCategory, string> = {
  core: "Núcleo Financeiro",
  wealth: "Patrimônio & Análise",
  expansions: "Expansões do App",
  ai_and_beta: "IA & Recursos Beta",
  apk_distribution: "Distribuição APK (Android)",
};

export const EXPANSION_MODULES: readonly AdminModuleDescriptor[] = [
  {
    key: "family",
    label: "Modo Família",
    desc: "Gestão compartilhada, despesas conjuntas e metas familiares",
    category: "expansions",
  },
  {
    key: "trips",
    label: "Modo Viagem",
    desc: "Orçamentos de viagem, câmbio e divisão de gastos",
    category: "expansions",
  },
  {
    key: "business",
    label: "Modo Negócio (PJ)",
    desc: "Fluxo de caixa empresarial, clientes e separação PF/PJ",
    category: "expansions",
  },
];

export const CORE_MODULES: readonly AdminModuleDescriptor[] = [
  {
    key: "overview",
    label: "Painel Início (Visão Geral)",
    desc: "Dashboard consolidado, KPIs e fluxo financeiro",
    category: "core",
  },
  {
    key: "transactions",
    label: "Transações & Extrato",
    desc: "Receitas, despesas e lançamentos",
    category: "core",
  },
  {
    key: "cards",
    label: "Cartões de Crédito",
    desc: "Faturas, limites e carteira",
    category: "core",
  },
  {
    key: "debts",
    label: "Dívidas & Empréstimos",
    desc: "Contas a pagar, receber e contratos",
    category: "core",
  },
  {
    key: "budgets",
    label: "Orçamentos & Metas",
    desc: "Limites de gastos, categorias e metas de renda",
    category: "core",
  },
  {
    key: "reminders",
    label: "Central de Lembretes",
    desc: "Vencimentos e avisos de contas",
    category: "core",
  },
  {
    key: "investments",
    label: "Investimentos & Carteira",
    desc: "Posição, proventos e rebalanceamento",
    category: "wealth",
  },
  {
    key: "reports",
    label: "Relatórios Executivos",
    desc: "DRE, balanço e informes fiscais",
    category: "wealth",
  },
  {
    key: "insights",
    label: "Inteligência & Insights",
    desc: "Diagnósticos e recomendações",
    category: "wealth",
  },
  ...EXPANSION_MODULES,
];

export const BETA_MODULES: readonly AdminModuleDescriptor[] = [
  {
    key: "bank_notification_listener",
    label: "Notificações Bancárias (Beta)",
    desc: "Captura passiva de compras e Pix no Android nativo",
    category: "ai_and_beta",
  },
];

export const AI_FEATURE_MODULES: readonly AdminModuleDescriptor[] = [
  {
    key: "ai_extraction",
    label: "Extração & Categorização por IA",
    desc: "Leitura inteligente de comprovantes, faturas PDF e categorização em lote",
    category: "ai_and_beta",
  },
];

export const APK_DISTRIBUTION_MODULES: readonly AdminModuleDescriptor[] = [
  {
    key: "apk_access_pro",
    label: "Acesso APK — Assinantes Pro / Vitalício",
    desc: "Libera o aplicativo Android nativo para contas pagantes",
    category: "apk_distribution",
  },
  {
    key: "apk_access_free",
    label: "Acesso APK — Trial & Somente Leitura",
    desc: "Libera o aplicativo Android nativo para contas em teste ou gratuitas",
    category: "apk_distribution",
  },
];

export const ALL_PRODUCT_MODULES: readonly AdminModuleDescriptor[] = [
  ...CORE_MODULES,
  ...BETA_MODULES,
  ...AI_FEATURE_MODULES,
];

export const ALL_SYSTEM_MODULES: readonly AdminModuleDescriptor[] = [
  ...ALL_PRODUCT_MODULES,
  ...APK_DISTRIBUTION_MODULES,
];

export interface ModuleAccessPresetEntry {
  readonly moduleKey: SystemFeatureKey;
  readonly accessLevel: ModuleAccessLevel;
}

export const INVESTMENT_ONLY_PRESET: ReadonlyArray<ModuleAccessPresetEntry> = [
  { moduleKey: "investments", accessLevel: "write" },
  { moduleKey: "reports", accessLevel: "write" },
  { moduleKey: "insights", accessLevel: "none" },
  { moduleKey: "overview", accessLevel: "none" },
  { moduleKey: "transactions", accessLevel: "none" },
  { moduleKey: "cards", accessLevel: "none" },
  { moduleKey: "debts", accessLevel: "none" },
  { moduleKey: "budgets", accessLevel: "none" },
  { moduleKey: "reminders", accessLevel: "none" },
  { moduleKey: "family", accessLevel: "none" },
  { moduleKey: "trips", accessLevel: "none" },
  { moduleKey: "business", accessLevel: "none" },
  { moduleKey: "bank_notification_listener", accessLevel: "none" },
];

export const PERSONAL_ONLY_PRESET: ReadonlyArray<ModuleAccessPresetEntry> = CORE_MODULES.map(
  (mod) => ({
    moduleKey: mod.key,
    accessLevel: mod.key === "business" ? "none" : "write",
  }),
);

export const NO_AI_PRESET: ReadonlyArray<ModuleAccessPresetEntry> = [
  { moduleKey: "ai_extraction", accessLevel: "none" },
];

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Plano Ativo",
  trialing: "Trial Vigente",
  past_due: "Inadimplente",
  canceled: "Cancelada",
  read_only_expired: "Expirado",
};
