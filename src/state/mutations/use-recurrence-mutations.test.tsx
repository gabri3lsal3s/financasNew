import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteRecurrenceOccurrences, useUpdateRecurrenceOccurrences } from "./use-recurrence-mutations";
import type { Expense, Recurrence } from "@/types";

const deleteRecurrenceMock = vi.fn();
const updateRecurrenceMock = vi.fn();
const pushToastMock = vi.fn();

vi.mock("@/data/rpc", () => ({
  deleteRecurrenceOccurrences: (...args: unknown[]) => deleteRecurrenceMock(...args),
  updateRecurrenceOccurrences: (...args: unknown[]) => updateRecurrenceMock(...args),
  createRecurrence: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: (...args: unknown[]) => {
    pushToastMock(...args);
    return 1;
  },
  dismissToast: vi.fn(),
  subscribeToasts: vi.fn(() => () => undefined),
}));

function makeOccurrence(id: string, recurrenceId: string, occurrenceNumber: number): Expense {
  return {
    id,
    user_id: "u1",
    value: 100,
    date: "2026-08-10",
    category_id: "c1",
    payment_method: "pix",
    card_id: null,
    installments_total: 1,
    installment_number: 1,
    installment_group_id: null,
    bill_competence: null,
    report_weight: 1,
    base_amount: 100,
    description: null,
    recurrence_id: recurrenceId,
    occurrence_number: occurrenceNumber,
    created_at: "2026-08-01T00:00:00Z",
  };
}

const REC = "r1";
const occurrences: Expense[] = [
  makeOccurrence("o1", REC, 1),
  makeOccurrence("o2", REC, 2),
  makeOccurrence("o3", REC, 3),
];

const template: Recurrence = {
  id: REC,
  user_id: "u1",
  kind: "expense",
  frequency: "monthly",
  value: 100,
  category_id: "c1",
  start_date: "2026-08-01",
  end_date: "2026-12-01",
  occurrences_total: null,
  payment_method: "pix",
  card_id: null,
  receive_type: null,
  description: null,
  report_weight: 1,
  is_active: true,
  created_at: "2026-08-01T00:00:00Z",
};

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useDeleteRecurrenceOccurrences — exclusão otimista (Fase 32)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });

  it("single remove apenas a ocorrência-alvo e mantém o template", async () => {
    queryClient.setQueryData(["expenses", "2026-08"], occurrences);
    queryClient.setQueryData(["recurrences", "all"], [template]);
    deleteRecurrenceMock.mockResolvedValue(1);

    const { result } = renderHook(() => useDeleteRecurrenceOccurrences(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ occurrenceId: "o2", mode: "single" });
    });

    expect(queryClient.getQueryData<Expense[]>(["expenses", "2026-08"])?.map((o) => o.id)).toEqual(["o1", "o3"]);
    expect(queryClient.getQueryData<Recurrence[]>(["recurrences", "all"])).toHaveLength(1);
  });

  it("all remove todas as ocorrências e o template", async () => {
    queryClient.setQueryData(["expenses", "2026-08"], occurrences);
    queryClient.setQueryData(["recurrences", "all"], [template]);
    deleteRecurrenceMock.mockResolvedValue(3);

    const { result } = renderHook(() => useDeleteRecurrenceOccurrences(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ occurrenceId: "o2", mode: "all" });
    });

    expect(queryClient.getQueryData<Expense[]>(["expenses", "2026-08"])).toEqual([]);
    expect(queryClient.getQueryData<Recurrence[]>(["recurrences", "all"])).toEqual([]);
  });

  it("subsequent remove a ocorrência-alvo e as seguintes", async () => {
    queryClient.setQueryData(["expenses", "2026-08"], occurrences);
    queryClient.setQueryData(["recurrences", "all"], [template]);
    deleteRecurrenceMock.mockResolvedValue(2);

    const { result } = renderHook(() => useDeleteRecurrenceOccurrences(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ occurrenceId: "o2", mode: "subsequent" });
    });

    expect(queryClient.getQueryData<Expense[]>(["expenses", "2026-08"])?.map((o) => o.id)).toEqual(["o1"]);
  });

  it("faz rollback e dispara toast quando o servidor rejeita", async () => {
    queryClient.setQueryData(["expenses", "2026-08"], occurrences);
    deleteRecurrenceMock.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useDeleteRecurrenceOccurrences(), { wrapper: makeWrapper(queryClient) });

    act(() => {
      result.current.mutate({ occurrenceId: "o2", mode: "all" });
    });

    await act(async () => {
      await vi.waitFor(() => expect(pushToastMock).toHaveBeenCalledTimes(1));
    });

    expect(queryClient.getQueryData(["expenses", "2026-08"])).toEqual(occurrences);
    expect(pushToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Não foi possível excluir a recorrência",
        variant: "destructive",
      }),
    );
  });
});

describe("useUpdateRecurrenceOccurrences — edição em grupo otimista (Fase 32)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });

  it("single atualiza apenas a ocorrência-alvo", async () => {
    queryClient.setQueryData(["expenses", "2026-08"], occurrences);
    queryClient.setQueryData(["recurrences", "all"], [template]);
    updateRecurrenceMock.mockResolvedValue(1);

    const { result } = renderHook(() => useUpdateRecurrenceOccurrences(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ occurrenceId: "o2", mode: "single", fields: { description: "Spotify" } });
    });

    const list = queryClient.getQueryData<Expense[]>(["expenses", "2026-08"]) ?? [];
    expect(list.map((o) => o.description)).toEqual([null, "Spotify", null]);
    expect(queryClient.getQueryData<Recurrence[]>(["recurrences", "all"])?.[0]?.description).toBeNull();
  });

  it("all atualiza todas as ocorrências e sincroniza o template", async () => {
    queryClient.setQueryData(["expenses", "2026-08"], occurrences);
    queryClient.setQueryData(["recurrences", "all"], [template]);
    updateRecurrenceMock.mockResolvedValue(3);

    const { result } = renderHook(() => useUpdateRecurrenceOccurrences(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ occurrenceId: "o2", mode: "all", fields: { description: "Spotify", value: 1990 } });
    });

    const list = queryClient.getQueryData<Expense[]>(["expenses", "2026-08"]) ?? [];
    expect(list.every((o) => o.description === "Spotify" && o.value === 1990)).toBe(true);
    expect(queryClient.getQueryData<Recurrence[]>(["recurrences", "all"])?.[0]).toMatchObject({
      description: "Spotify",
      value: 1990,
    });
  });
});
