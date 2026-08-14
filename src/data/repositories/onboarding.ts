import { getSupabase } from "@/data/client";
import type { OnboardingCounts } from "@/domain/onboarding";
import { AppError, classifyError } from "@/services/errors";

interface CountFilter {
  column: string;
  value: unknown;
}

/** Resultado de contagem do supabase-js (count no topo, sem data). */
interface CountResult {
  count: number | null;
  error: { message: string } | null;
}

/** Builder mínimo de contagem — `eq` aceita qualquer coluna/valor (cast controlado). */
interface CountQuery {
  eq(column: string, value: unknown): CountQuery;
  then<TResult>(onfulfilled?: (value: CountResult) => TResult | PromiseLike<TResult>): Promise<TResult>;
}

/**
 * Conta de forma leve (head: true) as linhas de uma tabela do usuário.
 * O `count` vem no topo do resultado do builder (mesmo padrão de
 * `getCategoryUsage` em categories.ts) — sem passar por resolveQuery.
 */
async function count(table: "categories" | "credit_cards" | "expenses" | "incomes", filters: CountFilter[] = []): Promise<number> {
  let query = getSupabase()
    .from(table)
    .select("id", { count: "exact", head: true }) as unknown as CountQuery;
  for (const filter of filters) query = query.eq(filter.column, filter.value);
  const { count: total, error } = await query;
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
