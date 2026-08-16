import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteExpense, useUpdateExpense } from "./use-expense-mutations";
import type { Expense } from "@/types";

const updateExpenseMock = vi.fn();
const deleteExpenseMock = vi.fn();
const pushToastMock = vi.fn();

vi.mock("@/data/repositories/expenses", () => ({
  updateExpense: (...args: unknown[]) => updateExpenseMock(...args),
}));

vi.mock("@/data/rpc", () => ({
  deleteExpenseInstallments: (...args: unknown[]) => deleteExpenseMock(...args),
  createExpenseWithDebt: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: (...args: unknown[]) => {
    pushToastMock(...args);
    return 1;
  },
  dismissToast: vi.fn(),
  subscribeToasts: vi.fn(() => () => undefined),
}));

function makeExpense(id: string, overrides: Partial<Expense> = {}): Expense {
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
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const GROUP = "g1";
const installments: Expense[] = [
  makeExpense("e1", { installments_total: 3, installment_number: 1, installment_group_id: GROUP }),
  makeExpense("e2", { installments_total: 3, installment_number: 2, installment_group_id: GROUP }),
  makeExpense("e3", { installments_total: 3, installment_number: 3, installment_group_id: GROUP }),
];

describe("useUpdateExpense — atualização otimista", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });

  it("atualiza o cache imediatamente (onMutate) e mantém o dado após o sucesso", async () => {
    const e1 = makeExpense("e1");
    queryClient.setQueryData(["expenses", "2026-08"], [e1]);
    queryClient.setQueryData(["card_expenses", "card1"], [e1]);

    updateExpenseMock.mockResolvedValue({ ...e1, value: 250 });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateExpense(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: "e1", input: { value: 250, description: "Almoço" } });
    });

    // Otimista: o cache já reflete o novo valor antes do servidor responder.
    expect(queryClient.getQueryData<Expense[]>(["expenses", "2026-08"])?.[0]).toMatchObject({
      value: 250,
      description: "Almoço",
    });
    expect(queryClient.getQueryData<Expense[]>(["card_expenses", "card1"])?.[0]).toMatchObject({ value: 250 });

    await act(async () => {
      await vi.waitFor(() => expect(updateExpenseMock).toHaveBeenCalledTimes(1));
    });

    // Sucesso: sem rollback e sem toast de erro.
    expect(queryClient.getQueryData<Expense[]>(["expenses", "2026-08"])?.[0]).toMatchObject({ value: 250 });
    expect(pushToastMock).not.toHaveBeenCalled();
  });

  it("faz rollback do cache e dispara toast quando o servidor rejeita", async () => {
    const e1 = makeExpense("e1");
    const e2 = makeExpense("e2");
    queryClient.setQueryData(["expenses", "2026-08"], [e1, e2]);

    updateExpenseMock.mockRejectedValue(new Error("boom"));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateExpense(), { wrapper });

    act(() => {
      result.current.mutate({ id: "e1", input: { value: 999 } });
    });

    await act(async () => {
      await vi.waitFor(() => expect(pushToastMock).toHaveBeenCalledTimes(1));
    });

    // Rollback: estado original restaurado.
    expect(queryClient.getQueryData(["expenses", "2026-08"])).toEqual([e1, e2]);
    expect(pushToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Não foi possível salvar a despesa",
        variant: "destructive",
      }),
    );
  });
});

describe("useDeleteExpense — exclusão otimista", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });

  it("remove o item da lista imediatamente (single) e do cache do cartão", async () => {
    const e1 = makeExpense("e1");
    const e2 = makeExpense("e2");
    queryClient.setQueryData(["expenses", "2026-08"], [e1, e2]);
    queryClient.setQueryData(["card_expenses", "card1"], [e1]);
    queryClient.setQueryData(["expenses", "e1"], e1);

    deleteExpenseMock.mockResolvedValue(1);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteExpense(), { wrapper });

    await act(async () => {
      result.current.mutate({ expenseId: "e1", mode: "single" });
    });

    expect(queryClient.getQueryData(["expenses", "2026-08"])).toEqual([e2]);
    expect(queryClient.getQueryData(["card_expenses", "card1"])).toEqual([]);
    expect(queryClient.getQueryData(["expenses", "e1"])).toBeNull();

    await act(async () => {
      await vi.waitFor(() => expect(deleteExpenseMock).toHaveBeenCalledTimes(1));
    });
  });

  it("mode all remove o grupo inteiro de parcelas do cache", async () => {
    queryClient.setQueryData(["expenses", "2026-08"], installments);
    deleteExpenseMock.mockResolvedValue(3);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteExpense(), { wrapper });

    await act(async () => {
      result.current.mutate({ expenseId: "e2", mode: "all" });
    });

    expect(queryClient.getQueryData(["expenses", "2026-08"])).toEqual([]);
  });

  it("mode subsequent remove a parcela e as seguintes", async () => {
    queryClient.setQueryData(["expenses", "2026-08"], installments);
    deleteExpenseMock.mockResolvedValue(2);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteExpense(), { wrapper });

    await act(async () => {
      result.current.mutate({ expenseId: "e2", mode: "subsequent" });
    });

    expect(queryClient.getQueryData(["expenses", "2026-08"])).toEqual([installments[0]]);
  });

  it("faz rollback e dispara toast quando a exclusão falha", async () => {
    const e1 = makeExpense("e1");
    const e2 = makeExpense("e2");
    queryClient.setQueryData(["expenses", "2026-08"], [e1, e2]);

    deleteExpenseMock.mockRejectedValue(new Error("network"));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteExpense(), { wrapper });

    act(() => {
      result.current.mutate({ expenseId: "e1", mode: "single" });
    });

    await act(async () => {
      await vi.waitFor(() => expect(pushToastMock).toHaveBeenCalledTimes(1));
    });

    expect(queryClient.getQueryData(["expenses", "2026-08"])).toEqual([e1, e2]);
    expect(pushToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Não foi possível excluir a despesa",
        variant: "destructive",
      }),
    );
  });
});
