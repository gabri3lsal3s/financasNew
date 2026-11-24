import { useQuery } from "@tanstack/react-query";
import { listAllExpenses } from "@/data/repositories/expenses";
import { listAllIncomes } from "@/data/repositories/incomes";
import { listDebts } from "@/data/repositories/debts";
import { listCreditCards } from "@/data/repositories/credit-cards";
import { listAllCategories } from "@/data/repositories/categories";
import { listPortfolioAssets } from "@/data/repositories/portfolio";
import { listBudgets } from "@/data/repositories/budgets";
import { listRecurrences } from "@/data/repositories/recurrences";
import { DEBT_STATUS_LABELS, debtStatus } from "@/domain/debts";
import { findLearnedMerchant } from "@/domain/notifications";
import {
  filterSearchEntries,
  STATIC_APP_ACTION_ENTRIES,
  STATIC_APP_PAGE_ENTRIES,
  type SearchEntry,
  type SearchIntentContext,
} from "@/domain/search";
import { formatDateBR, todayISO } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { useMerchantLearning } from "@/services/merchant-learning";
import { getActiveUserId } from "@/services/user-storage";
import { STALE_TIMES } from "@/state/cache-policy";
import { useUserAccess } from "./use-user-access";

export const allExpensesKey = ["expenses", "all"] as const;
export const allIncomesKey = ["incomes", "all"] as const;

/**
 * Dados da busca global e Command Palette (§3.9, Fase 64 & Fase 73):
 * Indexa 100% dos módulos (páginas, ações rápidas, despesas, rendas,
 * dívidas, cartões, investimentos, orçamentos, lembretes e categorias).
 * As queries são habilitadas condicionalmente pelas permissões e Feature Flags
 * ativas para o usuário logado (evitando requisições de rede para módulos desativados).
 */
