import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import type { OnboardingCounts } from "@/domain/onboarding";
import { AppError, classifyError } from "@/services/errors";

interface CountFilter {
  column: string;
  value: unknown;
}

/** Conta de forma leve (head: true) as linhas de uma tabela do usuário. */
async function count(table: "categories" | "credit_cards" | "expenses" | "incomes", filters: CountFilter[] = []): Promise<number> {
  let query = getSupabase().from(table).select("id", { count: "exact", head: true });
  for (const filter of filters) query = query.eq(filter.column, filter.value);
  const { count: total, error } = await resolveQuery<{ count: number } | null>(query);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return total ?? 0;
}

/**
 * Snapshot de dados para o onboarding de primeiro uso (§5.7): contagens
 * paralelas de categorias do usuário (is_reserved = false — as reservadas
 * são do sistema), cartões e lançamentos. Falha de rede propaga como
 * AppError (a UI trata via gateway + retry).
 */
export async function getOnboardingCounts(): Promise<OnboardingCounts> {
  const [expenseCategories, incomeCategories, cards, expenses, incomes] = await Promise.all([
    count("categories", [
      { column: "type", value: "expense" },
      { column: "is_reserved", value: false },
    ]),
    count("categories", [
      { column: "type", value: "income" },
      { column: "is_reserved", value: false },
    ]),
    count("credit_cards"),
    count("expenses"),
    count("incomes"),
  ]);

  return { expenseCategories, incomeCategories, cards, transactions: expenses + incomes };
}
