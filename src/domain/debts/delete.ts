/**
 * Resolução de IDs para exclusão em lote de dívidas / parcelas.
 *
 * Espelha no cliente as regras da RPC `delete_debt_installments`
 * para atualizações otimistas e consistência de domínio.
 *
 * Motor puro — sem import de UI/Supabase.
 */

import type { InstallmentDeleteMode } from "@/types";

export interface DebtLike {
  id: string;
  due_date: string;
  installment_group_id: string | null;
}

/**
 * Resolve os IDs de dívidas afetadas pela exclusão com base no modo selecionado.
 *
 * - `single`: apenas a dívida alvo
 * - `all`: todas as dívidas com o mesmo `installment_group_id`
 * - `subsequent`: todas as dívidas do mesmo grupo com data de vencimento igual ou posterior
 */
export function resolveDebtDeleteIds(
  debts: readonly DebtLike[],
  targetId: string,
  mode: InstallmentDeleteMode,
): string[] {
  const target = debts.find((d) => d.id === targetId);
  if (!target || !target.installment_group_id || mode === "single") {
    return [targetId];
  }

  const group = debts.filter((d) => d.installment_group_id === target.installment_group_id);
  if (group.length <= 1) {
    return [targetId];
  }

  if (mode === "all") {
    return group.map((d) => d.id);
  }

  // mode === "subsequent" — esta e as próximas parcelas
  return group
    .filter((d) => d.due_date >= target.due_date)
    .map((d) => d.id);
}
