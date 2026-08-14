/**
 * Tipos canônicos do domínio (ESPECIFICAÇÃO_TECNICA §2 — "Contratos de domínio TS").
 *
 * Os literais abaixo ESPELHAM as constraints do schema Postgres (migrations em
 * `supabase/migrations/`). Nunca soltar literais soltos no código: importe os
 * enums daqui (DRY de tipos).
 *
 * NOTA: todos os modelos são TYPE ALIASES (não `interface`) — interfaces não
 * são assignable a `Record<string, unknown>` via extends (não recebem index
 * signature implícita), o que quebraria o GenericSchema do supabase-js.
 *
 * Representação: valores monetários chegam do PostgREST como string (numeric).
 * O contrato de domínio é `number` — a conversão acontece na camada `data/`.
 */
export const PAYMENT_METHODS = ["cash", "debit", "credit_card", "pix", "transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const RECEIVE_TYPES = ["cash", "pix", "transfer", "other"] as const;
export type ReceiveType = (typeof RECEIVE_TYPES)[number];

export const CATEGORY_TYPES = ["expense", "income"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const DEBT_TYPES = ["payable", "receivable"] as const;
export type DebtType = (typeof DEBT_TYPES)[number];

export const PORTFOLIO_TX_TYPES = [
  "buy",
  "sell",
  "dividend",
  "jcp",
  "fii_yield",
  "split",
  "reverse_split",
  "subscription",
] as const;
export type PortfolioTransactionType = (typeof PORTFOLIO_TX_TYPES)[number];

export const ASSET_SOURCES = ["api", "fallback", "manual"] as const;
export type AssetSource = (typeof ASSET_SOURCES)[number];

export const INSIGHT_DECISIONS = ["ignore", "confirm"] as const;
export type InsightDecision = (typeof INSIGHT_DECISIONS)[number];

export const THEME_PREFERENCES = ["light", "dark", "oled", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const INSTALLMENT_DELETE_MODES = ["single", "all", "subsequent"] as const;
export type InstallmentDeleteMode = (typeof INSTALLMENT_DELETE_MODES)[number];

export const ASSET_CURRENCIES = ["BRL", "USD"] as const;
export type AssetCurrency = (typeof ASSET_CURRENCIES)[number];

/** Data mínima de lançamentos (APP_START_DATE — espelha a constraint do banco). */
export const APP_START_DATE = "2026-01-01";

/** Limite de parcelas (espelha a constraint 1–60 do banco). */
export const MAX_INSTALLMENTS = 60;

// ---------------------------------------------------------------------------
// Tabelas (type aliases — ver nota acima)
// ---------------------------------------------------------------------------

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
};

export type UserPreferences = {
  user_id: string;
  theme: ThemePreference;
  reminders_enabled: boolean;
  reminder_days_before_debt: number;
  reminder_days_before_bill: number;
  report_weights_enabled: boolean;
  max_sector_acoes: number | null;
  max_sector_fiis: number | null;
};

export type Category = {
  id: string;
  user_id: string;
  type: CategoryType;
  name: string;
  icon: string | null;
  color: string | null;
  is_reserved: boolean;
  is_active: boolean;
};

export type Income = {
  id: string;
  user_id: string;
  value: number;
  date: string;
  category_id: string;
  receive_type: ReceiveType;
  description: string | null;
  report_weight: number;
  /** Presente apenas em rendas automáticas (ex.: `[REFUND]{id}`) — somente-leitura. */
  source_ref: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  value: number;
  date: string;
  category_id: string;
  payment_method: PaymentMethod;
  card_id: string | null;
  installments_total: number;
  installment_number: number;
  installment_group_id: string | null;
  /** Competência de fatura (snapshot YYYY-MM) — preenchida quando cartão (D3). */
  bill_competence: string | null;
  report_weight: number;
  /** Valor original da parcela (auditoria de pesos de relatório). */
  base_amount: number;
  description: string | null;
  created_at: string;
};

export type CreditCard = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  credit_limit: number | null;
  closing_day: number;
  due_day: number;
  color: string | null;
  is_active: boolean;
};

export type CardCompetenceOverride = {
  id: string;
  card_id: string;
  /** YYYY-MM */
  month: string;
  closing_day: number;
  due_day: number;
};

export type CardPayment = {
  id: string;
  user_id: string;
  card_id: string;
  /** YYYY-MM */
  competence_month: string;
  amount: number;
  date: string;
  note: string | null;
  /** Estorno (amount negativo ou nota iniciando em `[REFUND]`). */
  is_refund: boolean;
};

export type Debt = {
  id: string;
  user_id: string;
  name: string;
  type: DebtType;
  amount: number;
  due_date: string;
  /** NULL = pendente; preenchido = quitada (status derivado nunca é armazenado). */
  paid_at: string | null;
  expense_id: string | null;
  installment_group_id: string | null;
  created_at: string;
};

export type Budget = {
  id: string;
  user_id: string;
  category_id: string;
  /** YYYY-MM */
  month: string;
  limit: number;
};

export type IncomeGoal = {
  id: string;
  user_id: string;
  category_id: string;
  /** YYYY-MM */
  month: string;
  expected: number;
};

export type InsightFeedback = {
  id: string;
  user_id: string;
  /** Hash estável: tipo + entidade + mês. */
  occurrence_key: string;
  decision: InsightDecision;
  created_at: string;
};

export type ReminderStateKind = "read" | "snoozed";

export type ReminderState = {
  id: string;
  user_id: string;
  /** Chave estável: `bill:{card_id}:{YYYY-MM}` ou `debt:{debt_id}`. */
  occurrence_key: string;
  kind: ReminderStateKind;
  /** Snooze até esta data (YYYY-MM-DD) — expira ao vencer/atrasar. */
  snooze_until: string | null;
  created_at: string;
  updated_at: string;
};

export type PortfolioAsset = {
  id: string;
  user_id: string;
  ticker: string;
  asset_class: string | null;
  currency: AssetCurrency;
};

export type PortfolioTransaction = {
  id: string;
  user_id: string;
  asset_id: string;
  type: PortfolioTransactionType;
  date: string;
  quantity: number;
  price: number;
  total: number;
};

export type AllocationTarget = {
  id: string;
  user_id: string;
  asset_id: string;
  /** 0–100; soma por usuário ≤ 100 (validada no domínio e no banco). */
  target_percentage: number;
};

export type GroupTarget = {
  id: string;
  user_id: string;
  group_type: "class" | "sector";
  name: string;
  target_percentage: number;
};

export type AssetPrice = {
  id: string;
  /** NULL = cache global da edge function; preenchido = override manual do usuário. */
  user_id: string | null;
  ticker: string;
  price: number;
  currency: AssetCurrency;
  source: AssetSource;
  manual_price: number | null;
  updated_at: string;
};

export type AuditEvent = {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Helpers de Insert/Update (id/created_at têm default no banco)
// ---------------------------------------------------------------------------

export type DbInsert<T> = Omit<T, "id" | "created_at"> & { id?: string; created_at?: string };
export type DbUpdate<T> = Partial<DbInsert<T>>;
