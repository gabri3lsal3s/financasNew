/**
 * Fontes únicas de regras compartilhadas dos insights (F19).
 *
 * Antes havia 3 listas sobrepostas de categorias essenciais/agregadoras e
 * implementações duplicadas de normalização e tolerância de valores:
 *   • `normalizeServiceName` (subscriptions) vs `normalizeKey` (recurrences);
 *   • `hasStableValue` (±5%) vs `hasValuesWithin` (tolerância param);
 *   • `ESSENTIAL_CATEGORIES` (subscriptions) ∪ `AGGREGATING_CATEGORY_ICONS`
 *     (recurrences) duplicadas em `isEssentialIcon` (InsightsPage).
 * Tudo unificado aqui — uma única implementação, testada (testes de unificação).
 */

/** Essenciais (nunca cortáveis — subscriptions) ∪ agregadoras (excluídas da detecção `similar` — recurrences). */
export const ESSENTIAL_CATEGORY_ICONS = new Set([
  // Essenciais (§3.7.2 — tier `essential` por categoria).
  "moradia",
  "saude",
  "educacao",
  // Agregadoras (§3.7.3 — excluídas da detecção `similar`).
  "mercado",
  "supermercado",
  "combustivel",
  "transporte",
  "farmacia",
]);

/**
 * Normalização canônica de texto: minúsculas, sem acentos, espaços
 * colapsados e aparados. Unifica `normalizeServiceName`/`normalizeKey`.
 */
export function normalizeText(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove tudo que não for letra/número — usado pelo catálogo de serviços. */
export function normalizeServiceKey(name: string): string {
  return normalizeText(name).replace(/[^a-z0-9]/g, "");
}

/**
 * Todos os valores dentro da tolerância relativa ao primeiro.
 * Unifica `hasStableValue`/`hasValuesWithin` — uma única verificação.
 */
export function valuesWithinTolerance(values: readonly number[], tolerance: number): boolean {
  if (values.length < 2) return false;
  const base = values[0] ?? 0;
  if (base <= 0) return false;
  return values.every((value) => Math.abs(value - base) / base <= tolerance);
}
