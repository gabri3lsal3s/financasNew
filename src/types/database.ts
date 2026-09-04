import type {
  AccessInvite,
  AllocationPreset,
  AllocationTarget,
  AssetPrice,
  AuditEvent,
  Budget,
  CardCompetenceOverride,
  CardPayment,
  CashCheckpoint,
  Category,
  CreditCard,
  DbInsert,
  DbUpdate,
  Debt,
  Expense,
  GroupTarget,
  Income,
  IncomeGoal,
  InsightFeedback,
  Loan,
  Plan,
  PortfolioAsset,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioSnapshot,
  ReminderState,
  PortfolioTransaction,
  Profile,
  Recurrence,
  RecurrenceSkip,
  SystemFeature,
  UserFeatureOverride,
  UserModulePermission,
  UserPreferences,
  UserSubscription,
} from "./schema";

/**
 * Contrato de banco para `createClient<Database>` (supabase-js).
 *
 * `Table<T>` injeta o `Relationships` exigido pelo GenericSchema do
 * supabase-js (tipos gerados pela CLI fazem o mesmo). Espelha
 * `supabase/migrations/` — manter em sincronia ao alterar o schema
 * (regra de atualização contínua da docs/).
 */
type Table<T> = { Row: T; Insert: DbInsert<T>; Update: DbUpdate<T>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile>;
      plans: Table<Plan>;
      user_subscriptions: Table<UserSubscription>;
      user_module_permissions: Table<UserModulePermission>;
      user_preferences: Table<UserPreferences>;
      access_invites: Table<AccessInvite>;
      system_features: Table<SystemFeature>;
      user_feature_overrides: Table<UserFeatureOverride>;
      categories: Table<Category>;
      incomes: Table<Income>;
      expenses: Table<Expense>;
      credit_cards: Table<CreditCard>;
      card_competence_overrides: Table<CardCompetenceOverride>;
      card_payments: Table<CardPayment>;
      debts: Table<Debt>;
      loans: Table<Loan>;
      recurrences: Table<Recurrence>;
      recurrence_skips: Table<RecurrenceSkip>;
      budgets: Table<Budget>;
      income_goals: Table<IncomeGoal>;
      insight_feedback: Table<InsightFeedback>;
      reminder_states: Table<ReminderState>;
      portfolio_assets: Table<PortfolioAsset>;
      portfolio_contributions: Table<PortfolioContribution>;
      portfolio_dividends: Table<PortfolioDividend>;
      portfolio_snapshots: Table<PortfolioSnapshot>;
      portfolio_transactions: Table<PortfolioTransaction>;
      allocation_targets: Table<AllocationTarget>;
      allocation_presets: Table<AllocationPreset>;
      class_targets: Table<GroupTarget>;
      sector_targets: Table<GroupTarget>;
      asset_prices: Table<AssetPrice>;
      cash_checkpoints: Table<CashCheckpoint>;
      audit_events: Table<AuditEvent>;
    };

    Views: Record<string, never>;
    Functions: {
      create_expense_with_debt: {
        Args: {
          p_value: number;
          p_date: string;
          p_category_id: string;
          p_payment_method: string;
          p_card_id: string | null;
          p_description: string | null;
          p_report_weight: number;
          /** Parcelas calculadas no cliente (D12): [{ date, value, bill_competence? }]. */
          p_installments: unknown;
          p_debt_name: string | null;
          p_debt_amount: number | null;
          p_debt_due_date: string | null;
          p_debt_type?: string | null;
        };
        Returns: string;
      };
      create_refund: {
        Args: {
          p_card_id: string;
          p_competence_month: string;
          p_amount: number;
          p_date: string;
          p_note: string | null;
        };
        Returns: string;
      };
      delete_expense_installments: {
        Args: { p_expense_id: string; p_mode: "single" | "all" | "subsequent" };
        Returns: number;
      };
      update_expense_installments_group: {
        Args: { p_expense_id: string; p_mode: "single" | "all" | "subsequent"; p_fields: unknown };
        Returns: number;
      };
      create_recurrence: {
        Args: {
          p_kind: string;
          p_frequency: string;
          p_value: number;
          p_category_id: string;
          p_start_date: string;
          p_end_date: string | null;
          p_occurrences_total: number | null;
          p_payment_method: string | null;
          p_card_id: string | null;
          p_receive_type: string | null;
          p_description: string | null;
          p_report_weight: number;
        };
        Returns: string;
      };
      materialize_recurrences: {
        Args: { p_items: unknown };
        Returns: number;
      };
      delete_recurrence_occurrences: {
        Args: { p_occurrence_id: string; p_mode: "single" | "all" | "subsequent" };
        Returns: number;
      };
      update_recurrence_occurrences: {
        Args: { p_occurrence_id: string; p_mode: "single" | "all" | "subsequent"; p_fields: unknown };
        Returns: number;
      };
      create_income_installments: {
        Args: {
          p_value: number;
          p_date: string;
          p_category_id: string;
          p_receive_type: string;
          p_description: string | null;
          p_report_weight: number;
          p_installments: unknown;
        };
        Returns: string;
      };
      delete_income_installments: {
        Args: { p_income_id: string; p_mode: "single" | "all" | "subsequent" };
        Returns: number;
      };
      update_income_installments_group: {
        Args: { p_income_id: string; p_mode: "single" | "all" | "subsequent"; p_fields: unknown };
        Returns: number;
      };
      pay_debt: {
        Args: {
          p_debt_id: string;
          p_create_expense: boolean;
          p_expense_category_id: string | null;
          p_fine_amount?: number;
          p_interest_amount?: number;
          p_discount_amount?: number;
          p_total_paid?: number | null;
        };
        Returns: string;
      };
      create_loan_contract: {
        Args: {
          p_name: string;
          p_loan_type: string;
          p_principal_amount: number;
          p_interest_rate_monthly: number;
          p_amortization_system: string;
          p_total_installments: number;
          p_start_date: string;
          p_installments: unknown;
        };
        Returns: string;
      };
      early_amortize_loan: {
        Args: {
          p_loan_id: string;
          p_debt_ids: string[];
          p_create_expense: boolean;
          p_expense_category_id: string | null;
          p_total_paid: number;
          p_discount_total: number;
        };
        Returns: boolean;
      };
      refinance_credit_card_bill: {
        Args: {
          p_card_id: string;
          p_competence_month: string;
          p_initial_payment_amount: number;
          p_interest_installments: unknown;
          p_expense_category_id: string;
        };
        Returns: boolean;
      };
      receive_debt: {
        Args: { p_debt_id: string; p_create_income: boolean; p_income_category_id: string | null };
        Returns: string;
      };
      settle_integrated_receivable: {
        Args: { p_debt_id: string; p_result: number };
        Returns: void;
      };
      delete_category_migrate: {
        Args: { p_category_id: string; p_migrate_to: string | null };
        Returns: void;
      };
      set_budget_limit: {
        Args: { p_category_id: string; p_month: string; p_limit: number };
        Returns: void;
      };
      set_income_goal: {
        Args: { p_category_id: string; p_month: string; p_expected: number };
        Returns: void;
      };
      recalculate_bill_competences: {
        Args: { p_card_id: string };
        Returns: number;
      };
      create_card_payment: {
        Args: {
          p_card_id: string;
          p_competence_month: string;
          p_amount: number;
          p_date: string;
          p_note: string | null;
        };
        Returns: string;
      };
      update_credit_card: {
        Args: {
          p_card_id: string;
          p_name: string;
          p_brand: string | null;
          p_credit_limit: number | null;
          p_closing_day: number;
          p_due_day: number;
          p_color: string | null;
          p_is_active: boolean;
        };
        Returns: void;
      };
      delete_credit_card: {
        Args: { p_card_id: string };
        Returns: void;
      };
      delete_card_payment: {
        Args: { p_payment_id: string };
        Returns: void;
      };
      reallocate_budget: {
        Args: {
          p_from_category_id: string;
          p_to_category_id: string;
          p_month: string;
          p_amount: number;
        };
        Returns: void;
      };
      set_allocation_targets: {
        Args: { p_targets: unknown };
        Returns: void;
      };
      set_group_target: {
        Args: { p_group_type: "class" | "sector"; p_name: string; p_target: number };
        Returns: void;
      };
      remove_group_target: {
        Args: { p_group_type: "class" | "sector"; p_name: string };
        Returns: void;
      };
      restore_backup: {
        Args: { p_backup: unknown };
        Returns: Record<string, number>;
      };
      import_statement_expenses: {
        Args: {
          p_card_id: string;
          p_competence_month: string;
          p_expenses: unknown;
        };
        Returns: {
          success: boolean;
          inserted_count: number;
          skipped_count: number;
        };
      };
      import_bank_transactions: {
        Args: {
          p_expenses: unknown;
          p_incomes: unknown;
        };
        Returns: {
          success: boolean;
          expenses_inserted: number;
          expenses_skipped: number;
          incomes_inserted: number;
          incomes_skipped: number;
        };
      };
      execute_portfolio_batch_aporte: {
        Args: {
          p_items: unknown;
          p_date: string;
          p_total_amount: number;
          p_notes?: string | null;
        };
        Returns: boolean;
      };
      get_my_features: {
        Args: Record<string, never>;
        Returns: Record<string, boolean>;
      };
      admin_list_users: {
        Args: {
          p_search?: string | null;
          p_status?: string | null;
          p_role?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Array<{
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
        }>;
      };
      admin_update_user_status: {
        Args: {
          p_user_id: string;
          p_status: string;
          p_reason?: string | null;
        };
        Returns: void;
      };
      admin_set_user_role: {
        Args: {
          p_user_id: string;
          p_role: string;
        };
        Returns: void;
      };
      admin_set_feature_override: {
        Args: {
          p_user_id: string;
          p_feature_key: string;
          p_enabled: boolean;
        };
        Returns: void;
      };
      admin_remove_feature_override: {
        Args: {
          p_user_id: string;
          p_feature_key: string;
        };
        Returns: void;
      };
      admin_toggle_global_feature: {
        Args: {
          p_feature_key: string;
          p_enabled: boolean;
        };
        Returns: void;
      };
      admin_create_invite: {
        Args: {
          p_code: string;
          p_max_uses?: number;
          p_expires_at?: string | null;
          p_target_email?: string | null;
        };
        Returns: string;
      };
      admin_revoke_invite: {
        Args: {
          p_invite_id: string;
        };
        Returns: void;
      };
      admin_get_metrics: {
        Args: Record<string, never>;
        Returns: {
          total_users: number;
          active_users: number;
          pending_users: number;
          suspended_users: number;
          total_invites: number;
          used_invites: number;
        };
      };
      get_my_subscription: {
        Args: Record<string, never>;
        Returns: {
          tier: string;
          status: string;
          plan_id: string;
          starts_at: string;
          trial_ends_at: string | null;
          current_period_end: string | null;
          trial_days_remaining: number | null;
          cancel_at_period_end: boolean;
          is_full_access: boolean;
          is_trial: boolean;
          is_pro: boolean;
          is_lifetime: boolean;
          is_read_only: boolean;
          can_write: boolean;
          module_permissions: Record<string, string>;
        };
      };
      admin_set_user_subscription: {
        Args: {
          p_user_id: string;
          p_plan_id: string;
          p_tier: string;
          p_status: string;
          p_trial_ends_at?: string | null;
          p_current_period_end?: string | null;
        };
        Returns: void;
      };
      admin_set_user_module_permission: {
        Args: {
          p_user_id: string;
          p_module_key: string;
          p_access_level: string;
          p_expires_at?: string | null;
        };
        Returns: void;
      };
      admin_remove_user_module_permission: {
        Args: {
          p_user_id: string;
          p_module_key: string;
        };
        Returns: void;
      };
      admin_create_modular_invite: {
        Args: {
          p_code: string;
          p_target_tier?: string;
          p_custom_trial_days?: number | null;
          p_module_grants?: unknown;
          p_max_uses?: number;
          p_expires_at?: string | null;
          p_target_email?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      upsert_marco_zero: {
        Args: {
          p_date: string;
          p_amount: number;
          p_notes?: string;
        };
        Returns: PortfolioContribution;
      };
    };
  };
}


