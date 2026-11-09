import { callRpc, unwrapRpc } from "./client";
import { todayISO } from "@/lib/date";
import type {
  Trip,
  ClaimTripMemberResult,
  UnlinkTripMemberResult,
  DeleteTripExpenseSyncResult,
} from "@/types/trips";

/**
 * Retorna os dados públicos sanitizados do ledger da viagem via RPC get_public_trip_ledger.
 */
export async function getPublicTripLedger(
  token: string,
  passcode?: string,
): Promise<unknown> {
  return unwrapRpc(
    callRpc("get_public_trip_ledger" as never, {
      p_token: token,
      p_passcode: passcode ?? null,
    } as never),
    true,
  );
}

/**
 * Adiciona uma despesa via link público da viagem via RPC add_public_trip_expense.
 */
export async function addPublicTripExpense(input: {
  token: string;
  paidByMemberId: string;
  amountCents: number;
  description: string;
  categoryName?: string;
  expenseDate?: string;
  splitType?: string;
  splits: readonly { member_id: string; share_cents: number }[];
  receiptUrl?: string | null;
  createdByMemberId?: string | null;
  passcode?: string | null;
}): Promise<{ success: boolean; expense_id: string }> {
  return unwrapRpc(
    callRpc("add_public_trip_expense" as never, {
      p_token: input.token,
      p_paid_by_member_id: input.paidByMemberId,
      p_amount_cents: input.amountCents,
      p_description: input.description,
      p_category_name: input.categoryName ?? "Geral",
      p_expense_date: input.expenseDate ?? todayISO(),
      p_split_type: input.splitType ?? "equal",
      p_splits: input.splits,
      p_receipt_url: input.receiptUrl ?? null,
      p_created_by_member_id: input.createdByMemberId ?? null,
      p_passcode: input.passcode ?? null,
    } as never),
  );
}

/**
 * Grava a liquidação líquida da viagem via RPC record_trip_settlements.
 */
export async function recordTripSettlementsRpc(
  tripId: string,
  settlements: readonly { from_member_id: string; to_member_id: string; amount_cents: number }[],
): Promise<{ success: boolean }> {
  return unwrapRpc(
    callRpc("record_trip_settlements" as never, {
      p_trip_id: tripId,
      p_settlements: settlements,
    } as never),
  );
}

/**
 * Cria uma viagem e cadastra o host e participantes de forma atômica via RPC create_trip.
 */
export async function createTripRpc(input: {
  title: string;
  destination?: string | null;
  startDate: string;
  endDate: string;
  currency?: string;
  coverPhotoUrl?: string | null;
  initialMembers?: readonly {
    name: string;
    pix_key?: string | null;
    pix_key_type?: string | null;
  }[];
  hostName?: string | null;
}): Promise<Trip> {
  return unwrapRpc(
    callRpc("create_trip" as never, {
      p_title: input.title,
      p_destination: input.destination ?? null,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_currency: input.currency ?? "BRL",
      p_cover_photo_url: input.coverPhotoUrl ?? null,
      p_initial_members: input.initialMembers ?? [],
      p_host_name: input.hostName ?? null,
    } as never),
  );
}

/**
 * Reivindica e vincula a conta do usuário logado a um participante de viagem via RPC claim_trip_member.
 */
export async function claimTripMemberRpc(params: {
  tripToken: string;
  memberId: string;
  passcode?: string | null;
}): Promise<ClaimTripMemberResult> {
  return unwrapRpc(
    callRpc("claim_trip_member" as never, {
      p_trip_token: params.tripToken,
      p_member_id: params.memberId,
      p_passcode: params.passcode ?? null,
    } as never),
  );
}

/**
 * Desvincula a conta de um participante da viagem via RPC unlink_trip_member.
 */
export async function unlinkTripMemberRpc(params: {
  tripId: string;
  memberId: string;
}): Promise<UnlinkTripMemberResult> {
  return unwrapRpc(
    callRpc("unlink_trip_member" as never, {
      p_trip_id: params.tripId,
      p_member_id: params.memberId,
    } as never),
  );
}

/**
 * Exclui de forma sincronizada uma despesa de viagem e, opcionalmente, sua despesa pessoal vinculada via RPC delete_trip_expense_sync.
 */
export async function deleteTripExpenseSyncRpc(params: {
  expenseId: string;
  deletePersonal?: boolean;
}): Promise<DeleteTripExpenseSyncResult> {
  return unwrapRpc(
    callRpc("delete_trip_expense_sync" as never, {
      p_expense_id: params.expenseId,
      p_delete_personal: params.deletePersonal ?? false,
    } as never),
  );
}
