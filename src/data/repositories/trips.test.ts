import { describe, expect, it, vi, beforeEach } from "vitest";
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
  rebalanceTripMembers,
  deleteTripExpense,
  confirmTripSettlement,
  fetchPublicTripLedger,
  submitPublicExpense,
  recordTripSettlements,
  claimTripMember,
  unlinkTripMember,
  deleteTripExpenseSync,
} from "./trips";
import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { AppError } from "@/services/errors";
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
  claimTripMemberRpc: vi.fn(),
  unlinkTripMemberRpc: vi.fn(),
  deleteTripExpenseSyncRpc: vi.fn(),
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

    it("retorna lista vazia se currentUserId retornar null", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce(null as never);
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
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    });

    it("lança AppError via classifyError quando a consulta de viagens falha", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce("user-1");

      const dbError = { code: "42501", message: "Acesso negado: permissão insuficiente" };
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: dbError });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const promise = getUserTrips();
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("permission");
      expect((err as AppError).raw).toEqual(dbError);
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

    it("lança AppError via classifyError quando o banco retorna erro", async () => {
      const dbError = { code: "503", message: "Serviço temporariamente indisponível" };
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: dbError });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const promise = getTripById("trip-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("service-unavailable");
    });
  });

  describe("getTripMembers", () => {
    it("retorna array vazio se tripId for vazio", async () => {
      const result = await getTripMembers("");
      expect(result).toEqual([]);
    });

    it("retorna membros da viagem ordenados por is_host desc e name asc", async () => {
      const mockMembers = [
        { id: "m1", trip_id: "t1", name: "Alice", is_host: true },
        { id: "m2", trip_id: "t1", name: "Bruno", is_host: false },
      ];

      const mockOrder2 = vi.fn().mockResolvedValue({ data: mockMembers, error: null });
      const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const result = await getTripMembers("t1");
      expect(result).toEqual(mockMembers);
      expect(mockOrder1).toHaveBeenCalledWith("is_host", { ascending: false });
      expect(mockOrder2).toHaveBeenCalledWith("name", { ascending: true });
    });

    it("lança AppError via classifyError em caso de erro na consulta", async () => {
      const dbError = { code: "42501", message: "Acesso negado" };
      const mockOrder2 = vi.fn().mockResolvedValue({ data: null, error: dbError });
      const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const promise = getTripMembers("t1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("permission");
    });
  });

  describe("getTripExpenses", () => {
    it("retorna array vazio se tripId for vazio", async () => {
      const result = await getTripExpenses("");
      expect(result).toEqual([]);
    });

    it("retorna despesas com splits ordenadas por data desc", async () => {
      const mockExpenses = [
        { id: "e1", trip_id: "t1", description: "Jantar", splits: [] },
      ];

      const mockOrder2 = vi.fn().mockResolvedValue({ data: mockExpenses, error: null });
      const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const result = await getTripExpenses("t1");
      expect(result).toEqual(mockExpenses);
      expect(mockSelect).toHaveBeenCalledWith("*, splits:trip_expense_splits(*)");
    });

    it("lança AppError via classifyError se consulta falhar", async () => {
      const dbError = { message: "query canceled" };
      const mockOrder2 = vi.fn().mockResolvedValue({ data: null, error: dbError });
      const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const promise = getTripExpenses("t1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("getTripSettlements", () => {
    it("retorna array vazio se tripId for vazio", async () => {
      const result = await getTripSettlements("");
      expect(result).toEqual([]);
    });

    it("retorna acertos ordenados por created_at asc", async () => {
      const mockSettlements = [
        { id: "s1", trip_id: "t1", amount_cents: 5000 },
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockSettlements, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const result = await getTripSettlements("t1");
      expect(result).toEqual(mockSettlements);
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: true });
    });

    it("lança AppError se busca de acertos falhar", async () => {
      const dbError = { code: "500", message: "Database failure" };
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: dbError });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      await expect(getTripSettlements("t1")).rejects.toBeInstanceOf(AppError);
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

    it("re-lança AppError de validação sem acionar fallback se a RPC falhar com erro tipado", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce("user-1");
      const validationAppError = new AppError("validation", "Data de início deve ser anterior ao término.");
      vi.mocked(rpcModule.createTripRpc).mockRejectedValueOnce(validationAppError);

      await expect(
        createTrip({
          title: "Viagem Inválida",
          start_date: "2027-01-20",
          end_date: "2027-01-10",
        })
      ).rejects.toThrow(validationAppError);
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
        initial_members: [{ name: "Lucas", pix_key: "lucas@pix.com", pix_key_type: "email" }],
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
      expect(mockInsertMember).toHaveBeenCalledWith([
        expect.objectContaining({
          trip_id: "trip-new",
          name: "Lucas",
          pix_key: "lucas@pix.com",
          pix_key_type: "email",
          is_host: false,
        }),
      ]);
    });

    it("lança AppError via classifyError se o insert de fallback falhar", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce("user-1");
      vi.mocked(rpcModule.createTripRpc).mockRejectedValueOnce(new Error("RPC function not found"));

      const dbError = { code: "23505", message: "duplicate key value violates unique constraint" };
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: dbError });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsertTrip = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({ insert: mockInsertTrip }),
      } as never);

      const promise = createTrip({
        title: "Viagem Duplicada",
        start_date: "2027-01-10",
        end_date: "2027-01-15",
      });

      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("duplicate");
    });
  });

  describe("updateTrip", () => {
    it("atualiza os campos da viagem e retorna a linha atualizada", async () => {
      const updated = { id: "t1", title: "Novo Titulo" };
      const mockSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const result = await updateTrip("t1", { title: "Novo Titulo" });
      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalledWith({ title: "Novo Titulo" });
    });

    it("lança AppError via classifyError quando a atualização falha", async () => {
      const dbError = { code: "42501", message: "Acesso negado" };
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: dbError });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const promise = updateTrip("t1", { title: "Novo Titulo" });
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("permission");
    });
  });

  describe("deleteTrip", () => {
    it("executa exclusão da viagem com sucesso", async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      await expect(deleteTrip("t1")).resolves.toBeUndefined();
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "t1");
    });

    it("lança AppError via classifyError quando a exclusão é rejeitada", async () => {
      const dbError = { code: "23503", message: "violates foreign key constraint" };
      const mockEq = vi.fn().mockResolvedValue({ error: dbError });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const promise = deleteTrip("t1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("foreign-key");
    });
  });

  describe("addTripMember e removeTripMember", () => {
    it("adiciona participante e retorna o membro criado", async () => {
      const mockMember = { id: "m1", trip_id: "t1", name: "Carol" };
      const mockSingle = vi.fn().mockResolvedValue({ data: mockMember, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const result = await addTripMember({ trip_id: "t1", name: "Carol" });
      expect(result).toEqual(mockMember);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ trip_id: "t1", name: "Carol", is_host: false })
      );
    });

    it("lança AppError ao falhar ao adicionar participante", async () => {
      const dbError = { code: "42501", message: "Acesso negado" };
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: dbError });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      await expect(addTripMember({ trip_id: "t1", name: "Carol" })).rejects.toBeInstanceOf(AppError);
    });

    it("remove participante pelo ID com sucesso", async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      await expect(removeTripMember("m1")).resolves.toBeUndefined();
      expect(mockEq).toHaveBeenCalledWith("id", "m1");
    });

    it("lança AppError foreign-key ao tentar remover membro com despesas vinculadas", async () => {
      const dbError = { code: "23503", message: "violates foreign key" };
      const mockEq = vi.fn().mockResolvedValue({ error: dbError });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const promise = removeTripMember("m1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("foreign-key");
    });

    it("reequilibra membros da viagem limpando joined_date", async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      await expect(rebalanceTripMembers("t1")).resolves.toBeUndefined();
      expect(mockUpdate).toHaveBeenCalledWith({ joined_date: null });
      expect(mockEq).toHaveBeenCalledWith("trip_id", "t1");
    });
  });

  describe("deleteTripExpense", () => {
    it("exclui despesa e restaura report_weight no extrato pessoal quando vinculada", async () => {
      const mockExpUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "trip_expenses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { linked_personal_expense_id: "pers-1" },
                  error: null,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === "expenses") {
          return {
            update: mockExpUpdate,
          };
        }
        return {};
      });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      await expect(deleteTripExpense("exp-1")).resolves.toBeUndefined();
      expect(mockExpUpdate).toHaveBeenCalledWith({ trip_id: null, report_weight: 1.0 });
    });

    it("lança AppError via classifyError se a exclusão falhar", async () => {
      const dbError = { code: "42501", message: "Acesso negado" };
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: dbError }),
        }),
      });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      const promise = deleteTripExpense("exp-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("permission");
    });
  });

  describe("confirmTripSettlement", () => {
    it("atualiza status da liquidação para confirmed", async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      await expect(confirmTripSettlement("set-1")).resolves.toBeUndefined();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "confirmed" })
      );
      expect(mockEq).toHaveBeenCalledWith("id", "set-1");
    });

    it("lança AppError se a confirmação falhar", async () => {
      const dbError = { message: "database error" };
      const mockEq = vi.fn().mockResolvedValue({ error: dbError });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);

      await expect(confirmTripSettlement("set-1")).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("fetchPublicTripLedger", () => {
    it("delega para getPublicTripLedger RPC", async () => {
      const mockLedger = { trip: { id: "t1" }, members: [], expenses: [], settlements: [] };
      vi.mocked(rpcModule.getPublicTripLedger).mockResolvedValueOnce(mockLedger);

      const result = await fetchPublicTripLedger("token-123", "pass-456");
      expect(result).toEqual(mockLedger);
      expect(rpcModule.getPublicTripLedger).toHaveBeenCalledWith("token-123", "pass-456");
    });

    it("retorna null se o ledger retornado for nulo", async () => {
      vi.mocked(rpcModule.getPublicTripLedger).mockResolvedValueOnce(null);

      const result = await fetchPublicTripLedger("token-invalid");
      expect(result).toBeNull();
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

  describe("claimTripMember (Nova Operação Multi-Contas)", () => {
    it("delega para claimTripMemberRpc com sucesso passando token, memberId e passcode", async () => {
      const mockResult = {
        success: true,
        trip_id: "t1",
        member_id: "m1",
        user_id: "u1",
      };
      vi.mocked(rpcModule.claimTripMemberRpc).mockResolvedValueOnce(mockResult);

      const result = await claimTripMember("tok-1", "m1", "pass-123");
      expect(result).toEqual(mockResult);
      expect(rpcModule.claimTripMemberRpc).toHaveBeenCalledWith({
        tripToken: "tok-1",
        memberId: "m1",
        passcode: "pass-123",
      });
    });

    it("passa passcode undefined/null quando omitido", async () => {
      const mockResult = {
        success: true,
        trip_id: "t1",
        member_id: "m1",
        user_id: "u1",
      };
      vi.mocked(rpcModule.claimTripMemberRpc).mockResolvedValueOnce(mockResult);

      const result = await claimTripMember("tok-1", "m1");
      expect(result).toEqual(mockResult);
      expect(rpcModule.claimTripMemberRpc).toHaveBeenCalledWith({
        tripToken: "tok-1",
        memberId: "m1",
        passcode: undefined,
      });
    });

    it("trata erro de negócio e lança AppError preservando mensagem sanitizada", async () => {
      const rpcError = new Error("INVALID_PASSCODE: Código de acesso incorreto.");
      vi.mocked(rpcModule.claimTripMemberRpc).mockRejectedValueOnce(rpcError);

      const promise = claimTripMember("tok-1", "m1", "senha-errada");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).message).toContain("Código de acesso incorreto");
      expect((err as AppError).raw).toBe(rpcError);
    });

    it("classifica erro de permissão (42501) via classifyError", async () => {
      const rpcError = { code: "42501", message: "Acesso negado: você não tem permissão para esta viagem." };
      vi.mocked(rpcModule.claimTripMemberRpc).mockRejectedValueOnce(rpcError);

      const promise = claimTripMember("tok-1", "m1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("permission");
      expect((err as AppError).raw).toBe(rpcError);
    });

    it("classifica erro de rede (Failed to fetch) como kind 'network' via classifyError", async () => {
      const netError = new TypeError("Failed to fetch");
      vi.mocked(rpcModule.claimTripMemberRpc).mockRejectedValueOnce(netError);

      const promise = claimTripMember("tok-1", "m1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("network");
    });
  });

  describe("unlinkTripMember (Nova Operação Multi-Contas)", () => {
    it("delega para unlinkTripMemberRpc com sucesso", async () => {
      const mockResult = {
        success: true,
        member_id: "m1",
      };
      vi.mocked(rpcModule.unlinkTripMemberRpc).mockResolvedValueOnce(mockResult);

      const result = await unlinkTripMember("t1", "m1");
      expect(result).toEqual(mockResult);
      expect(rpcModule.unlinkTripMemberRpc).toHaveBeenCalledWith({
        tripId: "t1",
        memberId: "m1",
      });
    });

    it("trata erro de permissão (42501) e lança AppError de permission via classifyError", async () => {
      const rpcError = {
        code: "42501",
        message: "PERMISSION_DENIED: Apenas o anfitrião ou o próprio usuário podem desvincular a conta.",
      };
      vi.mocked(rpcModule.unlinkTripMemberRpc).mockRejectedValueOnce(rpcError);

      const promise = unlinkTripMember("t1", "m1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("permission");
      expect((err as AppError).raw).toBe(rpcError);
    });

    it("trata erro de integridade referencial (23503) e lança AppError foreign-key", async () => {
      const rpcError = {
        code: "23503",
        message: "violates foreign key constraint",
      };
      vi.mocked(rpcModule.unlinkTripMemberRpc).mockRejectedValueOnce(rpcError);

      const promise = unlinkTripMember("t1", "m1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("foreign-key");
    });

    it("trata erro de rede e lança AppError de rede", async () => {
      const netError = new TypeError("Failed to fetch");
      vi.mocked(rpcModule.unlinkTripMemberRpc).mockRejectedValueOnce(netError);

      const promise = unlinkTripMember("t1", "m1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("network");
    });
  });

  describe("deleteTripExpenseSync (Nova Operação de Sincronização)", () => {
    it("delega para deleteTripExpenseSyncRpc com deletePersonal default false", async () => {
      const mockResult = {
        success: true,
        deleted_trip_expense_id: "exp-1",
        deleted_personal_expense: false,
      };
      vi.mocked(rpcModule.deleteTripExpenseSyncRpc).mockResolvedValueOnce(mockResult);

      const result = await deleteTripExpenseSync("exp-1");
      expect(result).toEqual(mockResult);
      expect(rpcModule.deleteTripExpenseSyncRpc).toHaveBeenCalledWith({
        expenseId: "exp-1",
        deletePersonal: false,
      });
    });

    it("delega para deleteTripExpenseSyncRpc com deletePersonal true", async () => {
      const mockResult = {
        success: true,
        deleted_trip_expense_id: "exp-1",
        deleted_personal_expense: true,
      };
      vi.mocked(rpcModule.deleteTripExpenseSyncRpc).mockResolvedValueOnce(mockResult);

      const result = await deleteTripExpenseSync("exp-1", true);
      expect(result).toEqual(mockResult);
      expect(rpcModule.deleteTripExpenseSyncRpc).toHaveBeenCalledWith({
        expenseId: "exp-1",
        deletePersonal: true,
      });
    });

    it("trata erro de integridade referencial (23503) e lança AppError foreign-key", async () => {
      const dbError = {
        code: "23503",
        message: "update or delete on table violates foreign key constraint",
      };
      vi.mocked(rpcModule.deleteTripExpenseSyncRpc).mockRejectedValueOnce(dbError);

      const promise = deleteTripExpenseSync("exp-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("foreign-key");
      expect((err as AppError).raw).toBe(dbError);
    });

    it("trata erro de permissão (42501) e lança AppError de permission", async () => {
      const rpcError = {
        code: "42501",
        message: "PERMISSION_DENIED: Sem permissão para excluir esta despesa.",
      };
      vi.mocked(rpcModule.deleteTripExpenseSyncRpc).mockRejectedValueOnce(rpcError);

      const promise = deleteTripExpenseSync("exp-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("permission");
    });

    it("trata erro de sessão expirada (401) e lança AppError session-expired", async () => {
      const authError = {
        status: 401,
        message: "JWT expired",
      };
      vi.mocked(rpcModule.deleteTripExpenseSyncRpc).mockRejectedValueOnce(authError);

      const promise = deleteTripExpenseSync("exp-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      const err = await promise.catch((e: unknown) => e);
      expect((err as AppError).kind).toBe("session-expired");
    });
  });
});
