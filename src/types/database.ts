import type {
  AllocationTarget,
  AssetPrice,
  AuditEvent,
  Budget,
  CardCompetenceOverride,
  CardPayment,
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
  PortfolioAsset,
  ReminderState,
  PortfolioTransaction,
  Profile,
  Recurrence,
  RecurrenceSkip,
  UserPreferences,
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
      user_preferences: Table<UserPreferences>;
      categories: Table<Category>;
      incomes: Table<Income>;
      expenses: Table<Expense>;
      credit_cards: Table<CreditCard>;
      card_competence_overrides: Table<CardCompetenceOverride>;
      card_payments: Table<CardPayment>;
      debts: Table<Debt>;
      recurrences: Table<Recurrence>;
      recurrence_skips: Table<RecurrenceSkip>;
      budgets: Table<Budget>;
      income_goals: Table<IncomeGoal>;
      insight_feedback: Table<InsightFeedback>;
      reminder_states: Table<ReminderState>;
      portfolio_assets: Table<PortfolioAsset>;
      portfolio_transactions: Table<PortfolioTransaction>;
      allocation_targets: Table<AllocationTarget>;
      class_targets: Table<GroupTarget>;
      sector_targets: Table<GroupTarget>;
      asset_prices: Table<AssetPrice>;
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
        Args: { p_debt_id: string; p_create_expense: boolean; p_expense_category_id: string | null };
        Returns: string;
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
    };
  };
}
