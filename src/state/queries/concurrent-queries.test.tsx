import { render, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQueries, useQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useRef } from "react";

/**
 * FASE 5 — TAREFA 5.3: SIMULAÇÃO DE CONCORRÊNCIA DE QUERIES NO TANSTACK QUERY
 * --------------------------------------------------------------------------
 * Validação de alta concorrência de rede e estabilidade de renderização:
 * 1. Resolução simultânea de 10 queries em paralelo no QueryClient
 * 2. Otimização de renderização (React 18 automatic batching sem re-renderizações duplicadas)
 * 3. Invalidação concorrente em massa (cache invalidation storm)
 * 4. Isolamento estrito de falhas parciais (erros isolados sem corrupção do pool)
 * 5. Estabilidade de memória e ciclo de vida de observadores (zero memory leak)
 * 6. Resolução paralela unificada via useQueries
 */

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: "always",
        staleTime: 60_000,
        gcTime: 600_000,
        retry: 0,
      },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const QUERY_KEYS = [
  "expenses",
  "incomes",
  "credit_cards",
  "debts",
  "loans",
  "budgets",
  "portfolio_assets",
  "categories",
  "user_preferences",
  "system_features",
] as const;

describe("Tarefa 5.3 — Simulação de Concorrência de Queries no TanStack Query", () => {
  it("resolve 10 queries simultâneas em paralelo com latências de rede concorrentes", async () => {
    const queryClient = createTestQueryClient();
    const queryExecutions = vi.fn();

    // 10 fetchers simulando diferentes latências assíncronas concorrentes
    const fetchers = QUERY_KEYS.map((key, index) => {
      const delay = (index + 1) * 5; // 5ms, 10ms, 15ms... 50ms
      return vi.fn().mockImplementation(async () => {
        queryExecutions(key);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return { domain: key, count: index + 1 };
      });
    });

    const { result } = renderHook(
      () =>
        useQueries({
          queries: QUERY_KEYS.map((key, i) => ({
            queryKey: [key],
            queryFn: fetchers[i],
          })),
        }),
      { wrapper: createWrapper(queryClient) },
    );

    // Aguarda todas as 10 queries terminarem com sucesso
    await waitFor(() => {
      const allSuccess = result.current.every((q) => q.isSuccess);
      expect(allSuccess).toBe(true);
    });

    expect(result.current).toHaveLength(10);
    expect(queryExecutions).toHaveBeenCalledTimes(10);

    for (let i = 0; i < 10; i++) {
      expect(result.current[i]?.data).toEqual({
        domain: QUERY_KEYS[i],
        count: i + 1,
      });
    }
  });

  it("evita re-renderizações duplicadas agrupando resolução simultânea em lote", async () => {
    const queryClient = createTestQueryClient();
    const renderSpy = vi.fn();

    // Componente consumidor que dispara 10 useQueries simultâneas
    function DashboardConcurrentConsumer() {
      const renderCountRef = useRef(0);
      renderCountRef.current += 1;
      renderSpy(renderCountRef.current);

      const q0 = useQuery({ queryKey: [QUERY_KEYS[0]], queryFn: async () => { await new Promise((r) => setTimeout(r, 10)); return 1; } });
      const q1 = useQuery({ queryKey: [QUERY_KEYS[1]], queryFn: async () => { await new Promise((r) => setTimeout(r, 10)); return 2; } });
      const q2 = useQuery({ queryKey: [QUERY_KEYS[2]], queryFn: async () => { await new Promise((r) => setTimeout(r, 10)); return 3; } });
      const q3 = useQuery({ queryKey: [QUERY_KEYS[3]], queryFn: async () => { await new Promise((r) => setTimeout(r, 10)); return 4; } });
      const q4 = useQuery({ queryKey: [QUERY_KEYS[4]], queryFn: async () => { await new Promise((r) => setTimeout(r, 10)); return 5; } });
      const q5 = useQuery({ queryKey: [QUERY_KEYS[5]], queryFn: async () => { await new Promise((r) => setTimeout(r, 10)); return 6; } });
      const q6 = useQuery({ queryKey: [QUERY_KEYS[6]], queryFn: async () => { await new Promise((r) => setTimeout(r, 10)); return 7; } });
      const q7 = useQuery({ queryKey: [QUERY_KEYS[7]], queryFn: async () => { await new Promise((r) => setTimeout(r, 10)); return 8; } });
      const q8 = useQuery({ queryKey: [QUERY_KEYS[8]], queryFn: async () => { await new Promise((r) => setTimeout(r, 10)); return 9; } });
      const q9 = useQuery({ queryKey: [QUERY_KEYS[9]], queryFn: async () => { await new Promise((r) => setTimeout(r, 10)); return 10; } });

      const allReady =
        q0.isSuccess && q1.isSuccess && q2.isSuccess && q3.isSuccess && q4.isSuccess &&
        q5.isSuccess && q6.isSuccess && q7.isSuccess && q8.isSuccess && q9.isSuccess;

      return (
        <div data-testid="container">
          {allReady ? <span data-testid="all-loaded">Carregado</span> : <span>Carregando...</span>}
        </div>
      );
    }

    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <DashboardConcurrentConsumer />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("all-loaded")).toBeInTheDocument();
    });

    // O automatic batching do React 18 e o notifyManager do TanStack Query
    // agrupam as notificações: 10 queries simultâneas com tempos próximos
    // não devem disparar 20 ou 30 renders em cascata
    expect(renderSpy.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("invalidação concorrente em massa (cache storm) re-executa todas as 10 queries sem travamentos", async () => {
    const queryClient = createTestQueryClient();
    let version = 1;

    // Popula o cache com os dados iniciais
    for (const key of QUERY_KEYS) {
      queryClient.setQueryData([key], { key, version: 1 });
    }

    const fetchers = QUERY_KEYS.map((key) =>
      vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { key, version };
      }),
    );

    const { result } = renderHook(
      () =>
        useQueries({
          queries: QUERY_KEYS.map((key, i) => ({
            queryKey: [key],
            queryFn: fetchers[i],
          })),
        }),
      { wrapper: createWrapper(queryClient) },
    );

    // Estado inicial sincronizado
    expect(result.current.every((q) => q.data?.version === 1)).toBe(true);

    // Dispara nova versão e invalidação simultânea das 10 queries
    version = 2;
    await Promise.all(QUERY_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

    await waitFor(() => {
      const allUpdated = result.current.every((q) => q.data?.version === 2);
      expect(allUpdated).toBe(true);
    });

    for (const fn of fetchers) {
      expect(fn).toHaveBeenCalled();
    }
  });

  it("isola falhas parciais sob concorrência: erros em 2 queries não corrompem as outras 8", async () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(
      () =>
        useQueries({
          queries: QUERY_KEYS.map((key, index) => ({
            queryKey: [key],
            queryFn: async () => {
              await new Promise((r) => setTimeout(r, 10));
              if (index === 2 || index === 5) {
                // Simula falha temporária em 2 domínios
                throw new Error(`Falha simulada em ${key}`);
              }
              return { success: true, key };
            },
          })),
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      const allSettled = result.current.every((q) => q.isSuccess || q.isError);
      expect(allSettled).toBe(true);
    });

    // 8 queries devem ter status de sucesso com dados intactos
    const successfulQueries = result.current.filter((q) => q.isSuccess);
    expect(successfulQueries).toHaveLength(8);
    for (const q of successfulQueries) {
      expect(q.data?.success).toBe(true);
    }

    // 2 queries devem estar com status de erro isolado
    const failedQueries = result.current.filter((q) => q.isError);
    expect(failedQueries).toHaveLength(2);
    expect(result.current[2]?.error?.message).toBe("Falha simulada em credit_cards");
    expect(result.current[5]?.error?.message).toBe("Falha simulada em budgets");
  });

  it("estabilidade de memória: ciclo de montagem/desmontagem de 10 queries desaloca observadores sem vazamento", async () => {
    const queryClient = createTestQueryClient();

    function TestConsumer() {
      useQueries({
        queries: QUERY_KEYS.map((key) => ({
          queryKey: [key],
          queryFn: async () => ({ key }),
        })),
      });
      return <div>Observadores Ativos</div>;
    }

    const queryCache = queryClient.getQueryCache();

    // Ciclo 1: Monta e desmonta
    const { unmount: unmount1 } = render(
      <QueryClientProvider client={queryClient}>
        <TestConsumer />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(queryCache.getAll()).toHaveLength(10);
    });

    // Desmonta o componente: nenhum observador deve permanecer ouvindo
    unmount1();
    for (const query of queryCache.getAll()) {
      expect(query.getObserversCount()).toBe(0);
    }

    // Ciclo 2 a 5: Repete montagens e desmontagens sucessivas para atestar ausência de vazamento
    for (let cycle = 2; cycle <= 5; cycle++) {
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <TestConsumer />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(queryCache.getAll()).toHaveLength(10);
      });

      unmount();
      for (const query of queryCache.getAll()) {
        expect(query.getObserversCount()).toBe(0);
      }
    }

    // Limpeza completa desaloca todas as entradas do heap
    queryClient.clear();
    expect(queryCache.getAll()).toHaveLength(0);
  });
});
