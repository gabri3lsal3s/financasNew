/**
 * Regras de exclusão de despesas — ESPECIFICAÇÃO §3.2.2.
 *
 * `resolveExpenseDeleteIds` espelha no cliente o modo de exclusão do RPC
 * `delete_expense_installments` (validação canônica no servidor): single,
 * all (grupo inteiro) e subsequent (esta parcela e as seguintes). Usado
 * pelas atualizações otimistas para filtrar as listas do cache.
 *
 * Motor puro — testável isoladamente.
 */

import type { Expense, InstallmentDeleteMode } from "@/types";

/** Forma mínima de um lançamento parcelado (despesa ou renda — Fase 32). */
export interface InstallmentLike {
  id: string;
  installments_total: number;
  installment_number: number;
  installment_group_id: string | null;
}

/**
 * Resolve os ids afetados por uma exclusão no modo informado, para qualquer
 * lançamento parcelado (despesa ou renda — DRY Fase 32). Se o alvo não for
 * encontrado na lista (cache ainda não carregado), retorna apenas o id
 * informado — a invalidação pós-mutação corrige o cache.
 */
export function resolveInstallmentGroupDeleteIds(
  rows: readonly InstallmentLike[],
  targetId: string,
  mode: InstallmentDeleteMode,
): string[] {
  const target = rows.find((row) => row.id === targetId);
  const isInstallment =
    target != null && target.installments_total > 1 && target.installment_group_id != null;

  if (!target || !isInstallment || mode === "single") {
    return [targetId];
  }

  const group = rows.filter((row) => row.installment_group_id === target.installment_group_id);

  if (mode === "all") {
    return group.map((row) => row.id);
  }

  // mode === "subsequent" — esta parcela e as seguintes dentro do grupo.
  return group
    .filter((row) => row.installment_number >= target.installment_number)
    .map((row) => row.id);
}

/** Resolve os ids de despesas afetados por uma exclusão no modo informado. */
export function resolveExpenseDeleteIds(
  expenses: readonly Expense[],
  expenseId: string,
  mode: InstallmentDeleteMode,
): string[] {
  return resolveInstallmentGroupDeleteIds(expenses, expenseId, mode);
}
