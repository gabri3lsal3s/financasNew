import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { feedbackKey, useFeedback, useSetFeedback } from "./use-insight-feedback";
import * as feedbackRepo from "@/data/repositories/insight-feedback";
import { pushToast } from "@/services/toast";

vi.mock("@/data/repositories/insight-feedback", () => ({
  listFeedback: vi.fn(),
  setFeedback: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("useInsightFeedback — Persistência e Aprendizado Ativo (Tarefa 5.3)", () => {
  let queryClient: QueryClient;

  function createWrapper() {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
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

  describe("useFeedback Query", () => {
    it("mapeia as linhas persistidas para um dicionário occurrence_key -> decision", async () => {
      vi.mocked(feedbackRepo.listFeedback).mockResolvedValueOnce([
        { occurrence_key: "dup:netflix", decision: "confirm" },
        { occurrence_key: "sub:spotify", decision: "ignore" },
      ]);

      const { result } = renderHook(() => useFeedback(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        "dup:netflix": "confirm",
        "sub:spotify": "ignore",
      });
      expect(feedbackRepo.listFeedback).toHaveBeenCalledTimes(1);
    });

    it("retorna dicionário vazio caso não haja feedbacks gravados", async () => {
      vi.mocked(feedbackRepo.listFeedback).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useFeedback(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({});
    });
  });

  describe("useSetFeedback Mutation", () => {
    it("aplica atualização otimista imediatamente no cache ao confirmar uma recorrência", async () => {
      // Estado prévio no cache
      queryClient.setQueryData(feedbackKey, { "old:key": "ignore" });

      let resolveApi!: () => void;
      const apiPromise = new Promise<void>((res) => {
        resolveApi = res;
      });
      vi.mocked(feedbackRepo.setFeedback).mockReturnValueOnce(apiPromise);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useSetFeedback(), {
        wrapper: createWrapper(),
      });

      // Dispara a mutação
      await act(async () => {
        result.current.mutate({
          occurrenceKey: "academia:smartfit",
          decision: "confirm",
        });
      });

      // O cache DEVE ser atualizado antes mesmo da promise resolver (otimista)
      const optimisticCache = queryClient.getQueryData<Record<string, string>>(feedbackKey);
      expect(optimisticCache).toEqual({
        "old:key": "ignore",
        "academia:smartfit": "confirm",
      });

      expect(feedbackRepo.setFeedback).toHaveBeenCalledWith("academia:smartfit", "confirm");

      // Resolve a API do Supabase
      await act(async () => {
        resolveApi();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Valida invalidação das queries no onSettled
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: feedbackKey });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["insights"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["overview"] });
    });

    it("remove a chave do cache otimisticamente quando decision é null (restauração)", async () => {
      queryClient.setQueryData(feedbackKey, {
        "item:1": "confirm",
        "item:2": "ignore",
      });

      vi.mocked(feedbackRepo.setFeedback).mockResolvedValueOnce();

      const { result } = renderHook(() => useSetFeedback(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          occurrenceKey: "item:1",
          decision: null,
        });
      });

      // O cache otimista já deve ter apagado item:1
      const cache = queryClient.getQueryData<Record<string, string>>(feedbackKey);
      expect(cache).toEqual({
        "item:2": "ignore",
      });

      expect(feedbackRepo.setFeedback).toHaveBeenCalledWith("item:1", null);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("faz rollback do cache e exibe toast destrutivo em caso de erro na persistência", async () => {
      const initialCache = { "original:key": "confirm" };
      queryClient.setQueryData(feedbackKey, initialCache);

      vi.mocked(feedbackRepo.setFeedback).mockRejectedValueOnce(
        new Error("Falha na rede ao salvar feedback"),
      );

      const { result } = renderHook(() => useSetFeedback(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({
          occurrenceKey: "item:novo",
          decision: "ignore",
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Cache restaurado para o estado inicial
      const restoredCache = queryClient.getQueryData(feedbackKey);
      expect(restoredCache).toEqual(initialCache);

      // Toast destrutivo disparado sem emojis
      expect(pushToast).toHaveBeenCalledWith({
        title: "Não foi possível salvar a avaliação",
        description: expect.any(String),
        variant: "destructive",
      });
    });
  });
});
