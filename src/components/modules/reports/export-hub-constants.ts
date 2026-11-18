import type { RestoreSummary } from "@/domain/export";
import type { ExportCsvKind } from "./csv-export-card";

export const EXPORT_CSV_ACTIONS: readonly { kind: ExportCsvKind; label: string }[] = [
  { kind: "expenses", label: "Despesas" },
  { kind: "incomes", label: "Receitas" },
  { kind: "invoices", label: "Faturas de cartão" },
  { kind: "positions", label: "Posições da carteira" },
];

export const RESTORE_SUMMARY_LABELS: Record<string, string> = {
  categories: "Categorias",
  credit_cards: "Cartões",
  incomes: "Receitas",
  expenses: "Despesas",
  card_payments: "Pagamentos de fatura",
  debts: "Dívidas",
  budgets: "Orçamentos",
  income_goals: "Metas de renda",
  insight_feedback: "Feedback de insights",
  reminder_states: "Lembretes",
  portfolio_assets: "Ativos",
  portfolio_transactions: "Lançamentos de ativos",
  class_targets: "Metas por classe",
  sector_targets: "Metas por setor",
  asset_prices: "Cotações manuais",
  user_preferences: "Preferências",
};

export function formatRestoreSummaryEntries(summary: RestoreSummary): [string, number][] {
  return Object.entries(summary)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => [RESTORE_SUMMARY_LABELS[key] ?? key, count]);
}
