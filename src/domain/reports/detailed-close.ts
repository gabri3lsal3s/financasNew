/**
 * Fechamento do período DETALHADO — evolução da F22 (mês, ano ou período
 * personalizado).
 *
 * Agrupa as despesas do período em **categoria → dia → gasto**, cada gasto
 * com descrição, método de pagamento, cartão e parcela — a base do documento
 * imprimível "Despesas em detalhe".
 *
 * Motor puro: recebe os insumos crus (em centavos) e resolvers de rótulo
 * (injeção de dependência — sem import de Supabase/UI). A ordenação é
 * determinística: categorias por total desc, dias por data asc, gastos por
 * valor desc dentro do dia.
 */
export interface DetailedCloseExpenseInput {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  description: string | null;
  /** Chave crua do método de pagamento (resolvida pela UI). */
  paymentMethod: string | null;
  cardId: string | null;
  installmentsTotal: number;
  installmentNumber: number;
  /** Preenchido quando a despesa é parcela de um parcelamento. */
  installmentGroupId: string | null;
  categoryId: string;
  valueCents: number;
}

export interface DetailedCloseEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  paymentMethodLabel: string;
  cardName: string | null;
  /** Ex.: "2/3" — null quando não é parcela. */
  installmentLabel: string | null;
  valueCents: number;
}

export interface DetailedCloseDay {
  /** YYYY-MM-DD */
  date: string;
  /** Ex.: "12/08". */
  label: string;
  /** Ex.: "Terça". */
  weekdayLabel: string;
  totalCents: number;
  entries: DetailedCloseEntry[];
}

export interface DetailedCloseCategory {
  categoryId: string;
  name: string;
  totalCents: number;
  days: DetailedCloseDay[];
}

export interface DetailedCloseResolvers {
  /** Nome legível da categoria (ex.: "Alimentação"). */
  categoryName: (categoryId: string) => string;
  /** Nome do cartão ou null (pagamentos não-cartão). */
  cardName: (cardId: string) => string | null;
  /** Rótulo pt-BR do método de pagamento. */
  paymentMethodLabel: (method: string) => string;
  /** Nome do dia da semana a partir da data (YYYY-MM-DD). */
  weekdayLabel: (date: string) => string;
}

/** Formata YYYY-MM-DD como dd/mm (sem zeros à esquerda no dia/mês? — padrão pt-BR curto). */
function dayLabel(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${Number(day)}/${Number(month)}`;
}

/** Rótulo de parcela ("2/3") — null para lançamentos avulsos. */
function installmentLabel(input: DetailedCloseExpenseInput): string | null {
  if (input.installmentGroupId == null || input.installmentsTotal <= 1) return null;
  return `${input.installmentNumber}/${input.installmentsTotal}`;
}

/**
 * Monta o fechamento detalhado do período (mês/ano/custom — o período é
 * definido pela lista de despesas recebida). Ordenação determinística:
 * categorias por total desc → dias por data asc → gastos por valor desc.
 */
export function buildDetailedClose(
  expenses: readonly DetailedCloseExpenseInput[],
  resolvers: DetailedCloseResolvers,
): DetailedCloseCategory[] {
  // Agrupa por categoria.
  const byCategory = new Map<string, DetailedCloseExpenseInput[]>();
  for (const expense of expenses) {
    const list = byCategory.get(expense.categoryId) ?? [];
    list.push(expense);
    byCategory.set(expense.categoryId, list);
  }

  const categories: DetailedCloseCategory[] = [];
  for (const [categoryId, group] of byCategory) {
    // Agrupa por dia.
    const byDay = new Map<string, DetailedCloseExpenseInput[]>();
    for (const expense of group) {
      const list = byDay.get(expense.date) ?? [];
      list.push(expense);
      byDay.set(expense.date, list);
    }

    const days: DetailedCloseDay[] = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entries]) => {
        const sorted = [...entries].sort((a, b) => b.valueCents - a.valueCents);
        const totalCents = sorted.reduce((acc, e) => acc + e.valueCents, 0);
        return {
          date,
          label: dayLabel(date),
          weekdayLabel: resolvers.weekdayLabel(date),
          totalCents,
          entries: sorted.map((entry) => ({
            id: entry.id,
            date: entry.date,
            description: entry.description?.trim() || "Sem descrição",
            paymentMethodLabel: entry.paymentMethod
              ? resolvers.paymentMethodLabel(entry.paymentMethod)
              : "—",
            cardName: entry.cardId ? resolvers.cardName(entry.cardId) : null,
            installmentLabel: installmentLabel(entry),
            valueCents: entry.valueCents,
          })),
        };
      });

    categories.push({
      categoryId,
      name: resolvers.categoryName(categoryId),
      totalCents: days.reduce((acc, day) => acc + day.totalCents, 0),
      days,
    });
  }

  return categories.sort((a, b) => b.totalCents - a.totalCents);
}
