/**
 * Hooks TanStack Query e Mutações para Modo Viagem (use-trips.ts).
 *
 * Gerencia o estado de:
 * - Viagens do usuário autenticado (useUserTrips);
 * - Detalhes completos da viagem, membros, despesas, saldos e liquidação (useTripDetails);
 * - Leitura e lançamento em página pública sem login (usePublicTrip, useSubmitPublicTripExpenseMutation);
 * - Mutações com invalidação cirúrgica de cache e feedback sensorial.
 */

import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserTrips,
  getTripById,
  getTripMembers,
  getTripExpenses,
  getTripSettlements,
  createTrip,
  updateTrip,
  deleteTrip,
  addTripMember,
  removeTripMember,
  addTripExpense,
  updateTripExpense,
  deleteTripExpenseSync,
  fetchPublicTripLedger,
  submitPublicExpense,
  recordTripSettlements,
  confirmTripSettlement,
  rebalanceTripMembers,
  claimTripMember,
  type CreateTripInput,
  type AddTripMemberInput,
  type AddTripExpenseInput,
  type UpdateTripExpenseInput,
} from "@/data/repositories/trips";
import {
  calculateMemberBalances,
  calculateSimplifiedSettlements,
  calculateEqualSplits,
} from "@/domain/trips/trip-math";
import { cardExpensesKey } from "@/state/queries/use-card-payments";
import { STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedTrips, useSimulatedTripDetails } from "./use-simulated-queries";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";
import type {
  Trip,
  TripMember,
  TripExpense,
  TripSettlement,
  PublicTripLedgerData,
  TripMemberBalance,
  SuggestedSettlement,
} from "@/types/trips";

export const TRIP_QUERY_KEYS = {
  all: ["trips"] as const,
  lists: () => [...TRIP_QUERY_KEYS.all, "list"] as const,
  details: () => [...TRIP_QUERY_KEYS.all, "detail"] as const,
  detail: (id: string) => [...TRIP_QUERY_KEYS.details(), id] as const,
  public: (token: string) => [...TRIP_QUERY_KEYS.all, "public", token] as const,
};

const fallbackQueryClient = new QueryClient({
  defaultOptions: {
    queries: { enabled: false, retry: false },
    mutations: { retry: false },
  },
});

function useSafeQueryClient(): QueryClient {
  try {
    return useQueryClient();
  } catch {
    return fallbackQueryClient;
  }
}

export function useUserTrips() {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedTrips();
  const queryClient = useSafeQueryClient();
  const real = useQuery<Trip[]>({
    queryKey: TRIP_QUERY_KEYS.lists(),
    queryFn: () => getUserTrips(),
    enabled: !isDemoActive,
    staleTime: STALE_TIMES.transactional,
  }, queryClient);
  return isDemoActive ? simulated : real;
}

export interface TripAggregatedDetails {
  trip: Trip;
  members: TripMember[];
  expenses: TripExpense[];
  settlements: TripSettlement[];
  balances: readonly TripMemberBalance[];
  suggestedSettlements: readonly SuggestedSettlement[];
  totalExpensesCents: number;
}

export function useTripDetails(tripId: string | null | undefined) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedTripDetails(tripId);
  const queryClient = useSafeQueryClient();
  const real = useQuery<TripAggregatedDetails | null>({
    queryKey: TRIP_QUERY_KEYS.detail(tripId ?? ""),
    queryFn: async () => {
      if (!tripId) return null;

      const [trip, members, expenses, settlements] = await Promise.all([
        getTripById(tripId),
        getTripMembers(tripId),
        getTripExpenses(tripId),
        getTripSettlements(tripId),
      ]);

      if (!trip) return null;

      const balances = calculateMemberBalances(
        members.map((m) => ({
          id: m.id,
          name: m.name,
          pix_key: m.pix_key,
          pix_key_type: m.pix_key_type,
          joined_date: m.joined_date,
        })),
        expenses.map((e) => ({
          id: e.id,
          description: e.description,
          category_name: e.category_name,
          paid_by_member_id: e.paid_by_member_id,
          amount_cents: e.amount_cents,
          expense_date: e.expense_date,
          split_type: e.split_type,
          splits: (e.splits ?? []).map((s) => ({
            member_id: s.member_id,
            share_cents: s.share_cents,
          })),
        }))
      );

      const suggestedSettlements = calculateSimplifiedSettlements(
        balances,
        members.map((m) => ({
          id: m.id,
          name: m.name,
          pix_key: m.pix_key,
          pix_key_type: m.pix_key_type,
        }))
      );

      const totalExpensesCents = expenses.reduce((acc, e) => acc + e.amount_cents, 0);

      return {
        trip,
        members,
        expenses,
        settlements,
        balances,
        suggestedSettlements,
        totalExpensesCents,
      };
    },
    enabled: Boolean(tripId) && !isDemoActive,
    staleTime: STALE_TIMES.transactional,
  }, queryClient);

  return isDemoActive ? simulated : real;
}

