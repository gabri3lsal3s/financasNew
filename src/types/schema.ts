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
import type { SubscriptionTier, SubscriptionStatus, ModuleAccessLevel } from "./subscription";
import type { BillingProviderName } from "./billing";
import type { GoalCompositionConfig, GoalSourceMode } from "./goals";

export const PAYMENT_METHODS = ["cash", "debit", "credit_card", "pix", "transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const RECEIVE_TYPES = ["cash", "pix", "transfer", "other"] as const;
export type ReceiveType = (typeof RECEIVE_TYPES)[number];

export const RECURRENCE_FREQUENCIES = ["monthly", "weekly", "quarterly", "yearly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_KINDS = ["expense", "income"] as const;
export type RecurrenceKind = (typeof RECURRENCE_KINDS)[number];

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

export const INSIGHT_DECISIONS = [
  "ignore",
  "confirm",
  "already_cancelled",
  "one_off",
  "not_subscription",
  "essential",
] as const;
export type InsightDecision = (typeof INSIGHT_DECISIONS)[number];

export const THEME_PREFERENCES = ["light", "dark", "oled", "system", "schedule"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type DarkThemeVariant = "dark" | "oled";

export interface ThemeScheduleConfig {
  /** Horário de início do período diurno (formato "HH:mm"). Padrão: "06:00". */
  dayStart: string;
  /** Horário de início do período noturno (formato "HH:mm"). Padrão: "18:00". */
  nightStart: string;
  /** Tema aplicado no período diurno. Padrão: "light". */
  dayTheme: "light";
  /** Tema aplicado no período noturno. Padrão: "dark". */
  nightTheme: DarkThemeVariant;
}

export const CHARGE_KINDS = ["regular", "interest", "fine", "tax", "bank_fee"] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];

export const LOAN_TYPES = ["personal", "financing", "payroll", "other"] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

export const AMORTIZATION_SYSTEMS = ["price", "sac", "fixed_installment"] as const;
export type AmortizationSystem = (typeof AMORTIZATION_SYSTEMS)[number];

export const INSTALLMENT_DELETE_MODES = ["single", "all", "subsequent"] as const;
export type InstallmentDeleteMode = (typeof INSTALLMENT_DELETE_MODES)[number];

export const USER_ROLES = ["user", "admin", "superadmin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["pending_approval", "active", "suspended", "banned"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SYSTEM_FEATURE_KEYS = [
  "overview",
  "transactions",
  "cards",
  "investments",
  "debts",
  "budgets",
  "reports",
  "insights",
  "reminders",
  "apk_access_free",
  "apk_access_pro",
  "bank_notification_listener",
] as const;
export type SystemFeatureKey = (typeof SYSTEM_FEATURE_KEYS)[number];


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
  cpf?: string | null;
  phone?: string | null;
  role?: UserRole;
  status?: UserStatus;
  approved_at?: string | null;
  approved_by?: string | null;
  suspended_reason?: string | null;
  created_at: string;
};

export type AdminContactDetails = {
  user_id: string;
  name: string | null;
  email: string | null;
  cpf: string | null;
  masked_cpf: string | null;
  phone: string | null;
};

export type BroadcastAudience = "all" | "pro" | "free" | "specific_users";
export type BroadcastType = "info" | "warning" | "critical" | "promotion" | "system";

export type AdminBroadcastNotification = {
  id: string;
  title: string;
  message: string;
  type: BroadcastType;
  action_url?: string | null;
  target_audience: BroadcastAudience;
  target_user_ids?: string[] | null;
  created_by?: string | null;
  created_at: string;
};

export type UserBroadcastNotification = {
  id: string;
  title: string;
  message: string;
  type: BroadcastType;
  action_url?: string | null;
  created_at: string;
  is_read: boolean;
  is_dismissed: boolean;
};

export type SystemBackup = {
  id: string;
  created_at: string;
  created_by?: string | null;
  backup_type: "manual" | "scheduled" | "pre_migration";
  table_count: number;
  record_count: number;
  file_size_bytes: number;
  checksum_sha256: string;
  status: "in_progress" | "completed" | "failed";
  notes?: string | null;
};

export type AccessInvite = {
  id: string;
  code: string;
  created_by?: string | null;
  target_tier?: SubscriptionTier;
  custom_trial_days?: number | null;
  module_grants?: Record<string, ModuleAccessLevel>;
  max_uses: number;
  used_count: number;
  target_email?: string | null;
  expires_at?: string | null;
  is_revoked: boolean;
  notes?: string | null;
  created_at: string;
};

export type Plan = {
  id: string;
  name: string;
  description?: string | null;
  price_cents: number;
  billing_interval?: "month" | "year" | null;
  is_publicly_available: boolean;
  created_at: string;
};

export type UserSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus["tier"] extends "trial" ? "trialing" | "active" | "past_due" | "canceled" | "read_only_expired" : string;
  starts_at: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end: boolean;
  payment_provider?: BillingProviderName;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  provider_payment_id?: string | null;
  asaas_customer_id?: string | null;
  asaas_subscription_id?: string | null;
  asaas_payment_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UserModulePermission = {
  id: string;
  user_id: string;
  module_key: string;
  access_level: ModuleAccessLevel;
  granted_by?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type SystemFeature = {
  key: string;
  name: string;
  description?: string | null;
  is_globally_enabled: boolean;
  default_enabled_for_new_users: boolean;
  created_at?: string;
  updated_at?: string;
};

export type UserFeatureOverride = {
  id: string;
  user_id: string;
  feature_key: string;
  is_enabled: boolean;
  granted_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminUserSummary = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  suspended_reason: string | null;
  total_count: number;
};

export type AdminMetrics = {
  total_users: number;
  active_users: number;
  pending_users: number;
  suspended_users: number;
  total_invites: number;
  used_invites: number;
};


export type UserCustomSettings = {
  experiencePreset?: "dynamic" | "minimal" | "discreet" | "custom";
  density?: "comfortable" | "compact";
  surfaceStyle?: "glass" | "flat";
  motionLevel?: "fluid" | "eco" | "reduced";
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
  disabledSensoryIntents?: string[];
  numberTickerEnabled?: boolean;
  dashboardWidgets?: {
    kpis?: boolean;
    summary?: boolean;
    flow?: boolean;
    donut?: boolean;
    budgets?: boolean;
    contextBanners?: boolean;
  };
  headerButtons?: {
    logo?: boolean;
    calculatorButton?: boolean;
    themeToggle?: boolean;
    privacyToggle?: boolean;
  };
  bankAssistant?: {
    passiveCaptureEnabled?: boolean;
    interactiveNotificationsEnabled?: boolean;
    autoInstallmentsEnabled?: boolean;
    autoCategoryInferenceEnabled?: boolean;
    monitoredBanks?: string[];
  };
  deviceNotifications?: DeviceNotificationsCustomSettings;
  merchantLearning?: Record<string, unknown>;
  cardDigitsMapping?: Record<string, string>;
  bankCardMapping?: Record<string, string>;
  privacyShieldEnabled?: boolean;
  primaryCardId?: string | null;
  cardOrder?: string[];
  advisorDismissals?: Record<string, number>;
  advisorLastDismissedDay?: string | null;
  dashboardAlertDismissals?: DashboardAlertDismissals;
  emergencyFundConfig?: EmergencyFundConfig;
  splitPreferences?: SplitPreferences;
  familyModeEnabled?: boolean;
  tripModeEnabled?: boolean;
  preferredTripCategoryId?: string;
  initialGoal?: OnboardingGoalId;
  themePreference?: ThemePreference;
  darkThemeVariant?: DarkThemeVariant;
  themeSchedule?: ThemeScheduleConfig;
};

export type OnboardingGoalId = "cards" | "ocr" | "debts" | "family";

export type GoalAlertStage = "completed" | "final_stretch" | "has_surplus" | "regular";

export type GoalAlertDismissalCheckpoint = {
  dismissedAt: string;
  currentCents: number;
  targetCents: number;
  stage: GoalAlertStage;
  percentage: number;
  status?: string;
};

export type PaceAlertDismissalCheckpoint = {
  dismissedAt: string;
  month: string;
  spentPercent: number;
  surplusCents: number | null;
};

export type SurplusAlertDismissalCheckpoint = {
  dismissedAt: string;
  month: string;
  surplusCents: number;
};

export type ZeroGuiltDismissalCheckpoint = {
  dismissedAtDate: string;
};

export type DashboardAlertDismissals = {
  goals?: Record<string, GoalAlertDismissalCheckpoint>;
  pace?: PaceAlertDismissalCheckpoint;
  surplus?: SurplusAlertDismissalCheckpoint;
  zeroGuilt?: ZeroGuiltDismissalCheckpoint;
};

export type DeviceNotificationsCustomSettings = {
  dueNotificationsEnabled?: boolean;
  dailyReminderEnabled?: boolean;
  dailyReminderTime?: string;
  dismissedPermissionAlerts?: {
    pushDue?: boolean;
    passiveBankListener?: boolean;
  };
};

export type SplitPreferences = {
  pixKey?: string;
  pixKeyType?: "auto" | "cpf" | "phone" | "email" | "random" | "cnpj";
  merchantName?: string;
  merchantCity?: string;
  remainderPolicy?: "balanced" | "host";
  defaultPeopleCount?: number;
  autoCreateDebt?: boolean;
};

export type EmergencySelectionMode = "auto_cash" | "selected_assets" | "selected_classes" | "entire_portfolio";

export interface EmergencyFundConfig {
  /** Se deve somar o saldo em contas correntes / caixa real. Padrão: true. */
  includeCheckingAccounts: boolean;
  /** Modo de seleção de investimentos. Padrão: "auto_cash". */
  selectionMode: EmergencySelectionMode;
  /** IDs de ativos específicos em portfolio_assets. */
  selectedAssetIds: string[];
  /** Nomes das classes de ativos elegíveis (ex: ["Tesouro Direto", "Renda Fixa"]). */
  selectedClasses: string[];
  /** Se deve calcular a reserva pelo valor líquido pós-IR (quando disponível). Padrão: true. */
  useNetValue?: boolean;
  /** Meta personalizada de autonomia do usuário em meses (3, 6 ou 12). Padrão: 6. */
  targetMonths?: 3 | 6 | 12;
}

export type AppMode = "essential" | "investor";

export type UserPreferences = {
  user_id: string;
  theme: ThemePreference;
  reminders_enabled: boolean;
  reminder_days_before_debt: number;
  reminder_days_before_bill: number;
  report_weights_enabled: boolean;
  max_sector_acoes: number | null;
  max_sector_fiis: number | null;
  app_mode: AppMode;
  custom_settings?: UserCustomSettings;
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
  /** Sugere marcar lançamentos desta categoria como despesa familiar por padrão (Fase 3). */
  is_family?: boolean;
  /** Identificador da família vinculada se for categoria compartilhada. */
  family_id?: string | null;
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
  /** Parcelamento (Fase 32) — colunas com default no banco; opcionais no contrato TS. */
  installments_total?: number;
  installment_number?: number;
  installment_group_id?: string | null;
  /** Grupo de recorrência (template `recurrences`) — avulso XOR parcela XOR recorrência. */
  recurrence_id?: string | null;
  /** 1-based dentro da recorrência (espelho do `occurrence_number` do motor). */
  occurrence_number?: number | null;
  /** Hash determinístico ordinal anti-duplicação de extrato/fatura (Fase 34). */
  statement_hash?: string | null;
  /** Flag que indica se a receita foi importada via extrato bancário. */
  imported_from_statement?: boolean;
  /** Flag que indica se o lançamento pertence ao orçamento familiar compartilhado (Fase 3). */
  is_family?: boolean;
  /** Identificador da família vinculada se for receita familiar. */
  family_id?: string | null;
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
  /** Natureza da despesa / encargo (regular, juros, multa, imposto, taxa) — default 'regular'. */
  charge_kind?: ChargeKind;
  /** Grupo de recorrência (template `recurrences`) — avulso XOR parcela XOR recorrência. */
  recurrence_id?: string | null;
  /** 1-based dentro da recorrência (espelho do `occurrence_number` do motor). */
  occurrence_number?: number | null;
  /** Hash determinístico ordinal anti-duplicação de extrato/fatura (Fase 30). */
  statement_hash?: string | null;
  /** Flag que indica se a despesa foi importada via extrato bancário. */
  imported_from_statement?: boolean;
  /** Flag que indica se a despesa pertence ao orçamento familiar compartilhado (Fase 3). */
  is_family?: boolean;
  /** Identificador da família vinculada se for despesa familiar. */
  family_id?: string | null;
  /** Identificador do grupo de viagem vinculado se pertencer a uma viagem. */
  trip_id?: string | null;
  created_at: string;
};

export type Recurrence = {
  id: string;
  user_id: string;
  kind: RecurrenceKind;
  frequency: RecurrenceFrequency;
  value: number;
  category_id: string;
  /** YYYY-MM-DD — primeira ocorrência. */
  start_date: string;
  /** Fim sempre definido: exatamente um entre `end_date` e `occurrences_total`. */
  end_date: string | null;
  occurrences_total: number | null;
  payment_method: PaymentMethod | null;
  card_id: string | null;
  receive_type: ReceiveType | null;
  description: string | null;
  report_weight: number;
  charge_kind?: ChargeKind;
  is_family?: boolean;
  is_active: boolean;
  created_at: string;
};

/** Ocorrência excluída individualmente — não regenera na materialização. */
export type RecurrenceSkip = {
  recurrence_id: string;
  occurrence_date: string;
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
  last_four_digits?: string | null;
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
  charge_kind?: ChargeKind;
  created_at: string;
};

export type Loan = {
  id: string;
  user_id: string;
  name: string;
  loan_type: LoanType;
  principal_amount: number;
  interest_rate_monthly: number;
  amortization_system: AmortizationSystem;
  total_installments: number;
  start_date: string;
  installment_group_id: string;
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
  sector?: string | null;
  currency: AssetCurrency;
  quantity: number;
  average_price: number;
  /**
   * Proventos históricos acumulados anteriores ao extrato periódico (`portfolio_dividends`).
   * Alimenta o YoC e a Bola de Neve sem distorcer o calendário/extrato mensal.
   */
  accumulated_dividends?: number;
  /**
   * Dividendo mensal estimado por cota (moeda nativa do ativo).
   * Alimenta a Bola de Neve quando não há lançamentos periódicos (Cenário B).
   */
  estimated_monthly_dividend_per_share?: number;
  /**
   * Metadados opcionais de títulos de renda fixa privada / parametrizada (Fase 63).
   * Taxa, indexador, marco zero, vencimento e regime de isenção de IR.
   */
  fixed_income_metadata?: FixedIncomeMetadata | null;
  /** Indica se o ativo pertence ao patrimônio compartilhado com a família */
  is_family?: boolean;
  family_id?: string | null;
  family_share_mode?: "full" | "percentage";
  family_share_percentage?: number;
  notes?: string | null;
  updated_at?: string;
};

export type FixedIncomeRateType = "cdi" | "selic" | "pre" | "ipca";

export type FixedIncomeIssuerType = "tesouro" | "bancario_fgc" | "credito_privado";

export type FiiMacroCategory =
  | "tijolo"
  | "papel"
  | "fof"
  | "hibrido"
  | "agro_infra"
  | "outros";

export type FixedIncomeMetadata = {
  rate_type: FixedIncomeRateType;
  rate_value: number;
  base_date: string;
  /** Saldo consolidado do título na data base_date (Marco Zero D₀). Fallback: average_price. */
  base_value?: number | null;
  /** Custo original aplicado na compra inicial / aporte do título. Preservado mesmo após liquidação. */
  initial_investment_value?: number | null;
  initial_investment_date?: string | null;
  maturity_date?: string | null;
  is_tax_exempt?: boolean;
  /** Alíquota manual de IR fixada pelo usuário (ex: 15, 17.5, 20, 22.5) ou null para cálculo automático. */
  manual_tax_rate_pct?: number | null;
  /** Classificação do emissor/risco de crédito (soberano, bancário com FGC ou crédito privado). */
  issuer_type?: FixedIncomeIssuerType | null;
};

/**
 * Snapshot patrimonial mensal da carteira (§F36/F50).
 * Fotografia financeira consolidada no fechamento da competência (último dia do mês).
 *
 * Invariantes Canônicas (§2.1 PLANO_AUDITORIA):
 * - `total_value`: Saldo patrimonial total na data de corte (Ativos valorados + Saldo de Caixa).
 * - `total_cost`: Custo de aquisição total aplicado sob custódia (Custo dos Ativos + Saldo de Caixa 1:1).
 *   O caixa possui paridade 1:1 (valor = custo), eliminando distorções de rentabilidade contábil.
 */
export type PortfolioSnapshot = {
  id: string;
  user_id: string;
  /** Competência no formato YYYY-MM. */
  month: string;
  /** Saldo patrimonial total na data de corte (Ativos valorados + Saldo de Caixa). */
  total_value: number;
  /** Custo de aquisição total aplicado sob custódia (Custo dos Ativos + Saldo de Caixa 1:1). */
  total_cost: number;
  /** Valor original gravado pelo fechamento oficial do mercado. */
  auto_total_value?: number | null;
  /** Custo original gravado pelo fechamento oficial do mercado. */
  auto_total_cost?: number | null;
  /** Valor calibrado manualmente pelo usuário. */
  manual_total_value?: number | null;
  /** Custo calibrado manualmente pelo usuário. */
  manual_total_cost?: number | null;
  /** Indica se o snapshot foi customizado por calibração manual do usuário. */
  is_manually_calibrated?: boolean;
  /** Data/hora da última calibração manual do snapshot. */
  calibrated_at?: string | null;
  /** Status do snapshot: provisional (em aberto/estimado) ou closed (fechamento consolidado). */
  status?: "provisional" | "closed";
  /** Data efetiva do último dia útil de mercado do fechamento mensal. */
  closing_date?: string | null;
  /** Data/hora exata do processamento do fechamento. */
  closed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CorporateDividendType = "DIVIDENDO" | "JCP" | "RENDIMENTO" | "SOBRA" | "AMORTIZACAO" | "OUTROS";

export type CorporateDividend = {
  id: string;
  ticker: string;
  type: CorporateDividendType;
  com_date: string;
  payment_date: string;
  rate: number;
  currency: "BRL" | "USD";
  net_rate: number;
  created_at?: string;
};

export type PortfolioDividendDismissalReason = "already_received" | "not_applicable" | "manual_ignore";

export type PortfolioDividendDismissal = {
  id: string;
  user_id: string;
  corporate_dividend_id: string;
  reason: PortfolioDividendDismissalReason;
  dismissed_at?: string;
};

export type ApproveDividendsBatchItem = {
  asset_id?: string | null;
  ticker: string;
  date: string;
  amount: number;
  notes?: string | null;
  corporate_dividend_id?: string | null;
};

export type ApproveDividendsBatchPayload = {
  dividends: ApproveDividendsBatchItem[];
  sync_cash?: boolean;
};

export type ApproveDividendsBatchResult = {
  success: boolean;
  inserted_count: number;
  total_cash: number;
  cash_asset_id: string | null;
  inserted_ids: string[];
};

export type MonthlyClosingPriceItem = {
  ticker: string;
  price: number;
  currency?: "BRL" | "USD";
  source?: "api" | "manual" | "fallback";
};

export type MonthlyClosingPayload = {
  month: string;
  closing_date: string;
  prices: MonthlyClosingPriceItem[];
  total_value: number;
  total_cost: number;
};

export type MonthlyClosingResult = {
  success: boolean;
  month: string;
  total_value: number;
  total_cost: number;
  prices_count: number;
};

/**
 * Payload canônico de entrada para criação ou atualização de snapshot patrimonial.
 */
export type PortfolioSnapshotInput = {
  /** Competência no formato YYYY-MM. */
  month: string;
  /** Saldo patrimonial total na data de corte (Ativos valorados + Saldo de Caixa). */
  total_value: number;
  /** Custo de aquisição total aplicado sob custódia (Custo dos Ativos + Saldo de Caixa 1:1). */
  total_cost: number;
  /** Valor original gravado pelo fechamento oficial do mercado. */
  auto_total_value?: number | null;
  /** Custo original gravado pelo fechamento oficial do mercado. */
  auto_total_cost?: number | null;
  /** Valor calibrado manualmente pelo usuário. */
  manual_total_value?: number | null;
  /** Custo calibrado manualmente pelo usuário. */
  manual_total_cost?: number | null;
  /** Indica se o snapshot foi customizado por calibração manual do usuário. */
  is_manually_calibrated?: boolean;
  /** Data/hora da última calibração manual do snapshot. */
  calibrated_at?: string | null;
  /** Status do snapshot: provisional (em aberto/estimado) ou closed (fechamento consolidado). */
  status?: "provisional" | "closed";
  /** Data efetiva do último dia útil de mercado do fechamento mensal (YYYY-MM-DD). */
  closing_date?: string | null;
  /** Data/hora exata do processamento do fechamento. */
  closed_at?: string | null;
};

export type PortfolioMonthlyPrice = {
  id: string;
  user_id: string;
  ticker: string;
  month: string;
  price: number;
  currency: "BRL" | "USD";
  source: "api" | "manual" | "fallback";
  created_at?: string;
  updated_at?: string;
};

export type PortfolioContribution = {
  id: string;
  user_id: string;
  asset_id: string | null;
  date: string;
  amount: number;
  notes?: string | null;
  created_at?: string;
};

export type PortfolioDividend = {
  id: string;
  user_id: string;
  asset_id: string | null;
  ticker?: string | null;
  date: string;
  amount: number;
  notes?: string | null;
  sync_cash?: boolean | null;
  cash_amount?: number | null;
  created_at?: string;
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

export type PresetAssetTarget = {
  ticker: string;
  asset_id?: string;
  target_percentage: number;
};

export type PresetClassTarget = {
  name: string;
  target_percentage: number;
};

export type PresetSectorTarget = {
  class_name: string;
  name: string;
  target_percentage: number;
};

export type AllocationPreset = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  asset_targets: PresetAssetTarget[];
  class_targets: PresetClassTarget[];
  sector_targets?: PresetSectorTarget[];
  created_at: string;
  updated_at: string;
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

export type CashCheckpoint = {
  id: string;
  user_id: string;
  /** Data de aferição do saldo (YYYY-MM-DD). */
  date: string;
  /** Saldo bancário em centavos (inteiro). */
  balance_cents: number;
  notes: string | null;
  created_at: string;
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

export type DbInsert<T> = Omit<T, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
export type DbUpdate<T> = Partial<DbInsert<T>>;

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  suspended_reason: string | null;
  total_count: number;
};

export type CreditCardForm = {
  name: string;
  brand: string | null;
  credit_limit: number | null;
  closing_day: number;
  due_day: number;
  color: string | null;
  is_active: boolean;
  last_four_digits?: string | null;
};

export type AllocationTargetInput = {
  assetId: string;
  /** 0–100. */
  target: number;
};

export type RecurrenceGroupFields = {
  value?: number | null;
  category_id?: string | null;
  description?: string | null;
  report_weight?: number | null;
  payment_method?: string | null;
  card_id?: string | null;
  receive_type?: string | null;
  bill_competence?: string | null;
  is_family?: boolean | null;
};

export type InstallmentInput = {
  date: string;
  value: number;
  /** Competência de fatura (snapshot) quando cartão — calculada no cliente. */
  billCompetence?: string | null;
};

export type SupportTicketType = "doubt" | "bug" | "suggestion" | "other";
export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type SupportTicket = {
  id: string;
  user_id: string;
  type: SupportTicketType;
  status: SupportTicketStatus;
  subject: string | null;
  message: string;
  user_email: string | null;
  user_name: string | null;
  app_version: string | null;
  current_route: string | null;
  device_info: Record<string, unknown>;
  admin_notes: string | null;
  admin_reply?: string | null;
  admin_replied_at?: string | null;
  user_read_at?: string | null;
  admin_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminTelegramSettings = {
  id: string;
  notify_support: boolean;
  notify_git: boolean;
  notify_deploys: boolean;
  notify_analytics: boolean;
  notify_new_users: boolean;
  silent_mode: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type AppAnalyticsEvent = {
  id: string;
  user_id: string | null;
  event_name: string;
  module: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type FeatureUsageMetric = {
  module: string;
  count: number;
  percentage: number;
  lastUsedAt: string | null;
};

export const PUBLIC_SHARE_KINDS = ["split", "family_budget", "goal_tracker"] as const;
export type PublicShareKind = (typeof PUBLIC_SHARE_KINDS)[number];

export type SplitParticipantItem = {
  id?: string;
  name: string;
  share_cents: number;
  is_host: boolean;
  is_settled?: boolean;
  settled_cents?: number;
  settled_at?: string | null;
  has_payment_signal?: boolean;
  payment_signaled_at?: string | null;
};

export type SplitParticipantInstallment = {
  id: string;
  participant_id: string;
  installment_number: number;
  total_installments: number;
  amount_cents: number;
  due_date: string;
  is_settled: boolean;
  settled_at?: string | null;
  signal_status?: "none" | "pending_confirmation";
  signaled_at?: string | null;
};

export type SplitPaymentSignal = {
  id: string;
  participant_id?: string | null;
  installment_id?: string | null;
  participant_name: string;
  amount_cents: number;
  status: "pending" | "confirmed" | "dismissed";
  created_at: string;
  confirmed_at?: string | null;
  dismissed_at?: string | null;
  installment_number?: number | null;
};

export type SplitSharePayload = {
  title: string;
  total_cents: number;
  date: string;
  people_count: number;
  guest_share_cents: number;
  host_share_cents: number;
  participants: SplitParticipantItem[];
  remainder_policy: "host" | "balanced";
  host_name: string;
  host_city: string;
  pix_key: string;
  pix_key_type: string;
  pix_br_code: string;
  expense_id?: string;
  installment_group_id?: string | null;
  debt_id?: string;
  category_id?: string;
  category_name?: string;
  category_icon?: string;
  is_completed?: boolean;
  total_settled_cents?: number;
  payment_signals?: SplitPaymentSignal[];
  installments_count?: number;
  installments_mode?: "single_total" | "per_installment";
  participant_installments?: SplitParticipantInstallment[];
};

export type PublicShare = {
  id: string;
  user_id: string;
  kind: PublicShareKind;
  token: string;
  payload: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
  is_revoked: boolean;
  updated_at: string;
};

export type SharedFamilyExpenseItem = {
  id: string;
  description: string;
  date: string;
  amount_cents: number;
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
  payer_name?: string | null;
};

export type SharedFamilyBudgetResult = {
  token: string;
  month: string;
  owner_name: string;
  monthly_ceiling_cents: number;
  total_spent_cents: number;
  remaining_cents: number;
  spent_percentage: number;
  is_revoked: boolean;
  expires_at: string | null;
  expenses: SharedFamilyExpenseItem[];
};

export type FamilyBudgetSharePayload = {
  monthly_ceiling_cents?: number;
  owner_name?: string;
  title?: string;
};

export type GoalContribution = {
  id: string;
  amount_cents: number;
  contributor_name?: string;
  date: string;
};

export type GoalTrackerStatus = "active" | "completed" | "archived";

export type GoalTrackerSharePayload = {
  title: string;
  category_id?: string | null;
  month?: string;
  target_cents: number;
  current_cents?: number;
  deadline?: string | null;
  organizer_name?: string;
  organizer_city?: string;
  pix_key?: string;
  pix_key_type?: string;
  pix_br_code?: string;
  is_shared?: boolean;
  status?: GoalTrackerStatus;
  notes?: string;
  contributions?: GoalContribution[];
  show_contributions_publicly?: boolean;
  source_mode?: GoalSourceMode;
  composition_config?: GoalCompositionConfig | null;
};

export type SharedGoalTrackerResult = {
  token: string;
  title: string;
  category_id?: string | null;
  target_cents: number;
  current_cents: number;
  remaining_cents: number;
  percentage: number;
  deadline: string | null;
  days_remaining: number | null;
  organizer_name: string;
  organizer_city: string;
  pix_key: string;
  pix_key_type: string;
  pix_br_code: string;
  is_revoked: boolean;
  expires_at: string | null;
  status?: GoalTrackerStatus;
  notes?: string | null;
  contributions?: GoalContribution[];
  show_contributions_publicly?: boolean;
  source_mode?: GoalSourceMode;
  composition_config?: GoalCompositionConfig | null;
};

// ===========================================================================
// Modo Família Colaborativo Multi-Contas (Plano 03)
// ===========================================================================

export type FamilySplitRule = "equal" | "proportional" | "combined";

export type Family = {
  id: string;
  name: string;
  owner_id: string;
  monthly_budget?: number | null;
  split_rule: FamilySplitRule;
  created_at: string;
  updated_at: string;
};

export type FamilyMemberRole = "owner" | "admin" | "member";
export type FamilyPixKeyType = "cpf" | "email" | "phone" | "random";

export type FamilyMember = {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyMemberRole;
  display_name?: string | null;
  pix_key?: string | null;
  pix_key_type?: FamilyPixKeyType | null;
  split_ratio?: number | null;
  share_all_portfolio?: boolean;
  shared_asset_classes?: string[] | null;
  created_at: string;
  updated_at: string;
};

export type FamilyInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export type FamilyInvite = {
  id: string;
  family_id: string;
  invited_by: string;
  invited_email?: string | null;
  token: string;
  status: FamilyInviteStatus;
  role: FamilyMemberRole;
  created_at: string;
  expires_at: string;
  accepted_by?: string | null;
  accepted_at?: string | null;
};

export interface FamilyMemberWithProfile extends FamilyMember {
  profile_name?: string | null;
  profile_email?: string | null;
}

export interface MyFamilyData {
  family: Family;
  members: FamilyMemberWithProfile[];
  currentMember: FamilyMemberWithProfile;
  invites: FamilyInvite[];
}

export type FamilySettlementPaymentMethod = "pix" | "transfer" | "cash" | "other";

export type FamilySettlement = {
  id: string;
  family_id: string;
  month: string;
  payer_id: string;
  receiver_id: string;
  amount: number;
  settled_at: string;
  payment_method: FamilySettlementPaymentMethod;
  notes?: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
  created_by: string;
};

export type InviteFamilyMemberResult = {
  id: string;
  family_id: string;
  token: string;
  role: FamilyMemberRole;
  invited_email: string | null;
  status: FamilyInviteStatus;
  expires_at: string;
  created_at: string;
};

export type AcceptFamilyInviteResult = {
  success: boolean;
  family_id: string;
  role: FamilyMemberRole;
};

export type LeaveFamilyResult = {
  success: boolean;
  family_id: string;
  disbanded: boolean;
};

export type RemoveFamilyMemberResult = {
  success: boolean;
  family_id: string;
  removed_user_id: string;
};

// ===========================================================================
// Consolidação Familiar Multi-Contas (Tarefa 1.2 / RPC get_family_consolidation)
// ===========================================================================

export type FamilyConsolidationMember = {
  user_id: string;
  role: FamilyMemberRole;
  display_name: string;
  pix_key: string | null;
  pix_key_type: FamilyPixKeyType | null;
  split_ratio: number | null;
  spent_cents: number;
  percentage_of_total: number;
};

export type FamilyConsolidationExpense = {
  id: string;
  description: string;
  date: string;
  amount_cents: number;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  category_color: string | null;
  user_id: string;
  payer_name: string;
  is_own: boolean;
  created_at: string;
};

export type FamilyConsolidationSettlement = {
  id: string;
  month: string;
  payer_id: string;
  payer_name: string;
  receiver_id: string;
  receiver_name: string;
  amount_cents: number;
  settled_at: string;
  payment_method: FamilySettlementPaymentMethod;
  notes: string | null;
  created_at: string;
};

export type FamilyConsolidationResult = {
  family: {
    id: string;
    name: string;
    owner_id: string;
    monthly_budget_cents: number;
    split_rule: FamilySplitRule;
  };
  month: string;
  monthly_ceiling_cents: number;
  total_spent_cents: number;
  total_income_cents: number;
  remaining_cents: number;
  spent_percentage: number;
  members: FamilyConsolidationMember[];
  expenses: FamilyConsolidationExpense[];
  is_settled: boolean;
  settlement: FamilyConsolidationSettlement | null;
  has_post_settlement_expenses: boolean;
};

// ===========================================================================
// Sugestão Inteligente de Rateio & Resumo Patrimonial Familiar
// ===========================================================================

export type FamilyIncomeRatioSuggestionItem = {
  user_id: string;
  display_name: string;
  average_monthly_income_cents: number;
  suggested_percentage: number;
};

export type FamilySharedAssetSummary = {
  id: string;
  user_id: string;
  ticker: string;
  asset_class: string;
  quantity: number;
  total_value_cents: number;
  owner_name: string;
  is_cash_like: boolean;
};

export type FamilyPortfolioSummary = {
  family_id: string;
  total_invested_cents: number;
  total_cash_cents: number;
  dividends_12m_cents: number;
  assets_count: number;
  assets: FamilySharedAssetSummary[];
};

// ===========================================================================
// Dispositivos e Gestão de Sessões Multi-Aparelho (Etapa 1.1)
// ===========================================================================

export type UserDevice = {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  browser: string;
  os: string;
  ip_address: string | null;
  last_seen_at: string;
  created_at: string;
  is_revoked: boolean;
};

export type DeviceRegistrationInput = {
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress?: string | null;
};
