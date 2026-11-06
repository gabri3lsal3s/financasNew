export type FamilyWealthGoalType =
  | "emergency_reserve"
  | "wealth_accumulation"
  | "passive_income"
  | "acquisition";

export interface FamilyWealthGoal {
  id: string;
  family_id: string;
  title: string;
  target_cents: number;
  current_cents: number;
  target_date?: string | null;
  goal_type: FamilyWealthGoalType;
  monthly_passive_income_target_cents?: number | null;
  linked_asset_classes?: string[] | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type FamilyEmergencyReserveStatus =
  | "critical"
  | "moderate"
  | "solid"
  | "excellent";

export interface FamilyEmergencyReserveReport {
  months_covered: number;
  total_cash_cents: number;
  monthly_expenses_cents: number;
  status: FamilyEmergencyReserveStatus;
  label: string;
  target_months?: number;
  target_cents?: number;
  progress_percent?: number;
  remaining_cents?: number;
  has_ceiling?: boolean;
}

export interface FamilyPassiveIncomeReport {
  fixed_expenses_coverage_percent: number;
  dividends_12m_cents: number;
  monthly_fixed_expenses_cents: number;
  is_independent: boolean;
}
