import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useUserTrips,
  useTripDetails,
  useCreateTripMutation,
  useClaimTripMemberMutation,
  useDeleteTripExpenseMutation,
  useDeleteTripExpenseLinkedMutation,
  useUpdateTripExpenseLinkedMutation,
} from "./use-trips";
import * as tripsRepo from "@/data/repositories/trips";
import * as sensoryService from "@/services/sensory";
import * as toastService from "@/services/toast";

vi.mock("@/data/repositories/trips", () => ({
  getUserTrips: vi.fn(),
  getTripById: vi.fn(),
  getTripMembers: vi.fn(),
  getTripExpenses: vi.fn(),
  getTripSettlements: vi.fn(),
  createTrip: vi.fn(),
  updateTrip: vi.fn(),
  deleteTrip: vi.fn(),
  addTripMember: vi.fn(),
  removeTripMember: vi.fn(),
  addTripExpense: vi.fn(),
  updateTripExpense: vi.fn(),
  deleteTripExpense: vi.fn(),
  deleteTripExpenseSync: vi.fn(),
  fetchPublicTripLedger: vi.fn(),
  submitPublicExpense: vi.fn(),
  recordTripSettlements: vi.fn(),
  confirmTripSettlement: vi.fn(),
  claimTripMember: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("state/queries/use-trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useUserTrips", () => {
    it("carrega a lista de viagens do usuário", async () => {
      const mockTrips = [
        { id: "trip-1", title: "Carnaval", status: "active" as const },
      ];
      vi.mocked(tripsRepo.getUserTrips).mockResolvedValueOnce(mockTrips as never);

      const { result } = renderHook(() => useUserTrips(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockTrips);
    });
  });

  describe("useTripDetails", () => {
    it("agrega dados de membros, despesas e calcula saldos e liquidação", async () => {
      const mockTrip = { id: "t1", title: "Pipa", status: "active" as const };
      const mockMembers = [
        { id: "m1", name: "Gabriel", is_host: true, trip_id: "t1", created_at: "", pix_key: "k1", pix_key_type: "email" as const, user_id: "u1" },
        { id: "m2", name: "Pedro", is_host: false, trip_id: "t1", created_at: "", pix_key: null, pix_key_type: null, user_id: null },
      ];
      const mockExpenses = [
        {
          id: "e1",
          trip_id: "t1",
          paid_by_member_id: "m1",
          amount_cents: 20000,
          description: "Almoço",
          category_name: "Alimentação",
          expense_date: "2027-01-10",
          split_type: "equal" as const,
          receipt_url: null,
          created_by_member_id: "m1",
          linked_personal_expense_id: null,
          created_at: "",
          updated_at: "",
          splits: [
            { id: "s1", expense_id: "e1", member_id: "m1", share_cents: 10000 },
            { id: "s2", expense_id: "e1", member_id: "m2", share_cents: 10000 },
          ],
        },
      ];
      const mockSettlements: unknown[] = [];

      vi.mocked(tripsRepo.getTripById).mockResolvedValueOnce(mockTrip as never);
      vi.mocked(tripsRepo.getTripMembers).mockResolvedValueOnce(mockMembers as never);
      vi.mocked(tripsRepo.getTripExpenses).mockResolvedValueOnce(mockExpenses as never);
      vi.mocked(tripsRepo.getTripSettlements).mockResolvedValueOnce(mockSettlements as never);

      const { result } = renderHook(() => useTripDetails("t1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const data = result.current.data;
      expect(data).not.toBeNull();
      expect(data?.totalExpensesCents).toBe(20000);
      expect(data?.balances).toHaveLength(2);

      // Pedro deve 100 e Gabriel recebe 100
      expect(data?.suggestedSettlements).toHaveLength(1);
      expect(data?.suggestedSettlements[0]).toEqual({
        fromMemberId: "m2",
        fromMemberName: "Pedro",
        toMemberId: "m1",
        toMemberName: "Gabriel",
        toPixKey: "k1",
        toPixKeyType: "email",
        amountCents: 10000,
      });
    });
  });

  describe("useCreateTripMutation", () => {
    it("dispara mutação com sucesso, feedback sensorial e toast", async () => {
      const created = { id: "trip-9", title: "Férias" };
      vi.mocked(tripsRepo.createTrip).mockResolvedValueOnce(created as never);

      const { result } = renderHook(() => useCreateTripMutation(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        title: "Férias",
        start_date: "2027-02-01",
        end_date: "2027-02-05",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Viagem criada com sucesso" })
      );
    });
  });

  describe("useClaimTripMemberMutation", () => {
    it("vincula conta ao participante com sucesso, aciona feedback sensorial e invalida queries", async () => {
      const claimResult = {
        success: true,
        trip_id: "trip-1",
        member_id: "m-2",
        user_id: "u-123",
      };
      vi.mocked(tripsRepo.claimTripMember).mockResolvedValueOnce(claimResult);

      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useClaimTripMemberMutation(), { wrapper });

      result.current.mutate({
        token: "tok-abc",
        memberId: "m-2",
        passcode: "1234",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(tripsRepo.claimTripMember).toHaveBeenCalledWith("tok-abc", "m-2", "1234");
      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Viagem vinculada com sucesso",
          description: "Esta viagem agora está sincronizada com a sua conta Axir.",
        })
      );
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["trips", "list"] }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["trips", "public", "tok-abc"] }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["trips", "detail", "trip-1"] }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["user-preferences"] }));
    });

    it("emite feedback sensorial e toast de erro quando a mutação falha", async () => {
      vi.mocked(tripsRepo.claimTripMember).mockRejectedValueOnce(
        new Error("ALREADY_CLAIMED: Este participante já está vinculado a outra conta.")
      );

      const { result } = renderHook(() => useClaimTripMemberMutation(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        token: "tok-abc",
        memberId: "m-2",
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("error");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao vincular viagem",
          variant: "destructive",
        })
      );
    });
  });

  describe("useDeleteTripExpenseMutation", () => {
    it("exclui apenas da viagem quando chamado com string simples de expenseId", async () => {
      const mockResult = {
        success: true,
        deleted_trip_expense_id: "exp-1",
        deleted_personal_expense: false,
      };
      vi.mocked(tripsRepo.deleteTripExpenseSync).mockResolvedValueOnce(mockResult);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useDeleteTripExpenseMutation("t1"), { wrapper });

      result.current.mutate("exp-1");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(tripsRepo.deleteTripExpenseSync).toHaveBeenCalledWith("exp-1", false);
      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("selection");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Despesa removida",
          description: "A despesa foi excluída da viagem.",
        })
      );
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["trips", "detail", "t1"] }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["expenses"] }));
    });

    it("exclui coordenadamente da viagem e do extrato pessoal com feedback correspondente", async () => {
      const mockResult = {
        success: true,
        deleted_trip_expense_id: "exp-1",
        deleted_personal_expense: true,
      };
      vi.mocked(tripsRepo.deleteTripExpenseSync).mockResolvedValueOnce(mockResult);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useDeleteTripExpenseMutation("t1"), { wrapper });

      result.current.mutate({
        expenseId: "exp-1",
        deletePersonal: true,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(tripsRepo.deleteTripExpenseSync).toHaveBeenCalledWith("exp-1", true);
      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("selection");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Despesa removida",
          description: "A despesa foi excluída da viagem e do seu extrato pessoal.",
        })
      );
    });

    it("emite feedback sensorial e toast de erro quando a exclusão falha", async () => {
      vi.mocked(tripsRepo.deleteTripExpenseSync).mockRejectedValueOnce(
        new Error("PERMISSION_DENIED: Sem permissão.")
      );

      const { result } = renderHook(() => useDeleteTripExpenseMutation("t1"), {
        wrapper: createWrapper(),
      });

      result.current.mutate("exp-1");

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("error");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao remover despesa",
          variant: "destructive",
        })
      );
    });
  });

  describe("useDeleteTripExpenseLinkedMutation (Exclusão Coordenada do Extrato)", () => {
    it("localiza o trip_expense pelo linked_personal_expense_id e exclui coordenadamente", async () => {
      vi.mocked(tripsRepo.getTripExpenses).mockResolvedValueOnce([
        {
          id: "trip-exp-99",
          trip_id: "t1",
          linked_personal_expense_id: "pers-1",
          amount_cents: 10000,
          description: "Jantar",
          category_name: "Alimentação",
          expense_date: "2026-08-01",
          split_type: "equal",
          paid_by_member_id: "m1",
          receipt_url: null,
          created_by_member_id: "m1",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ]);
      vi.mocked(tripsRepo.deleteTripExpenseSync).mockResolvedValueOnce({
        success: true,
        deleted_trip_expense_id: "trip-exp-99",
        deleted_personal_expense: true,
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useDeleteTripExpenseLinkedMutation("t1"), { wrapper });

      result.current.mutate({
        personalExpenseId: "pers-1",
        deletePersonal: true,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(tripsRepo.getTripExpenses).toHaveBeenCalledWith("t1");
      expect(tripsRepo.deleteTripExpenseSync).toHaveBeenCalledWith("trip-exp-99", true);
      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("selection");
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["trips", "detail", "t1"] }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["expenses"] }));
    });

    it("retorna null e não falha se a despesa vinculada não for encontrada na viagem", async () => {
      vi.mocked(tripsRepo.getTripExpenses).mockResolvedValueOnce([]);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useDeleteTripExpenseLinkedMutation("t1"), { wrapper });

      result.current.mutate({
        personalExpenseId: "pers-not-found",
        deletePersonal: true,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
      expect(tripsRepo.deleteTripExpenseSync).not.toHaveBeenCalled();
    });
  });

  describe("useUpdateTripExpenseLinkedMutation", () => {
    it("localiza a despesa de viagem pelo linked_personal_expense_id, recalcula os splits proporcionalmente e atualiza a despesa na viagem", async () => {
      vi.mocked(tripsRepo.getTripExpenses).mockResolvedValueOnce([
        {
          id: "trip-exp-1",
          trip_id: "t1",
          linked_personal_expense_id: "pers-100",
          amount_cents: 10000,
          description: "Jantar",
          category_name: "Alimentação",
          expense_date: "2026-08-01",
          split_type: "equal",
          paid_by_member_id: "m1",
          receipt_url: null,
          created_by_member_id: "m1",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
          splits: [
            { id: "s1", expense_id: "trip-exp-1", member_id: "m1", share_cents: 5000 },
            { id: "s2", expense_id: "trip-exp-1", member_id: "m2", share_cents: 5000 },
          ],
        },
      ]);
      vi.mocked(tripsRepo.updateTripExpense).mockResolvedValueOnce({
        id: "trip-exp-1",
        trip_id: "t1",
        linked_personal_expense_id: "pers-100",
        amount_cents: 15000,
        description: "Jantar na Praia",
        category_name: "Restaurante",
        expense_date: "2026-08-02",
        split_type: "equal",
        paid_by_member_id: "m1",
        receipt_url: null,
        created_by_member_id: "m1",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-02T00:00:00Z",
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useUpdateTripExpenseLinkedMutation("t1"), { wrapper });

      result.current.mutate({
        personalExpenseId: "pers-100",
        value: 150,
        description: "Jantar na Praia",
        date: "2026-08-02",
        categoryName: "Restaurante",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(tripsRepo.getTripExpenses).toHaveBeenCalledWith("t1");
      expect(tripsRepo.updateTripExpense).toHaveBeenCalledWith({
        expense_id: "trip-exp-1",
        amount_cents: 15000,
        description: "Jantar na Praia",
        expense_date: "2026-08-02",
        category_name: "Restaurante",
        split_type: "equal",
        splits: [
          { member_id: "m1", share_cents: 7500 },
          { member_id: "m2", share_cents: 7500 },
        ],
      });
      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["trips", "detail", "t1"] }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["trips"] }));
    });

    it("retorna null e não falha se a despesa vinculada não for encontrada na viagem", async () => {
      vi.mocked(tripsRepo.getTripExpenses).mockResolvedValueOnce([]);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useUpdateTripExpenseLinkedMutation("t1"), { wrapper });

      result.current.mutate({
        personalExpenseId: "pers-not-found",
        value: 150,
        description: "Não encontrada",
        date: "2026-08-02",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
      expect(tripsRepo.updateTripExpense).not.toHaveBeenCalled();
    });
  });
});
