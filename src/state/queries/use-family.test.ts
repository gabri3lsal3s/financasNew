import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useMyFamily,
  useFamilyConsolidation,
  useFamilyInvite,
  useFamilySettlements,
  useCreateFamily,
  useInviteFamilyMember,
  useAcceptFamilyInvite,
  useLeaveFamily,
  useRecordFamilySettlement,
  useUpdateFamily,
  useUpdateFamilyMember,
  useRevokeFamilyInvite,
  familyQueryKeys,
} from "./use-family";
import * as familiesRepo from "@/data/repositories/families";
import * as sensoryService from "@/services/sensory";
import * as toastService from "@/services/toast";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";

vi.mock("@/data/repositories/families", () => ({
  getMyFamily: vi.fn(),
  getFamilyConsolidation: vi.fn(),
  createFamily: vi.fn(),
  inviteFamilyMember: vi.fn(),
  acceptFamilyInvite: vi.fn(),
  leaveFamily: vi.fn(),
  recordFamilySettlement: vi.fn(),
  updateFamily: vi.fn(),
  updateFamilyMember: vi.fn(),
  revokeFamilyInvite: vi.fn(),
  getFamilyInviteByToken: vi.fn(),
  listFamilySettlements: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

const mockFamilyData: familiesRepo.MyFamilyData = {
  family: {
    id: "fam-1",
    name: "Família Carvalho",
    owner_id: "user-1",
    monthly_budget: 12000,
    split_rule: "equal",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  },
  members: [
    {
      id: "mem-1",
      family_id: "fam-1",
      user_id: "user-1",
      role: "owner",
      display_name: "Gabriel",
      pix_key: "gabriel@pix.me",
      pix_key_type: "email",
      split_ratio: 0.5,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
  ],
  currentMember: {
    id: "mem-1",
    family_id: "fam-1",
    user_id: "user-1",
    role: "owner",
    display_name: "Gabriel",
    pix_key: "gabriel@pix.me",
    pix_key_type: "email",
    split_ratio: 0.5,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  },
  invites: [],
};

describe("use-family Queries and Mutations", () => {
  let queryClient: QueryClient;

  function createWrapper() {
    return ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe("Queries", () => {
    it("useMyFamily carrega dados com staleTime estático e gcTime longo", async () => {
      vi.mocked(familiesRepo.getMyFamily).mockResolvedValueOnce(mockFamilyData);

      const { result } = renderHook(() => useMyFamily(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockFamilyData);
      expect(familiesRepo.getMyFamily).toHaveBeenCalledTimes(1);

      const query = queryClient.getQueryCache().find({ queryKey: familyQueryKeys.myFamily() });
      expect(query).toBeDefined();
      const observers = (query as unknown as { observers: Array<{ options: { staleTime?: number; gcTime?: number } }> }).observers;
      expect(observers[0]?.options.staleTime).toBe(STALE_TIMES.static);
      expect(observers[0]?.options.gcTime).toBe(STATIC_GC_TIME);
    });

    it("useFamilyConsolidation carrega dados consolidados do mês com staleTime transacional", async () => {
      const mockConsolidation = {
        family: { id: "fam-1", name: "Família Carvalho", owner_id: "user-1", monthly_budget_cents: 1200000, split_rule: "equal" as const },
        month: "2026-11",
        monthly_ceiling_cents: 1200000,
        total_spent_cents: 540000,
        total_income_cents: 0,
        remaining_cents: 660000,
        spent_percentage: 45,
        members: [],
        expenses: [],
        is_settled: false,
        settlement: null,
        has_post_settlement_expenses: false,
      };

      vi.mocked(familiesRepo.getFamilyConsolidation).mockResolvedValueOnce(mockConsolidation);

      const { result } = renderHook(() => useFamilyConsolidation("2026-11"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockConsolidation);
      expect(familiesRepo.getFamilyConsolidation).toHaveBeenCalledWith({ month: "2026-11" });

      const query = queryClient.getQueryCache().find({ queryKey: familyQueryKeys.consolidation("2026-11") });
      expect(query).toBeDefined();
      const observers = (query as unknown as { observers: Array<{ options: { staleTime?: number } }> }).observers;
      expect(observers[0]?.options.staleTime).toBe(STALE_TIMES.transactional);
    });

    it("useFamilyInvite busca convite apenas quando token válido for informado", async () => {
      const mockInviteDetails: familiesRepo.FamilyInviteWithDetails = {
        id: "inv-1",
        family_id: "fam-1",
        invited_by: "user-1",
        token: "valid-tok-123",
        status: "pending",
        role: "member",
        created_at: "2026-11-01T00:00:00Z",
        expires_at: "2026-11-08T00:00:00Z",
        family_name: "Família Carvalho",
        inviter_name: "Gabriel",
      };

      vi.mocked(familiesRepo.getFamilyInviteByToken).mockResolvedValueOnce(mockInviteDetails);

      const { result } = renderHook(() => useFamilyInvite("valid-tok-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockInviteDetails);
      expect(familiesRepo.getFamilyInviteByToken).toHaveBeenCalledWith("valid-tok-123");
    });

    it("useFamilyInvite não dispara fetch se token for nulo ou em branco", () => {
      const { result } = renderHook(() => useFamilyInvite(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(familiesRepo.getFamilyInviteByToken).not.toHaveBeenCalled();
    });

    it("useFamilySettlements busca histórico quando familyId informado", async () => {
      const mockSettlements = [
        {
          id: "set-1",
          family_id: "fam-1",
          month: "2026-10",
          payer_id: "u1",
          receiver_id: "u2",
          amount: 300,
          settled_at: "2026-10-31T20:00:00Z",
          payment_method: "pix" as const,
          snapshot: {},
          created_at: "2026-10-31T20:00:00Z",
          created_by: "u1",
        },
      ];

      vi.mocked(familiesRepo.listFamilySettlements).mockResolvedValueOnce(mockSettlements);

      const { result } = renderHook(() => useFamilySettlements("fam-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockSettlements);
      expect(familiesRepo.listFamilySettlements).toHaveBeenCalledWith("fam-1");
    });
  });

  describe("Mutations", () => {
    it("useCreateFamily cria família, aciona sensory e invalida queries", async () => {
      vi.mocked(familiesRepo.createFamily).mockResolvedValueOnce("fam-new");
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCreateFamily(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ name: "Casa Nova" });
      });

      expect(familiesRepo.createFamily).toHaveBeenCalledWith({ name: "Casa Nova" });
      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Família criada com sucesso!" }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: familyQueryKeys.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["categories"] });
    });

    it("useCreateFamily dispara sensory destrutivo e toast em caso de falha", async () => {
      vi.mocked(familiesRepo.createFamily).mockRejectedValueOnce(new Error("Usuário já pertence a uma família"));

      const { result } = renderHook(() => useCreateFamily(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await expect(result.current.mutateAsync({ name: "Casa Repetida" })).rejects.toThrow();
      });

      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("destructive");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });

    it("useInviteFamilyMember gera convite e invalida myFamily", async () => {
      vi.mocked(familiesRepo.inviteFamilyMember).mockResolvedValueOnce({
        id: "inv-1",
        family_id: "fam-1",
        token: "tok789",
        role: "member",
        invited_email: "parceiro@email.com",
        status: "pending",
        expires_at: "2026-11-13T00:00:00Z",
        created_at: "2026-11-06T00:00:00Z",
      });

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useInviteFamilyMember(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ invitedEmail: "parceiro@email.com" });
      });

      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Convite gerado com sucesso!" }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: familyQueryKeys.myFamily() });
    });

    it("useAcceptFamilyInvite aceita convite e invalida queries", async () => {
      vi.mocked(familiesRepo.acceptFamilyInvite).mockResolvedValueOnce({
        success: true,
        family_id: "fam-1",
        role: "member",
      });

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useAcceptFamilyInvite(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ token: "tok789" });
      });

      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Convite aceito com sucesso!" }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: familyQueryKeys.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["categories"] });
    });

    it("useLeaveFamily processa saída e invalida caches de dados transacionais", async () => {
      vi.mocked(familiesRepo.leaveFamily).mockResolvedValueOnce({
        success: true,
        family_id: "fam-1",
        disbanded: false,
      });

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useLeaveFamily(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ familyId: "fam-1" });
      });

      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("destructive");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Você saiu da família." }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: familyQueryKeys.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["expenses"] });
    });

    it("useRecordFamilySettlement registra liquidação e invalida caches", async () => {
      vi.mocked(familiesRepo.recordFamilySettlement).mockResolvedValueOnce("settle-id-99");
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useRecordFamilySettlement(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          month: "2026-11",
          payerId: "u1",
          receiverId: "u2",
          amount: 250,
        });
      });

      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Acerto de contas registrado com sucesso!" }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: familyQueryKeys.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["expenses"] });
    });

    it("useUpdateFamily atualiza dados da família", async () => {
      vi.mocked(familiesRepo.updateFamily).mockResolvedValueOnce({
        id: "fam-1",
        name: "Casa Atualizada",
        owner_id: "user-1",
        monthly_budget: 15000,
        split_rule: "equal",
        created_at: "2026-11-01T00:00:00Z",
        updated_at: "2026-11-06T00:00:00Z",
      });

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateFamily(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          familyId: "fam-1",
          updates: { name: "Casa Atualizada", monthly_budget: 15000 },
        });
      });

      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: familyQueryKeys.all });
    });

    it("useUpdateFamilyMember atualiza perfil do participante", async () => {
      vi.mocked(familiesRepo.updateFamilyMember).mockResolvedValueOnce({
        id: "mem-1",
        family_id: "fam-1",
        user_id: "user-1",
        role: "owner",
        display_name: "Gabriel S.",
        pix_key: "gabriel@test.com",
        pix_key_type: "email",
        split_ratio: 0.5,
        created_at: "2026-11-01T00:00:00Z",
        updated_at: "2026-11-06T00:00:00Z",
      });

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateFamilyMember(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          memberId: "mem-1",
          updates: { display_name: "Gabriel S." },
        });
      });

      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: familyQueryKeys.all });
    });

    it("useRevokeFamilyInvite revoga convite e invalida myFamily", async () => {
      vi.mocked(familiesRepo.revokeFamilyInvite).mockResolvedValueOnce();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useRevokeFamilyInvite(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("inv-123");
      });

      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("destructive");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: familyQueryKeys.myFamily() });
    });
  });
});
