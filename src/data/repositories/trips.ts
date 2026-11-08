/**
 * Repositório de Modo Viagem (trips.ts).
 *
 * Gerencia a persistência de viagens, participantes, despesas, divisões de cotas,
 * liquidações mútuas e leitura sanitizada para acesso público.
 */

import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { currentUserId } from "@/data/session";
import { AppError, classifyError } from "@/services/errors";
import {
  getPublicTripLedger,
  addPublicTripExpense as addPublicTripExpenseRpc,
  recordTripSettlementsRpc,
} from "@/data/rpc";
import type {
  Trip,
  TripMember,
  TripExpense,
  TripExpenseSplit,
  TripSettlement,
  TripSplitType,
  TripPixKeyType,
  PublicTripLedgerData,
} from "@/types/trips";

export interface CreateTripInput {
  title: string;
  destination?: string | null;
  start_date: string;
  end_date: string;
  currency?: string;
  cover_photo_url?: string | null;
  initial_members?: {
    name: string;
    pix_key?: string | null;
    pix_key_type?: TripPixKeyType | null;
  }[];
}

export interface AddTripMemberInput {
  trip_id: string;
  name: string;
  pix_key?: string | null;
  pix_key_type?: TripPixKeyType | null;
  is_host?: boolean;
  user_id?: string | null;
}

export interface AddTripExpenseInput {
  trip_id: string;
  paid_by_member_id: string;
  amount_cents: number;
  description: string;
  category_name?: string;
  expense_date?: string;
  split_type?: TripSplitType;
  receipt_url?: string | null;
  linked_personal_expense_id?: string | null;
  splits: {
    member_id: string;
    share_cents: number;
  }[];
}

function handleDbError(error: unknown, fallbackMessage: string): never {
  const classified = classifyError(error);
  throw new AppError(classified.kind, classified.message || fallbackMessage, error);
}

export async function getUserTrips(): Promise<Trip[]> {
  try {
    const uid = await currentUserId();
    if (!uid) return [];
  } catch {
    return [];
  }

  const supabase = getSupabase();
  const { data, error } = await resolveQuery<Trip[]>(
    supabase
      .from("trips" as never)
      .select("*")
      .order("created_at", { ascending: false }) as never
  );

  if (error) handleDbError(error, "Erro ao carregar viagens");
  return data ?? [];
}

export async function getTripById(tripId: string): Promise<Trip | null> {
  if (!tripId) return null;
  const supabase = getSupabase();

  const { data, error } = await resolveQuery<Trip | null>(
    supabase
      .from("trips" as never)
      .select("*")
      .eq("id", tripId)
      .maybeSingle() as never
  );

  if (error) handleDbError(error, "Erro ao buscar detalhes da viagem");
  return data;
}

export async function getTripMembers(tripId: string): Promise<TripMember[]> {
  if (!tripId) return [];
  const supabase = getSupabase();

  const { data, error } = await resolveQuery<TripMember[]>(
    supabase
      .from("trip_members" as never)
      .select("*")
      .eq("trip_id", tripId)
      .order("is_host", { ascending: false })
      .order("name", { ascending: true }) as never
  );

  if (error) handleDbError(error, "Erro ao buscar membros da viagem");
  return data ?? [];
}

export async function getTripExpenses(tripId: string): Promise<TripExpense[]> {
  if (!tripId) return [];
  const supabase = getSupabase();

  const { data, error } = await resolveQuery<(TripExpense & { splits: TripExpenseSplit[] })[]>(
    supabase
      .from("trip_expenses" as never)
      .select("*, splits:trip_expense_splits(*)")
      .eq("trip_id", tripId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }) as never
  );

  if (error) handleDbError(error, "Erro ao buscar despesas da viagem");
  return data ?? [];
}