export function usePublicTrip(token: string | null | undefined, passcode?: string) {
  const queryClient = useSafeQueryClient();
  return useQuery<
    | (PublicTripLedgerData & {
        balances: readonly TripMemberBalance[];
        suggestedSettlements: readonly SuggestedSettlement[];
        totalExpensesCents: number;
      })
    | null
  >({
    queryKey: TRIP_QUERY_KEYS.public(token ?? ""),
    queryFn: async () => {
      if (!token) return null;
      const data = await fetchPublicTripLedger(token, passcode);
      if (!data) return null;

      const balances = calculateMemberBalances(
        data.members.map((m) => ({
          id: m.id,
          name: m.name,
          pix_key: m.pix_key,
          pix_key_type: m.pix_key_type,
          joined_date: m.joined_date,
        })),
        data.expenses.map((e) => ({
          id: e.id,
          description: e.description,
          category_name: e.category_name,
          paid_by_member_id: e.paid_by_member_id,
          amount_cents: e.amount_cents,
          expense_date: e.expense_date,
          split_type: e.split_type,
          splits: e.splits.map((s) => ({
            member_id: s.member_id,
            share_cents: s.share_cents,
          })),
        }))
      );

      const suggestedSettlements = calculateSimplifiedSettlements(
        balances,
        data.members.map((m) => ({
          id: m.id,
          name: m.name,
          pix_key: m.pix_key,
          pix_key_type: m.pix_key_type,
        }))
      );

      const totalExpensesCents = data.expenses.reduce((acc, e) => acc + e.amount_cents, 0);

      return {
        ...data,
        balances,
        suggestedSettlements,
        totalExpensesCents,
      };
    },
    enabled: Boolean(token),
    staleTime: STALE_TIMES.transactional,
  }, queryClient);
}

