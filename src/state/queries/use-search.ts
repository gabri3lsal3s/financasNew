import { useQuery } from "@tanstack/react-query";
import { listAllExpenses } from "@/data/repositories/expenses";
import { listAllIncomes } from "@/data/repositories/incomes";
import { listDebts } from "@/data/repositories/debts";
import { listCreditCards } from "@/data/repositories/credit-cards";
import { listAllCategories } from "@/data/repositories/categories";
import { DEBT_STATUS_LABELS, debtStatus } from "@/domain/debts";
import type { SearchEntry } from "@/domain/search";
import { PAYMENT_METHOD_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { STALE_TIMES } from "@/state/cache-policy";

export const allExpensesKey = ["expenses", "all"] as const;
export const allIncomesKey = ["incomes", "all"] as const;

/**
 * Dados da busca global (§3.9): despesas, rendas, dívidas, cartões e
 * categorias convertidos em `SearchEntry` (com deep-links). As queries são
 * habilitadas apenas com a paleta aberta — evita custo sem uso.
 */
export function useGlobalSearchEntries(enabled: boolean) {
  const expensesQuery = useQuery({
    queryKey: allExpensesKey,
    queryFn: () => listAllExpenses(),
    enabled,
    staleTime: STALE_TIMES.analytical,
  });
  const incomesQuery = useQuery({
    queryKey: allIncomesKey,
    queryFn: () => listAllIncomes(),
    enabled,
    staleTime: STALE_TIMES.analytical,
  });
  const debtsQuery = useQuery({
    queryKey: ["debts"] as const,
    queryFn: () => listDebts(),
    enabled,
    staleTime: STALE_TIMES.analytical,
  });
  const cardsQuery = useQuery({
    queryKey: ["credit_cards"] as const,
    queryFn: () => listCreditCards(),
    enabled,
    staleTime: STALE_TIMES.analytical,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"] as const,
    queryFn: () => listAllCategories(),
    enabled,
    staleTime: STALE_TIMES.analytical,
  });

  const categories = categoriesQuery.data ?? [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const formatDate = (iso: string): string => {
    const parsed = new Date(`${iso}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleDateString("pt-BR");
  };

  const expenses: SearchEntry[] = (expensesQuery.data ?? []).map((expense) => {
    const category = categoryById.get(expense.category_id);
    const methodLabel = PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method;
    return {
      id: expense.id,
      type: "expense",
      text: [expense.description ?? "", category?.name ?? "", methodLabel, "despesa"],
      amountCents: Math.round(expense.value * 100),
      date: expense.date,
      label: expense.description || `Despesa · ${category?.name ?? "sem categoria"}`,
      detail: `${category?.name ?? "Sem categoria"} · ${methodLabel} · ${formatDate(expense.date)}`,
      link: { path: "/transacoes", params: { month: expense.date.slice(0, 7), q: expense.id } },
    };
  });

  const incomes: SearchEntry[] = (incomesQuery.data ?? []).map((income) => {
    const category = categoryById.get(income.category_id);
    const receiveLabel = RECEIVE_TYPE_LABELS[income.receive_type] ?? income.receive_type;
    return {
      id: income.id,
      type: "income",
      text: [income.description ?? "", category?.name ?? "", receiveLabel, "renda"],
      amountCents: Math.round(income.value * 100),
      date: income.date,
      label: income.description || `Renda · ${category?.name ?? "sem categoria"}`,
      detail: `${category?.name ?? "Sem categoria"} · ${receiveLabel} · ${formatDate(income.date)}`,
      link: { path: "/transacoes", params: { month: income.date.slice(0, 7), q: income.id } },
    };
  });

  const debts: SearchEntry[] = (debtsQuery.data ?? []).map((debt) => {
    const status = debtStatus(debt.due_date, debt.paid_at);
    const typeLabel = debt.type === "payable" ? "a pagar" : "a receber";
    return {
      id: debt.id,
      type: "debt",
      text: [debt.name, typeLabel, "divida"],
      amountCents: Math.round(debt.amount * 100),
      date: debt.due_date,
      statusWords: [DEBT_STATUS_LABELS[status]],
      label: debt.name,
      detail: `${debt.type === "payable" ? "A pagar" : "A receber"} · ${DEBT_STATUS_LABELS[status]} · vence ${formatDate(debt.due_date)}`,
      link: { path: "/dividas", params: { q: debt.id, type: debt.type } },
    };
  });

  const cards: SearchEntry[] = (cardsQuery.data ?? []).map((card) => ({
    id: card.id,
    type: "card",
    text: [card.name, card.brand ?? "", "cartao"],
    label: card.name,
    detail: card.brand ? `Cartão ${card.brand}` : "Cartão de crédito",
    // `card` seleciona (derivado); `q` destaca por um instante (§3.9).
    link: { path: "/cartoes", params: { card: card.id, q: card.id } },
  }));

  const categoriesEntries: SearchEntry[] = categories.map((category) => ({
    id: category.id,
    type: "category",
    text: [category.name, category.type === "expense" ? "despesa" : "renda", "categoria"],
    label: category.name,
    detail: category.type === "expense" ? "Categoria de despesa" : "Categoria de renda",
    link: { path: "/categorias", params: { q: category.id, type: category.type } },
  }));

  const entries = [...expenses, ...incomes, ...debts, ...cards, ...categoriesEntries];

  return {
    entries,
    isLoading:
      expensesQuery.isLoading ||
      incomesQuery.isLoading ||
      debtsQuery.isLoading ||
      cardsQuery.isLoading ||
      categoriesQuery.isLoading,
    error:
      expensesQuery.error ??
      incomesQuery.error ??
      debtsQuery.error ??
      cardsQuery.error ??
      categoriesQuery.error,
  };
}
