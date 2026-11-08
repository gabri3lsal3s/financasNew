import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getUserTrips,
  getTripById,
  createTrip,
  fetchPublicTripLedger,
  submitPublicExpense,
  recordTripSettlements,
} from "./trips";
import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import * as rpcModule from "@/data/rpc";

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(),
}));

vi.mock("@/data/session", () => ({
  currentUserId: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  getPublicTripLedger: vi.fn(),
  addPublicTripExpense: vi.fn(),
  recordTripSettlementsRpc: vi.fn(),
  createTripRpc: vi.fn(),
}));

describe("data/repositories/trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserTrips", () => {
    it("retorna lista vazia se não houver usuário autenticado", async () => {
      vi.mocked(currentUserId).mockRejectedValueOnce(new Error("expired"));
      const result = await getUserTrips();
      expect(result).toEqual([]);
    });

    it("retorna as viagens do usuário quando autenticado", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce("user-1");

      const mockTrips = [
        { id: "trip-1", title: "Carnaval", host_user_id: "user-1", status: "active" },
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockTrips, error: null });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as never);

      const result = await getUserTrips();
      expect(result).toEqual(mockTrips);
      expect(mockFrom).toHaveBeenCalledWith("trips");
    });
  });

  describe("getTripById", () => {
    it("retorna null se ID for vazio", async () => {
      const result = await getTripById("");
      expect(result).toBeNull();
    });

    it("retorna a viagem pelo ID", async () => {
      const mockTrip = { id: "trip-1", title: "Praia de Pipa" };
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockTrip, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const result = await getTripById("trip-1");
      expect(result).toEqual(mockTrip);
    });
  });

  describe("createTrip", () => {
    it("delega prioritariamente para createTripRpc", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce("user-1");
      const createdTrip = { id: "trip-rpc", title: "Viagem RPC" };
      vi.mocked(rpcModule.createTripRpc).mockResolvedValueOnce(createdTrip as never);

      const result = await createTrip({
        title: "Viagem RPC",
        start_date: "2027-01-10",
        end_date: "2027-01-15",
      });

      expect(result).toEqual(createdTrip);
      expect(rpcModule.createTripRpc).toHaveBeenCalledWith({
        title: "Viagem RPC",
        destination: null,
        startDate: "2027-01-10",
        endDate: "2027-01-15",
        currency: "BRL",
        coverPhotoUrl: null,
        initialMembers: undefined,
        hostName: null,
      });
    });

    it("utiliza fallback direto se a RPC falhar com erro genérico", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce("user-1");
      vi.mocked(rpcModule.createTripRpc).mockRejectedValueOnce(new Error("RPC not found"));

      const createdTrip = { id: "trip-new", title: "Mochilão" };
      const mockSingle = vi.fn().mockResolvedValue({ data: createdTrip, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsertTrip = vi.fn().mockReturnValue({ select: mockSelect });
      const mockInsertMember = vi.fn().mockResolvedValue({ data: null, error: null });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "trips") {
          return { insert: mockInsertTrip };
        }
        if (table === "trip_members") {
          return { insert: mockInsertMember };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Gabriel" }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const result = await createTrip({
        title: "Mochilão",
        start_date: "2027-01-10",
        end_date: "2027-01-15",
        host_name: "Gabriel",
      });

      expect(result).toEqual(createdTrip);
      expect(mockInsertTrip).toHaveBeenCalled();
      expect(mockInsertMember).toHaveBeenCalledWith(
        expect.objectContaining({
          trip_id: "trip-new",
          name: "Gabriel",
          is_host: true,
          user_id: "user-1",
        })
      );
    });
  });

  describe("fetchPublicTripLedger", () => {
    it("delega para getPublicTripLedger RPC", async () => {
      const mockLedger = { trip: { id: "t1" }, members: [], expenses: [], settlements: [] };
      vi.mocked(rpcModule.getPublicTripLedger).mockResolvedValueOnce(mockLedger);

      const result = await fetchPublicTripLedger("token-123");
      expect(result).toEqual(mockLedger);
      expect(rpcModule.getPublicTripLedger).toHaveBeenCalledWith("token-123", undefined);
    });
  });

  describe("submitPublicExpense", () => {
    it("delega para addPublicTripExpense RPC", async () => {
      vi.mocked(rpcModule.addPublicTripExpense).mockResolvedValueOnce({
        success: true,
        expense_id: "exp-1",
      });

      const result = await submitPublicExpense({
        token: "token-123",
        paidByMemberId: "m1",
        amountCents: 5000,
        description: "Gasolina",
        splits: [{ member_id: "m1", share_cents: 5000 }],
      });

      expect(result).toEqual({ success: true, expense_id: "exp-1" });
    });
  });

  describe("recordTripSettlements", () => {
    it("delega para recordTripSettlementsRpc", async () => {
      vi.mocked(rpcModule.recordTripSettlementsRpc).mockResolvedValueOnce({ success: true });

      const result = await recordTripSettlements("t1", [
        { from_member_id: "m2", to_member_id: "m1", amount_cents: 2000 },
      ]);

      expect(result).toEqual({ success: true });
      expect(rpcModule.recordTripSettlementsRpc).toHaveBeenCalledWith("t1", [
        { from_member_id: "m2", to_member_id: "m1", amount_cents: 2000 },
      ]);
    });
  });
});
