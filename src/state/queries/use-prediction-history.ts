import { useQuery } from "@tanstack/react-query";
import { listAllExpenses } from "@/data/repositories/expenses";
import { listAllIncomes } from "@/data/repositories/incomes";
import { listAllCategories } from "@/data/repositories/categories";
import { allExpensesKey, allIncomesKey } from "./use-search";
import { categoriesKey } from "./use-categories";
import type { PredictionEntry } from "@/domain/predictions";

/**
 * Histórico preditivo (F21) — despesas, rendas e categorias convertidos no
 * contrato do motor puro `domain/predictions` (descrição + categoria +
 * forma/cartão + valor + data). As queries são habilitadas sob demanda
 * (`enabled`) — o histórico só é buscado quando o autopreenchimento está
 * ativo (zero custo em telas que não usam predição).
 */
export function usePredictionHistory(enabled: boolean) {
  const expensesQuery = useQuery({
    queryKey: allExpensesKey,
    queryFn: () => listAllExpenses(),
    enabled,
    staleTime: 60_000,
  });
  const incomesQuery = useQuery({
    queryKey: allIncomesKey,
    queryFn: () => listAllIncomes(),
    enabled,
    staleTime: 60_000,
  });
  const categoriesQuery = useQuery({
    queryKey: categoriesKey,
    queryFn: () => listAllCategories(),
    enabled,
    staleTime: 60_000,
  });

  const categories = categoriesQuery.data ?? [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const entries: PredictionEntry[] = [
    ...(expensesQuery.data ?? []).map((expense) => ({
      id: expense.id,
      kind: "expense" as const,
      description: expense.description ?? "",
      categoryId: expense.category_id,
      categoryName: categoryById.get(expense.category_id)?.name ?? "",
      paymentMethod: expense.payment_method,
      cardId: expense.card_id,
      receiveType: null,
      value: expense.value,
      date: expense.date,
      createdAt: expense.created_at,
    })),
    ...(incomesQuery.data ?? []).map((income) => ({
      id: income.id,
      kind: "income" as const,
      description: income.description ?? "",
      categoryId: income.category_id,
      categoryName: categoryById.get(income.category_id)?.name ?? "",
      paymentMethod: null,
      cardId: null,
      receiveType: income.receive_type,
      value: income.value,
      date: income.date,
      createdAt: income.created_at,
    })),
  ];

  const isLoading = expensesQuery.isLoading || incomesQuery.isLoading || categoriesQuery.isLoading;
  const error = expensesQuery.error ?? incomesQuery.error ?? categoriesQuery.error;

  return { entries, isLoading, error, refetch: () => void Promise.all([expensesQuery.refetch(), incomesQuery.refetch(), categoriesQuery.refetch()]) };
}
