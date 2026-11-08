import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useUserTrips,
  useTripDetails,
  useCreateTripMutation,
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
  deleteTripExpense: vi.fn(),
  fetchPublicTripLedger: vi.fn(),
  submitPublicExpense: vi.fn(),
  recordTripSettlements: vi.fn(),
  confirmTripSettlement: vi.fn(),
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
});
