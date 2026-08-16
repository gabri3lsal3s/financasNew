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

/**
 * Resolve os ids de despesas afetados por uma exclusão no modo informado.
 * Se a despesa-alvo não for encontrada na lista (cache ainda não carregado),
 * retorna apenas o id informado — a invalidação pós-mutação corrige o cache.
 */
export function resolveExpenseDeleteIds(
  expenses: readonly Expense[],
  expenseId: string,
  mode: InstallmentDeleteMode,
): string[] {
  const target = expenses.find((expense) => expense.id === expenseId);
  const isInstallment =
    target != null && target.installments_total > 1 && target.installment_group_id != null;

  if (!target || !isInstallment || mode === "single") {
    return [expenseId];
  }

  const group = expenses.filter((expense) => expense.installment_group_id === target.installment_group_id);

  if (mode === "all") {
    return group.map((expense) => expense.id);
  }

  // mode === "subsequent" — esta parcela e as seguintes dentro do grupo.
  return group
    .filter((expense) => expense.installment_number >= target.installment_number)
    .map((expense) => expense.id);
}
