/**
 * Motor de Ajuste Proporcional do Orçamento Global (§Tarefa 09).
 *
 * Função pura sem dependências de UI ou infraestrutura:
 *   • Permite ajuste por percentual (+/- X%) ou por valor total pretendido;
 *   • Redistribui proporcionalmente entre as categorias: Novo = Atual * (1 + delta%);
 *   • Realiza ajuste fino de centavos na soma final pelo método dos maiores restos (Hamilton-Hare),
 *     assegurando que sum(novosLimites) === novoTotal exato.
 */

export interface ProportionalCategoryInput {
  categoryId: string;
  name?: string;
  /** Limite atual em centavos (inteiro ≥ 0). */
  currentLimitCents: number;
}

export interface ProportionalCategoryOutput {
  categoryId: string;
  name?: string;
  currentLimitCents: number;
  newLimitCents: number;
  diffCents: number;
}

export interface ProportionalBudgetResult {
  totalCurrentCents: number;
  totalNewCents: number;
  diffCents: number;
  deltaPercent: number;
  items: ProportionalCategoryOutput[];
}

/**
 * Calcula a redistribuição proporcional do orçamento pelo valor total pretendido.
 * Utiliza o método dos maiores restos (Hamilton-Hare) para garantir que a soma dos novos
 * limites seja rigorosamente igual a targetTotalCents, sem discrepância de centavos.
 */
export function redistributeProportionalBudget(
  categories: readonly ProportionalCategoryInput[],
  targetTotalCents: number,
): ProportionalBudgetResult {
  const safeTargetTotal = Math.max(0, Math.round(targetTotalCents));
  const totalCurrentCents = categories.reduce((acc, c) => acc + Math.max(0, c.currentLimitCents), 0);

  if (categories.length === 0) {
    return {
      totalCurrentCents: 0,
      totalNewCents: safeTargetTotal,
      diffCents: safeTargetTotal,
      deltaPercent: 0,
      items: [],
    };
  }

  const deltaPercent =
    totalCurrentCents > 0
      ? ((safeTargetTotal - totalCurrentCents) / totalCurrentCents) * 100
      : 0;

  // Caso especial: todos os limites atuais são zero
  if (totalCurrentCents === 0) {
    if (safeTargetTotal === 0) {
      return {
        totalCurrentCents: 0,
        totalNewCents: 0,
        diffCents: 0,
        deltaPercent: 0,
        items: categories.map((c) => ({
          categoryId: c.categoryId,
          name: c.name,
          currentLimitCents: 0,
          newLimitCents: 0,
          diffCents: 0,
        })),
      };
    }

    // Divisão igualitária com distribuição de centavos restantes
    const baseShare = Math.floor(safeTargetTotal / categories.length);
    const remainder = safeTargetTotal - baseShare * categories.length;

    const items: ProportionalCategoryOutput[] = categories.map((c, index) => {
      const extra = index < remainder ? 1 : 0;
      const newLimit = baseShare + extra;
      return {
        categoryId: c.categoryId,
        name: c.name,
        currentLimitCents: 0,
        newLimitCents: newLimit,
        diffCents: newLimit,
      };
    });

    return {
      totalCurrentCents: 0,
      totalNewCents: safeTargetTotal,
      diffCents: safeTargetTotal,
      deltaPercent: 0,
      items,
    };
  }

  // Proporcionalidade padrão: Hamilton-Hare (maiores restos)
  interface AllocationItem {
    index: number;
    categoryId: string;
    name?: string;
    currentLimitCents: number;
    base: number;
    fraction: number;
  }

  const allocations: AllocationItem[] = categories.map((c, index) => {
    const current = Math.max(0, c.currentLimitCents);
    const exact = (current * safeTargetTotal) / totalCurrentCents;
    const base = Math.floor(exact);
    const fraction = exact - base;
    return {
      index,
      categoryId: c.categoryId,
      name: c.name,
      currentLimitCents: current,
      base,
      fraction,
    };
  });

  const sumBase = allocations.reduce((acc, a) => acc + a.base, 0);
  const remainder = safeTargetTotal - sumBase;

  // Ordena por maior fração para distribuir os centavos restantes
  const sorted = [...allocations].sort((a, b) => {
    if (Math.abs(b.fraction - a.fraction) > 1e-9) {
      return b.fraction - a.fraction;
    }
    if (b.currentLimitCents !== a.currentLimitCents) {
      return b.currentLimitCents - a.currentLimitCents;
    }
    return a.index - b.index;
  });

  const extraCents = new Map<number, number>();
  for (let i = 0; i < remainder && i < sorted.length; i++) {
    const item = sorted[i];
    if (item) {
      extraCents.set(item.index, (extraCents.get(item.index) ?? 0) + 1);
    }
  }

  const items: ProportionalCategoryOutput[] = allocations.map((a) => {
    const extra = extraCents.get(a.index) ?? 0;
    const newLimit = a.base + extra;
    return {
      categoryId: a.categoryId,
      name: a.name,
      currentLimitCents: a.currentLimitCents,
      newLimitCents: newLimit,
      diffCents: newLimit - a.currentLimitCents,
    };
  });

  return {
    totalCurrentCents,
    totalNewCents: safeTargetTotal,
    diffCents: safeTargetTotal - totalCurrentCents,
    deltaPercent,
    items,
  };
}

/**
 * Calcula a redistribuição proporcional do orçamento a partir de uma variação percentual (+/- X%).
 */
export function redistributeProportionalBudgetByPercent(
  categories: readonly ProportionalCategoryInput[],
  deltaPercent: number,
): ProportionalBudgetResult {
  const totalCurrentCents = categories.reduce((acc, c) => acc + Math.max(0, c.currentLimitCents), 0);
  const targetTotalCents = Math.max(0, Math.round(totalCurrentCents * (1 + deltaPercent / 100)));
  return redistributeProportionalBudget(categories, targetTotalCents);
}
