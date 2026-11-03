/**
 * Motor Puro de Distribuição e Normalização de Percentuais (Padrão ANBIMA / Hamilton-Hare).
 *
 * Aplica o Método do Maior Resto (Largest Remainder Method / Algoritmo de Hamilton)
 * para assegurar que a soma visual de fatias ou alocações de uma totalidade feche
 * rigorosamente em 100,0% (ou 100%), eliminando discrepâncias causadas por arredondamentos
 * pontuais isolados (ex: 99,9% ou 100,1%).
 *
 * Módulo de domínio puro — sem dependências de UI ou estado.
 */

export interface NormalizedPercentageItem {
  rawPct: number;
}

export type NormalizedResult<T extends NormalizedPercentageItem> = T & {
  formattedPct: number;
  displayPctStr: string;
};

/**
 * Normaliza os percentuais de uma coleção de itens para que a soma feche exatamente em 100,0%.
 *
 * @param items Coleção de itens contendo rawPct.
 * @param decimals Quantidade de casas decimais para o percentual (padrão: 1, ou seja, 0,1%).
 */
export function normalizePercentagesTo100<T extends NormalizedPercentageItem>(
  items: readonly T[],
  decimals = 1,
): NormalizedResult<T>[] {
  if (items.length === 0) return [];

  const multiplier = Math.pow(10, decimals);
  const targetUnits = 100 * multiplier;

  const rawSum = items.reduce((acc, item) => acc + (item.rawPct > 0 ? item.rawPct : 0), 0);

  if (rawSum <= 0) {
    return items.map((item) => ({
      ...item,
      formattedPct: 0,
      displayPctStr: (0).toFixed(decimals).replace(".", ",") + "%",
    }));
  }

  // 1. Calcula proporções escalonadas e separa partes inteiras e restos
  interface TempItem {
    originalIndex: number;
    item: T;
    scaledUnits: number;
    integerPart: number;
    remainder: number;
  }

  const tempItems: TempItem[] = items.map((item, originalIndex) => {
    const proportionalPct = (Math.max(0, item.rawPct) / rawSum) * 100;
    const scaledUnits = proportionalPct * multiplier;
    const integerPart = Math.floor(scaledUnits);
    const remainder = scaledUnits - integerPart;

    return {
      originalIndex,
      item,
      scaledUnits,
      integerPart,
      remainder,
    };
  });

  // 2. Calcula déficit residual
  const sumIntegers = tempItems.reduce((acc, t) => acc + t.integerPart, 0);
  let deficit = Math.round(targetUnits - sumIntegers);

  // 3. Ordena pelos maiores restos para distribuir o déficit de centésimos
  const sortedByRemainder = [...tempItems].sort((a, b) => {
    const diff = b.remainder - a.remainder;
    if (Math.abs(diff) > 1e-9) return diff;
    return a.originalIndex - b.originalIndex;
  });

  const allocatedUnits = new Map<number, number>();
  for (const t of tempItems) {
    allocatedUnits.set(t.originalIndex, t.integerPart);
  }

  // Distribui as unidades residuais para os maiores restos
  for (let i = 0; i < sortedByRemainder.length && deficit > 0; i++) {
    const candidate = sortedByRemainder[i];
    if (candidate) {
      allocatedUnits.set(candidate.originalIndex, (allocatedUnits.get(candidate.originalIndex) ?? 0) + 1);
      deficit--;
    }
  }

  // Se deficit for negativo (em caso atípico de overflow), remove dos menores restos
  if (deficit < 0) {
    const sortedAsc = [...sortedByRemainder].reverse();
    for (let i = 0; i < sortedAsc.length && deficit < 0; i++) {
      const candidate = sortedAsc[i];
      if (candidate && (allocatedUnits.get(candidate.originalIndex) ?? 0) > 0) {
        allocatedUnits.set(candidate.originalIndex, (allocatedUnits.get(candidate.originalIndex) ?? 0) - 1);
        deficit++;
      }
    }
  }

  // 4. Mapeia de volta na ordem original com invariante garantido
  return items.map((item, index) => {
    const units = allocatedUnits.get(index) ?? 0;
    const formattedPct = Math.round((units / multiplier) * multiplier) / multiplier;
    const displayPctStr = formattedPct.toFixed(decimals).replace(".", ",") + "%";

    return {
      ...item,
      formattedPct,
      displayPctStr,
    };
  });
}