export function useGlobalSearchEntries(enabled: boolean) {
  const { isAdmin, hasFeature } = useUserAccess();
  const { memory: merchantMemory } = useMerchantLearning();

  const isTransactionsEnabled = hasFeature("transactions") || hasFeature("overview");
  const isDebtsEnabled = hasFeature("debts");
  const isCardsEnabled = hasFeature("cards");
  const isInvestmentsEnabled = hasFeature("investments");
  const isBudgetsEnabled = hasFeature("budgets");
  const isRemindersEnabled = hasFeature("reminders");
  const isCategoriesEnabled = hasFeature("transactions") || hasFeature("budgets");

  const expensesQuery = useQuery({
    queryKey: allExpensesKey,
    queryFn: () => listAllExpenses(),
    enabled: enabled && isTransactionsEnabled,
    staleTime: STALE_TIMES.analytical,
  });
  const incomesQuery = useQuery({
    queryKey: allIncomesKey,
    queryFn: () => listAllIncomes(),
    enabled: enabled && isTransactionsEnabled,
    staleTime: STALE_TIMES.analytical,
  });
  const debtsQuery = useQuery({
    queryKey: ["debts"] as const,
    queryFn: () => listDebts(),
    enabled: enabled && isDebtsEnabled,
    staleTime: STALE_TIMES.analytical,
  });
  const cardsQuery = useQuery({
    queryKey: ["credit_cards"] as const,
    queryFn: () => listCreditCards(),
    enabled: enabled && isCardsEnabled,
    staleTime: STALE_TIMES.analytical,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"] as const,
    queryFn: () => listAllCategories(),
    enabled: enabled && isCategoriesEnabled,
    staleTime: STALE_TIMES.analytical,
  });
  const portfolioQuery = useQuery({
    queryKey: ["portfolio", "assets"] as const,
    queryFn: () => listPortfolioAssets(),
    enabled: enabled && isInvestmentsEnabled,
    staleTime: STALE_TIMES.analytical,
  });
  const budgetsQuery = useQuery({
    queryKey: ["budgets"] as const,
    queryFn: () => listBudgets(),
    enabled: enabled && isBudgetsEnabled,
    staleTime: STALE_TIMES.analytical,
  });
  const recurrencesQuery = useQuery({
    queryKey: ["recurrences"] as const,
    queryFn: () => listRecurrences(),
    enabled: enabled && isRemindersEnabled,
    staleTime: STALE_TIMES.analytical,
  });

  const categories = categoriesQuery.data ?? [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const creditCards = cardsQuery.data ?? [];
  const cardNameById = new Map(creditCards.map((card) => [card.id, card.name]));

  const expenses: SearchEntry[] = (expensesQuery.data ?? []).map((expense) => {
    const category = categoryById.get(expense.category_id);
    const cardName = expense.card_id ? cardNameById.get(expense.card_id) : undefined;
    const methodLabel = PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method;
    const learned = findLearnedMerchant(
      { merchant: expense.description ?? undefined },
      merchantMemory,
    );
    const learnedTags = learned?.semanticTags ?? [];
    const extraTerms = [
      ...(learned?.friendlyName ? [learned.friendlyName] : []),
      ...(learned?.serviceSegment ? [learned.serviceSegment] : []),
      ...learnedTags,
      ...(cardName ? [cardName] : []),
    ];
    return {
      id: expense.id,
      type: "expense",
      text: [
        expense.description ?? "",
        category?.name ?? "",
        methodLabel,
        "despesa",
        ...extraTerms,
      ].filter(Boolean),
      amountCents: Math.round(expense.value * 100),
      date: expense.date,
      label: expense.description || `Despesa · ${category?.name ?? "sem categoria"}`,
      detail: `${category?.name ?? "Sem categoria"} · ${methodLabel} · ${formatDateBR(expense.date)}`,
      link: { path: "/transacoes", params: { month: expense.date.slice(0, 7), q: expense.id } },
      featureKey: "transactions",
      structuredMeta: {
        categoryName: category?.name,
        cardName,
        paymentMethod: expense.payment_method,
        installmentsTotal: expense.installments_total,
        recurrenceId: expense.recurrence_id,
        isFamily: expense.is_family,
        tripId: expense.trip_id,
        chargeKind: expense.charge_kind,
        billCompetence: expense.bill_competence,
        extraTerms,
      },
    };
  });

  const incomes: SearchEntry[] = (incomesQuery.data ?? []).map((income) => {
    const category = categoryById.get(income.category_id);
    const receiveLabel = RECEIVE_TYPE_LABELS[income.receive_type] ?? income.receive_type;
    const learned = findLearnedMerchant(
      { merchant: income.description ?? undefined },
      merchantMemory,
    );
    const learnedTags = learned?.semanticTags ?? [];
    const extraTerms = [
      ...(learned?.friendlyName ? [learned.friendlyName] : []),
      ...learnedTags,
    ];
    return {
      id: income.id,
      type: "income",
      text: [
        income.description ?? "",
        category?.name ?? "",
        receiveLabel,
        "renda",
        ...extraTerms,
      ].filter(Boolean),
      amountCents: Math.round(income.value * 100),
      date: income.date,
      label: income.description || `Renda · ${category?.name ?? "sem categoria"}`,
      detail: `${category?.name ?? "Sem categoria"} · ${receiveLabel} · ${formatDateBR(income.date)}`,
      link: { path: "/transacoes", params: { month: income.date.slice(0, 7), q: income.id } },
      featureKey: "transactions",
      structuredMeta: {
        categoryName: category?.name,
        paymentMethod: income.receive_type,
        recurrenceId: income.recurrence_id,
        isFamily: income.is_family,
        extraTerms,
      },
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
      detail: `${debt.type === "payable" ? "A pagar" : "A receber"} · ${DEBT_STATUS_LABELS[status]} · vence ${formatDateBR(debt.due_date)}`,
      link: { path: "/dividas", params: { q: debt.id, type: debt.type } },
      featureKey: "debts",
    };
  });

  const cards: SearchEntry[] = (cardsQuery.data ?? []).map((card) => ({
    id: card.id,
    type: "card",
    text: [card.name, card.brand ?? "", "cartao"],
    label: card.name,
    detail: card.brand ? `Cartão ${card.brand}` : "Cartão de crédito",
    link: { path: "/cartoes", params: { card: card.id, q: card.id } },
    featureKey: "cards",
  }));

  const categoriesEntries: SearchEntry[] = categories.map((category) => ({
    id: category.id,
    type: "category",
    text: [category.name, category.type === "expense" ? "despesa" : "renda", "categoria"],
    label: category.name,
    detail: category.type === "expense" ? "Categoria de despesa" : "Categoria de renda",
    link: { path: "/categorias", params: { q: category.id, type: category.type } },
    featureKey: "transactions",
  }));

  const investments: SearchEntry[] = (portfolioQuery.data ?? []).map((asset) => ({
    id: asset.id,
    type: "investment",
    text: [asset.ticker, asset.asset_class ?? "", asset.sector ?? "", "investimento", "ativo", "carteira"],
    amountCents: Math.round(Number(asset.quantity ?? 0) * Number(asset.average_price ?? 0) * 100),
    label: `${asset.ticker}${asset.sector ? ` · ${asset.sector}` : ""}`,
    detail: `${asset.asset_class ?? "Ativo"} · ${asset.currency} ${Number(asset.quantity ?? 0).toLocaleString("pt-BR")} posições / cotas`,
    link: { path: "/investments", params: { q: asset.id, ticker: asset.ticker } },
    featureKey: "investments",
  }));

  const budgets: SearchEntry[] = (budgetsQuery.data ?? []).map((budget) => {
    const cat = categoryById.get(budget.category_id);
    return {
      id: budget.id,
      type: "budget",
      text: [cat?.name ?? "", "orcamento", "teto", "meta de gasto"],
      amountCents: Math.round(Number(budget.limit ?? 0) * 100),
      label: `Orçamento · ${cat?.name ?? "Categoria"}`,
      detail: `Teto de R$ ${Number(budget.limit ?? 0).toFixed(2)} · Mês ${budget.month}`,
      link: { path: "/orcamentos", params: { q: budget.id, category: budget.category_id } },
      featureKey: "budgets",
    };
  });

  const reminders: SearchEntry[] = (recurrencesQuery.data ?? []).map((rec) => {
    const cat = categoryById.get(rec.category_id ?? "");
    const description = rec.description?.trim() || (cat?.name ? `Recorrência · ${cat.name}` : "Lembrete");
    return {
      id: rec.id,
      type: "reminder",
      text: [description, cat?.name ?? "", rec.kind === "expense" ? "a pagar" : "a receber", "lembrete", "recorrencia", "fixa"],
      amountCents: Math.round(Number(rec.value ?? 0) * 100),
      date: rec.start_date,
      label: `Lembrete · ${description}`,
      detail: `${rec.kind === "expense" ? "Despesa fixa" : "Renda fixa"} · R$ ${Number(rec.value ?? 0).toFixed(2)} (${rec.frequency})`,
      link: { path: "/lembretes", params: { q: rec.id } },
      featureKey: "reminders",
    };
  });

  const rawEntries: SearchEntry[] = [
    ...STATIC_APP_ACTION_ENTRIES,
    ...STATIC_APP_PAGE_ENTRIES,
    ...investments,
    ...expenses,
    ...incomes,
    ...debts,
    ...cards,
    ...budgets,
    ...reminders,
    ...categoriesEntries,
  ];

  const entries = filterSearchEntries(rawEntries, { isAdmin, hasFeature });

  // Agregações em memória para resposta instantânea (< 2ms) de intenções de busca
  const localToday = todayISO();
  const currentMonthStr = localToday.slice(0, 7);
  const categorySpendingCurrentMonth: Record<string, number> = {};
  for (const exp of expensesQuery.data ?? []) {
    if (exp.date.startsWith(currentMonthStr)) {
      const cat = categoryById.get(exp.category_id);
      const catKey = (cat?.name ?? "outros")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
      categorySpendingCurrentMonth[catKey] =
        (categorySpendingCurrentMonth[catKey] ?? 0) + Math.round(exp.value * 100);
    }
  }

  // Contas e faturas a vencer nos próximos dias
  const upcomingBills = (debtsQuery.data ?? [])
    .filter((d) => d.type === "payable" && !d.paid_at)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5)
    .map((d) => ({
      title: d.name,
      amountCents: Math.round(d.amount * 100),
      dueDate: formatDateBR(d.due_date),
      isOverdue: d.due_date < localToday,
    }));

  const intentContext: SearchIntentContext = {
    todayISO: localToday,
    categorySpendingCurrentMonth,
    upcomingBills,
    rawExpenses: expensesQuery.data ?? [],
    rawIncomes: incomesQuery.data ?? [],
    categoryNameById,
    cardNameById,
    merchantLearning: merchantMemory,
  };

  // Descrições distintas ainda sem semanticTags para ensino passivo opcional quando a busca local zerar
  const distinctUntaggedMerchants: string[] = [];
  const seenMerchantKeys = new Set<string>();
  for (const exp of expensesQuery.data ?? []) {
    const desc = exp.description?.trim();
    if (!desc || desc.length < 3) continue;
    const key = desc.toLowerCase();
    if (seenMerchantKeys.has(key)) continue;
    const learned = findLearnedMerchant({ merchant: desc }, merchantMemory);
    if (learned?.semanticTags && learned.semanticTags.length > 0) continue;
    seenMerchantKeys.add(key);
    distinctUntaggedMerchants.push(desc);
    if (distinctUntaggedMerchants.length >= 25) break;
  }

  const isAiExtractionEnabled = hasFeature("ai_extraction");

  return {
    entries,
    intentContext,
    searchAiContext: {
      userId: getActiveUserId(),
      featureEnabled: isAiExtractionEnabled,
      distinctUntaggedMerchants,
      categories: categories
        .filter((c) => c.type === "expense")
        .map((c) => ({ id: c.id, name: c.name })),
    },
    isLoading:
      expensesQuery.isLoading ||
      incomesQuery.isLoading ||
      debtsQuery.isLoading ||
      cardsQuery.isLoading ||
      categoriesQuery.isLoading ||
      portfolioQuery.isLoading ||
      budgetsQuery.isLoading ||
      recurrencesQuery.isLoading,
    error:
      expensesQuery.error ??
      incomesQuery.error ??
      debtsQuery.error ??
      cardsQuery.error ??
      categoriesQuery.error ??
      portfolioQuery.error ??
      budgetsQuery.error ??
      recurrencesQuery.error,
    /** Refetch de todas as fontes ("Tentar novamente" da busca). */
    refetch: () =>
      Promise.all([
        expensesQuery.refetch(),
        incomesQuery.refetch(),
        debtsQuery.refetch(),
        cardsQuery.refetch(),
        categoriesQuery.refetch(),
        portfolioQuery.refetch(),
        budgetsQuery.refetch(),
        recurrencesQuery.refetch(),
      ]),
  };
}
