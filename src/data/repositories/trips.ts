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
  createTripRpc,
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
  host_name?: string | null;
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
  joined_date?: string | null;
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

export interface UpdateTripExpenseInput {
  expense_id: string;
  paid_by_member_id?: string;
  amount_cents?: number;
  description?: string;
  category_name?: string;
  expense_date?: string;
  split_type?: TripSplitType;
  receipt_url?: string | null;
  splits?: {
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

  // Tentativa primária: RPC atômica transacional (Regra 5 AGENTS.md)
  try {
    return await createTripRpc({
      title: input.title.trim(),
      destination: input.destination ? input.destination.trim() : null,
      startDate: input.start_date,
      endDate: input.end_date,
      currency: input.currency ?? "BRL",
      coverPhotoUrl: input.cover_photo_url ?? null,
      initialMembers: input.initial_members,
      hostName: input.host_name ? input.host_name.trim() : null,
    });
  } catch (rpcErr) {
    // Se for erro de validação ou regra de negócio, propaga imediatamente
    if (rpcErr instanceof AppError && rpcErr.kind !== "unknown") {
      throw rpcErr;
    }

    // Se a RPC não existir ou houver falha de rede/transporte, tenta o fallback direto
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

    // Resolve o nome do anfitrião
    let hostName = input.host_name ? input.host_name.trim() : "";
    if (!hostName) {
      const { data: profile } = await resolveQuery<{ name?: string | null }>(
        supabase
          .from("profiles" as never)
          .select("name" as never)
          .eq("id", uid)
          .maybeSingle() as never
      );
      hostName = profile?.name?.trim() || "Organizador";
    }

    // Cadastra o host como primeiro membro
    await supabase.from("trip_members" as never).insert({
      trip_id: tripRow.id,
      name: hostName,
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
        joined_date: input.joined_date ?? null,
      } as never)
      .select()
      .single() as never
  );

  if (error || !data) handleDbError(error, "Erro ao adicionar participante");
  return data;
}

export async function rebalanceTripMembers(tripId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await resolveQuery(
    supabase
      .from("trip_members" as never)
      .update({ joined_date: null } as never)
      .eq("trip_id", tripId) as never
  );
  if (error) handleDbError(error, "Erro ao equilibrar despesas da viagem");
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

export async function updateTripExpense(
  input: UpdateTripExpenseInput
): Promise<TripExpense> {
  const supabase = getSupabase();

  const updatePayload: Record<string, unknown> = {};
  if (input.paid_by_member_id !== undefined) updatePayload.paid_by_member_id = input.paid_by_member_id;
  if (input.amount_cents !== undefined) updatePayload.amount_cents = input.amount_cents;
  if (input.description !== undefined) updatePayload.description = input.description.trim();
  if (input.category_name !== undefined) updatePayload.category_name = input.category_name;
  if (input.expense_date !== undefined) updatePayload.expense_date = input.expense_date;
  if (input.split_type !== undefined) updatePayload.split_type = input.split_type;
  if (input.receipt_url !== undefined) updatePayload.receipt_url = input.receipt_url;

  const { data: expenseRow, error: expenseError } = await resolveQuery<TripExpense>(
    supabase
      .from("trip_expenses" as never)
      .update(updatePayload as never)
      .eq("id", input.expense_id)
      .select()
      .single() as never
  );

  if (expenseError || !expenseRow) {
    handleDbError(expenseError, "Erro ao atualizar despesa da viagem");
  }

  // Se splits foram fornecidos, recria as cotas de forma atômica
  if (input.splits) {
    const { error: deleteSplitsError } = await resolveQuery(
      supabase
        .from("trip_expense_splits" as never)
        .delete()
        .eq("expense_id", input.expense_id) as never
    );

    if (deleteSplitsError) {
      handleDbError(deleteSplitsError, "Erro ao atualizar divisão de cotas da despesa");
    }

    if (input.splits.length > 0) {
      const splitsToInsert = input.splits.map((s) => ({
        expense_id: input.expense_id,
        member_id: s.member_id,
        share_cents: s.share_cents,
      }));

      const { error: insertSplitsError } = await resolveQuery(
        supabase
          .from("trip_expense_splits" as never)
          .insert(splitsToInsert as never) as never
      );

      if (insertSplitsError) {
        handleDbError(insertSplitsError, "Erro ao registrar novas cotas da despesa");
      }
    }
  }

  return expenseRow;
}

export async function deleteTripExpense(expenseId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: tripExp } = await resolveQuery<{ linked_personal_expense_id?: string | null }>(
    supabase
      .from("trip_expenses" as never)
      .select("linked_personal_expense_id" as never)
      .eq("id", expenseId)
      .maybeSingle() as never
  );
  const linkedPersonalId = tripExp?.linked_personal_expense_id;

  const { error } = await resolveQuery(
    supabase
      .from("trip_expenses" as never)
      .delete()
      .eq("id", expenseId) as never
  );
  if (error) handleDbError(error, "Erro ao excluir despesa da viagem");

  if (linkedPersonalId) {
    try {
      await supabase
        .from("expenses")
        .update({ trip_id: null, report_weight: 1.0 })
        .eq("id", linkedPersonalId);
    } catch {
      // Ignora falha não-crítica de restauração no extrato pessoal
    }
  }
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
