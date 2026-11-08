/**
 * Tipos canônicos do Modo Viagem (Áxis Finance).
 * Espelham as tabelas trips, trip_members, trip_expenses, trip_expense_splits e trip_settlements.
 */

export const TRIP_STATUSES = [
  "planning",
  "active",
  "settling",
  "completed",
  "archived",
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_SPLIT_TYPES = ["equal", "custom", "shares"] as const;
export type TripSplitType = (typeof TRIP_SPLIT_TYPES)[number];

export const TRIP_PIX_KEY_TYPES = [
  "cpf",
  "cnpj",
  "email",
  "phone",
  "random",
] as const;
export type TripPixKeyType = (typeof TRIP_PIX_KEY_TYPES)[number];

export const TRIP_SETTLEMENT_STATUSES = ["pending", "confirmed"] as const;
export type TripSettlementStatus = (typeof TRIP_SETTLEMENT_STATUSES)[number];

export type Trip = {
  id: string;
  host_user_id: string;
  title: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  status: TripStatus;
  currency: string;
  public_token: string;
  passcode_hash: string | null;
  cover_photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type TripMember = {
  id: string;
  trip_id: string;
  name: string;
  user_id: string | null;
  pix_key: string | null;
  pix_key_type: TripPixKeyType | null;
  is_host: boolean;
  created_at: string;
};

export type TripExpenseSplit = {
  id: string;
  expense_id: string;
  member_id: string;
  share_cents: number;
};

export type TripExpense = {
  id: string;
  trip_id: string;
  paid_by_member_id: string;
  amount_cents: number;
  description: string;
  category_name: string;
  expense_date: string;
  split_type: TripSplitType;
  receipt_url: string | null;
  created_by_member_id: string | null;
  linked_personal_expense_id: string | null;
  created_at: string;
  updated_at: string;
  splits?: TripExpenseSplit[];
};

export type TripSettlement = {
  id: string;
  trip_id: string;
  from_member_id: string;
  to_member_id: string;
  amount_cents: number;
  status: TripSettlementStatus;
  confirmed_at: string | null;
  pix_transaction_id: string | null;
  created_at: string;
};

export type PublicTripMember = {
  id: string;
  name: string;
  is_host: boolean;
  has_axis_account: boolean;
  pix_key: string | null;
  pix_key_type: TripPixKeyType | null;
};

export type PublicTripExpense = {
  id: string;
  paid_by_member_id: string;
  amount_cents: number;
  description: string;
  category_name: string;
  expense_date: string;
  split_type: TripSplitType;
  receipt_url: string | null;
  created_at: string;
  splits: {
    member_id: string;
    share_cents: number;
  }[];
};

export type PublicTripSettlement = {
  id: string;
  from_member_id: string;
  to_member_id: string;
  amount_cents: number;
  status: TripSettlementStatus;
  confirmed_at: string | null;
};

export type PublicTripLedgerData = {
  trip: {
    id: string;
    title: string;
    destination: string | null;
    start_date: string;
    end_date: string;
    status: TripStatus;
    currency: string;
    public_token: string;
    cover_photo_url: string | null;
    has_passcode: boolean;
  };
  members: PublicTripMember[];
  expenses: PublicTripExpense[];
  settlements: PublicTripSettlement[];
};

export type TripMemberBalance = {
  memberId: string;
  name: string;
  totalPaidCents: number;
  totalOwedCents: number;
  netBalanceCents: number; // totalPaidCents - totalOwedCents
};

export type SuggestedSettlement = {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  toPixKey?: string | null;
  toPixKeyType?: TripPixKeyType | null;
  amountCents: number;
};