export async function getTripSettlements(tripId: string): Promise<TripSettlement[]> {
  if (!tripId) return [];
  const supabase = getSupabase();

  const { data, error } = await resolveQuery<TripSettlement[]>(
    supabase
      .from("trip_settlements" as never)
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }) as never
  );

  if (error) handleDbError(error, "Erro ao buscar acertos da viagem");
  return data ?? [];
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Usuário não autenticado");

  const supabase = getSupabase();
  const token =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `trip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const { data: tripRow, error: tripError } = await resolveQuery<Trip>(
    supabase
      .from("trips" as never)
      .insert({
        host_user_id: uid,
        title: input.title.trim(),
        destination: input.destination ? input.destination.trim() : null,
        start_date: input.start_date,
        end_date: input.end_date,
        currency: input.currency ?? "BRL",
        cover_photo_url: input.cover_photo_url ?? null,
        public_token: token,
      } as never)
      .select()
      .single() as never
  );

  if (tripError || !tripRow) handleDbError(tripError, "Erro ao criar viagem");

  // Cadastra o host como primeiro membro
  await supabase.from("trip_members" as never).insert({
    trip_id: tripRow.id,
    name: "Você",
    user_id: uid,
    is_host: true,
  } as never);

  // Cadastra membros iniciais, se informados
  if (input.initial_members && input.initial_members.length > 0) {
    const memberInserts = input.initial_members.map((m) => ({
      trip_id: tripRow.id,
      name: m.name.trim(),
      pix_key: m.pix_key ? m.pix_key.trim() : null,
      pix_key_type: m.pix_key_type ?? null,
      is_host: false,
    }));

    await supabase.from("trip_members" as never).insert(memberInserts as never);
  }

  return tripRow;
}

export async function updateTrip(
  tripId: string,
  input: Partial<Pick<Trip, "title" | "destination" | "start_date" | "end_date" | "status" | "cover_photo_url">>
): Promise<Trip> {
  const supabase = getSupabase();
  const { data, error } = await resolveQuery<Trip>(
    supabase
      .from("trips" as never)
      .update(input as never)
      .eq("id", tripId)
      .select()
      .single() as never
  );

  if (error || !data) handleDbError(error, "Erro ao atualizar viagem");
  return data;
}

export async function deleteTrip(tripId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await resolveQuery(
    supabase.from("trips" as never).delete().eq("id", tripId) as never
  );
  if (error) handleDbError(error, "Erro ao excluir viagem");
}

export async function addTripMember(
  input: AddTripMemberInput
): Promise<TripMember> {
  const supabase = getSupabase();
  const { data, error } = await resolveQuery<TripMember>(
    supabase
      .from("trip_members" as never)
      .insert({
        trip_id: input.trip_id,
        name: input.name.trim(),
        pix_key: input.pix_key ? input.pix_key.trim() : null,
        pix_key_type: input.pix_key_type ?? null,
        is_host: input.is_host ?? false,
        user_id: input.user_id ?? null,
      } as never)
      .select()
      .single() as never
  );

  if (error || !data) handleDbError(error, "Erro ao adicionar participante");
  return data;
}

export async function removeTripMember(memberId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await resolveQuery(
    supabase
      .from("trip_members" as never)
      .delete()
      .eq("id", memberId) as never
  );
  if (error) handleDbError(error, "Erro ao remover participante");
}

export async function addTripExpense(
  input: AddTripExpenseInput
): Promise<TripExpense> {
  const supabase = getSupabase();

  const { data: expenseRow, error: expenseError } = await resolveQuery<TripExpense>(
    supabase
      .from("trip_expenses" as never)
      .insert({
        trip_id: input.trip_id,
        paid_by_member_id: input.paid_by_member_id,
        amount_cents: input.amount_cents,
        description: input.description.trim(),
        category_name: input.category_name ?? "Geral",
        expense_date: input.expense_date ?? new Date().toISOString().split("T")[0],
        split_type: input.split_type ?? "equal",
        receipt_url: input.receipt_url ?? null,
        linked_personal_expense_id: input.linked_personal_expense_id ?? null,
      } as never)
      .select()
      .single() as never
  );

  if (expenseError || !expenseRow) {
    handleDbError(expenseError, "Erro ao registrar despesa da viagem");
  }

  if (input.splits.length > 0) {
    const splitsToInsert = input.splits.map((s) => ({
      expense_id: expenseRow.id,
      member_id: s.member_id,
      share_cents: s.share_cents,
    }));

    const { error: splitError } = await resolveQuery(
      supabase
        .from("trip_expense_splits" as never)
        .insert(splitsToInsert as never) as never
    );

    if (splitError) {
      handleDbError(splitError, "Erro ao registrar divisão de cotas da despesa");
    }
  }

  return expenseRow;
}

export async function deleteTripExpense(expenseId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await resolveQuery(
    supabase
      .from("trip_expenses" as never)
      .delete()
      .eq("id", expenseId) as never
  );
  if (error) handleDbError(error, "Erro ao excluir despesa da viagem");
}

export async function fetchPublicTripLedger(
  token: string,
  passcode?: string
): Promise<PublicTripLedgerData | null> {
  const data = await getPublicTripLedger(token, passcode);
  if (!data) return null;
  return data as PublicTripLedgerData;
}

export async function submitPublicExpense(input: {
  token: string;
  paidByMemberId: string;
  amountCents: number;
  description: string;
  categoryName?: string;
  expenseDate?: string;
  splitType?: TripSplitType;
  splits: { member_id: string; share_cents: number }[];
  receiptUrl?: string | null;
  createdByMemberId?: string | null;
}): Promise<{ success: boolean; expense_id: string }> {
  return addPublicTripExpenseRpc(input);
}

export async function recordTripSettlements(
  tripId: string,
  settlements: { from_member_id: string; to_member_id: string; amount_cents: number }[]
): Promise<{ success: boolean }> {
  return recordTripSettlementsRpc(tripId, settlements);
}

export async function confirmTripSettlement(settlementId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await resolveQuery(
    supabase
      .from("trip_settlements" as never)
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      } as never)
      .eq("id", settlementId) as never
  );
  if (error) handleDbError(error, "Erro ao confirmar liquidação");
}
