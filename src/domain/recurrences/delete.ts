/**
 * Resolução de exclusão em grupo de ocorrências — Fase 32.
 *
 * Espelho do `resolveExpenseDeleteIds` (domain/expenses) para recorrências:
 *   • `single` — apenas a ocorrência-alvo;
 *   • `all` — todas as ocorrências da mesma recorrência;
 *   • `subsequent` — a ocorrência-alvo e as seguintes (por `occurrenceNumber`).
 *
 * Usado pelas atualizações otimistas para filtrar as listas do cache. Se a
 * ocorrência-alvo não for encontrada (cache ainda não carregado), retorna
 * apenas o id informado — a invalidação pós-mutação corrige o cache.
 */

import type { InstallmentDeleteMode } from "@/types";
import type { RecurrenceOccurrence } from "./types";

export function resolveOccurrenceDeleteIds(
  occurrences: readonly RecurrenceOccurrence[],
  targetId: string,
  mode: InstallmentDeleteMode,
): string[] {
  const target = occurrences.find((occurrence) => occurrence.id === targetId);

  if (!target || mode === "single") {
    return [targetId];
  }

  const group = occurrences.filter((occurrence) => occurrence.recurrenceId === target.recurrenceId);

  if (mode === "all") {
    return group.map((occurrence) => occurrence.id);
  }

  // mode === "subsequent" — esta ocorrência e as seguintes (por número).
  return group
    .filter((occurrence) => occurrence.occurrenceNumber >= target.occurrenceNumber)
    .map((occurrence) => occurrence.id);
}
