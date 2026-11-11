/**
 * Tipos canônicos do Modo Viagem (Axir).
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
  joined_date?: string | null;
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
  joined_date?: string | null;
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
  netBalanceCents: number; // (totalPaidCents + settlementsPaidCents) - (totalOwedCents + settlementsReceivedCents)
  settlementsPaidCents?: number;
  settlementsReceivedCents?: number;
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

// ---------------------------------------------------------------------------
// Tipos para Cálculo de Balanços e Liquidação (trip-math)
// ---------------------------------------------------------------------------

/**
 * Item de liquidação/acerto (settlement) considerado no cálculo de balanços do grupo.
 * Compatível com TripSettlement e PublicTripSettlement.
 */
export interface SettlementItemForBalance {
  id?: string;
  from_member_id: string;
  to_member_id: string;
  amount_cents: number;
  status?: TripSettlementStatus | string | null;
}

export type TripSettlementForBalance = SettlementItemForBalance;

/**
 * Item de membro para cálculo de balanços.
 */
export interface MemberItemForBalance {
  id: string;
  name: string;
  pix_key?: string | null;
  pix_key_type?: TripPixKeyType | null;
  joined_date?: string | null;
}

/**
 * Item de despesa para cálculo de balanços.
 */
export interface ExpenseItemForBalance {
  id?: string;
  description?: string;
  category_name?: string;
  paid_by_member_id: string;
  amount_cents: number;
  expense_date?: string | null;
  split_type?: TripSplitType | string | null;
  splits?: readonly {
    member_id: string;
    share_cents: number;
  }[];
}

// ---------------------------------------------------------------------------
// Contratos RPCs: Vínculo Multi-Contas e Exclusão Sincronizada (Plano 16)
// ---------------------------------------------------------------------------

/**
 * Parâmetros brutos da RPC claim_trip_member.
 */
export interface ClaimTripMemberRpcArgs {
  p_trip_token: string;
  p_member_id: string;
  p_passcode?: string | null;
}

/**
 * Parâmetros de entrada para reivindicar/vincular conta a um participante de viagem.
 */
export interface ClaimTripMemberInput {
  tripToken: string;
  memberId: string;
  passcode?: string | null;
}

/**
 * Retorno da RPC claim_trip_member.
 */
export interface ClaimTripMemberResult {
  success: boolean;
  trip_id: string;
  member_id: string;
  user_id: string;
}

/**
 * Parâmetros brutos da RPC unlink_trip_member.
 */
export interface UnlinkTripMemberRpcArgs {
  p_trip_id: string;
  p_member_id: string;
}

/**
 * Parâmetros de entrada para desvincular conta de participante de viagem.
 */
export interface UnlinkTripMemberInput {
  tripId: string;
  memberId: string;
}

/**
 * Retorno da RPC unlink_trip_member.
 */
export interface UnlinkTripMemberResult {
  success: boolean;
  member_id: string;
}

/**
 * Parâmetros brutos da RPC delete_trip_expense_sync.
 */
export interface DeleteTripExpenseSyncRpcArgs {
  p_expense_id: string;
  p_delete_personal?: boolean;
}

/**
 * Parâmetros de entrada para exclusão sincronizada de despesa de viagem.
 */
export interface DeleteTripExpenseSyncInput {
  expenseId: string;
  deletePersonal?: boolean;
}

/**
 * Retorno da RPC delete_trip_expense_sync.
 */
export interface DeleteTripExpenseSyncResult {
  success: boolean;
  deleted_trip_expense_id: string;
  deleted_personal_expense: boolean;
}

