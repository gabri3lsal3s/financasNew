import type { ModuleAccessLevel } from "@/types";

export interface AdminModuleDescriptor {
  readonly key: string;
  readonly label: string;
  readonly desc: string;
}

export const CORE_MODULES: readonly AdminModuleDescriptor[] = [
  { key: "overview", label: "Painel Início (Visão Geral)", desc: "Dashboard consolidado, KPIs e fluxo financeiro" },
  { key: "transactions", label: "Transações & Extrato", desc: "Receitas, despesas e lançamentos" },
  { key: "cards", label: "Cartões de Crédito", desc: "Faturas, limites e carteira" },
  { key: "debts", label: "Dívidas & Empréstimos", desc: "Contas a pagar, receber e contratos" },
  { key: "budgets", label: "Orçamentos & Metas", desc: "Limites de gastos e metas de renda" },
  { key: "investments", label: "Investimentos & Carteira", desc: "Posição, proventos e rebalanceamento" },
  { key: "reports", label: "Relatórios Executivos", desc: "DRE, balanço e informes fiscais" },
  { key: "insights", label: "Inteligência & Insights", desc: "Diagnósticos e recomendações" },
  { key: "reminders", label: "Central de Lembretes", desc: "Vencimentos e avisos de contas" },
];

export const BETA_MODULES: readonly AdminModuleDescriptor[] = [
  {
    key: "bank_notification_listener",
    label: "Notificações Bancárias (Beta)",
    desc: "Captura passiva de compras e Pix no Android nativo",
  },
];

export const INVESTMENT_ONLY_PRESET: ReadonlyArray<{
  moduleKey: string;
  accessLevel: ModuleAccessLevel;
}> = [
  { moduleKey: "investments", accessLevel: "write" },
  { moduleKey: "reports", accessLevel: "write" },
  { moduleKey: "overview", accessLevel: "none" },
  { moduleKey: "transactions", accessLevel: "none" },
  { moduleKey: "cards", accessLevel: "none" },
  { moduleKey: "debts", accessLevel: "none" },
  { moduleKey: "budgets", accessLevel: "none" },
  { moduleKey: "reminders", accessLevel: "none" },
  { moduleKey: "bank_notification_listener", accessLevel: "none" },
];

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Plano Ativo",
  trialing: "Trial Vigente",
  past_due: "Inadimplente",
  canceled: "Cancelada",
  read_only_expired: "Expirado",
};