export function useCreateTripMutation() {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: (trip) => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.lists() });
      triggerSensory("success");
      pushToast({
        title: "Viagem criada com sucesso",
        description: `O grupo "${trip.title}" já está pronto para receber despesas.`,
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao criar viagem",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useUpdateTripMutation() {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: ({
      tripId,
      input,
    }: {
      tripId: string;
      input: Parameters<typeof updateTrip>[1];
    }) => updateTrip(tripId, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(updated.id) });
      triggerSensory("selection");
      pushToast({
        title: "Viagem atualizada",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao atualizar viagem",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useDeleteTripMutation() {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: (tripId: string) => deleteTrip(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.lists() });
      triggerSensory("selection");
      pushToast({
        title: "Viagem excluída",
        description: "A viagem e suas despesas vinculadas foram removidas.",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao excluir viagem",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useAddTripMemberMutation() {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: (input: AddTripMemberInput) => addTripMember(input),
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(member.trip_id) });
      triggerSensory("selection");
      pushToast({
        title: "Participante adicionado",
        description: `${member.name} agora faz parte da viagem.`,
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao adicionar participante",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useRemoveTripMemberMutation(tripId: string) {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => removeTripMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(tripId) });
      triggerSensory("selection");
      pushToast({
        title: "Participante removido",
        description: "O participante foi desvinculado da viagem.",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao remover participante",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useAddTripExpenseMutation() {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: (input: AddTripExpenseInput) => addTripExpense(input),
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(expense.trip_id) });
      // Invalida despesas pessoais também caso haja vínculo
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      triggerSensory("success");
      pushToast({
        title: "Despesa registrada",
        description: `"${expense.description}" foi adicionada à viagem.`,
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao adicionar despesa",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export type DeleteTripExpenseMutationParams =
  | string
  | {
      expenseId: string;
      deletePersonal?: boolean;
    };

export function useDeleteTripExpenseMutation(tripId: string) {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: async (params: DeleteTripExpenseMutationParams) => {
      const expenseId = typeof params === "string" ? params : params.expenseId;
      const deletePersonal = typeof params === "string" ? false : Boolean(params.deletePersonal);
      return deleteTripExpenseSync(expenseId, deletePersonal);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      triggerSensory("selection");
      pushToast({
        title: "Despesa removida",
        description: result?.deleted_personal_expense
          ? "A despesa foi excluída da viagem e do seu extrato pessoal."
          : "A despesa foi excluída da viagem.",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao remover despesa",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export const useDeleteTripExpenseSyncMutation = useDeleteTripExpenseMutation;

export interface DeleteTripExpenseLinkedParams {
  personalExpenseId: string;
  deletePersonal?: boolean;
}

export function useDeleteTripExpenseLinkedMutation(tripId: string) {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: async ({
      personalExpenseId,
      deletePersonal = true,
    }: DeleteTripExpenseLinkedParams) => {
      if (!tripId) return null;
      const tripExpenses = await getTripExpenses(tripId);
      const linked = tripExpenses.find((te) => te.linked_personal_expense_id === personalExpenseId);
      if (linked) {
        return deleteTripExpenseSync(linked.id, deletePersonal);
      }
      return null;
    },
    onSuccess: () => {
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(tripId) });
      }
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      triggerSensory("selection");
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao remover despesa da viagem",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export interface UpdateTripExpenseLinkedParams {
  personalExpenseId: string;
  value: number;
  description: string;
  date: string;
  categoryName?: string;
}

export function useUpdateTripExpenseLinkedMutation(tripId: string) {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: async ({
      personalExpenseId,
      value,
      description,
      date,
      categoryName,
    }: UpdateTripExpenseLinkedParams) => {
      if (!tripId) return null;
      const tripExpenses = await getTripExpenses(tripId);
      const linked = tripExpenses.find((te) => te.linked_personal_expense_id === personalExpenseId);
      if (!linked) return null;

      const newAmountCents = Math.round(value * 100);

      // Recalcula cotas da viagem mantendo os membros participantes
      let memberIds: string[];
      if (linked.splits && linked.splits.length > 0) {
        memberIds = linked.splits.map((s) => s.member_id);
      } else {
        const members = await getTripMembers(tripId);
        memberIds = members.map((m) => m.id);
      }

      if (memberIds.length === 0 && linked.paid_by_member_id) {
        memberIds = [linked.paid_by_member_id];
      }

      const calculatedSplits = calculateEqualSplits({
        totalAmountCents: newAmountCents,
        memberIds,
        payerMemberId: linked.paid_by_member_id,
      });

      const updated = await updateTripExpense({
        expense_id: linked.id,
        amount_cents: newAmountCents,
        description: description.trim(),
        expense_date: date,
        ...(categoryName ? { category_name: categoryName } : {}),
        split_type: linked.split_type,
        splits: calculatedSplits.map((s) => ({
          member_id: s.memberId,
          share_cents: s.shareCents,
        })),
      });

      return updated;
    },
    onSuccess: (updated) => {
      if (updated && tripId) {
        queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(tripId) });
        queryClient.invalidateQueries({ queryKey: ["trips"] });
        triggerSensory("success");
      }
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao sincronizar despesa na viagem",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useUpdateTripExpenseMutation(tripId: string) {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTripExpenseInput) => updateTripExpense(input),
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: cardExpensesKey });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      triggerSensory("success");
      pushToast({
        title: "Despesa atualizada",
        description: `"${expense.description}" foi alterada com sucesso.`,
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao atualizar despesa",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useRecordTripSettlementsMutation(tripId: string) {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: (settlements: { from_member_id: string; to_member_id: string; amount_cents: number }[]) =>
      recordTripSettlements(tripId, settlements),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.lists() });
      triggerSensory("success");
      pushToast({
        title: "Contas fechadas com sucesso",
        description: "As transferências de acerto foram calculadas e registradas.",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao fechar contas",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useConfirmTripSettlementMutation(tripId: string) {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: (settlementId: string) => confirmTripSettlement(settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(tripId) });
      triggerSensory("success");
      pushToast({
        title: "Pagamento confirmado",
        description: "A transferência foi registrada como liquidada.",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao confirmar pagamento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useSubmitPublicTripExpenseMutation(token: string) {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof submitPublicExpense>[0]) =>
      submitPublicExpense(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.public(token) });
      triggerSensory("success");
      pushToast({
        title: "Despesa adicionada à viagem",
        description: "Seu gasto foi registrado e compartilhado com o grupo.",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao adicionar despesa",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useRebalanceTripMutation(tripId: string) {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: () => rebalanceTripMembers(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.lists() });
      triggerSensory("success");
      pushToast({
        title: "Despesas equilibradas com sucesso",
        description: "Todos os participantes agora dividem igualmente todos os custos gerais da viagem.",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao equilibrar despesas",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export function useClaimTripMemberMutation() {
  const queryClient = useSafeQueryClient();

  return useMutation({
    mutationFn: ({
      token,
      memberId,
      passcode,
    }: {
      token: string;
      memberId: string;
      passcode?: string | null;
    }) => claimTripMember(token, memberId, passcode),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.public(variables.token) });
      if (data?.trip_id) {
        queryClient.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(data.trip_id) });
      }
      queryClient.invalidateQueries({ queryKey: ["user-preferences"] });
      triggerSensory("success");
      pushToast({
        title: "Viagem vinculada com sucesso",
        description: "Esta viagem agora está sincronizada com a sua conta Áxis.",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao vincular viagem",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  }, queryClient);
}

export type {
  CreateTripInput,
  AddTripMemberInput,
  AddTripExpenseInput,
  UpdateTripExpenseInput,
};
