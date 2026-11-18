import { useState } from "react";
import { monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useRemoveIncomeGoal, useSetIncomeGoal } from "@/state";
import type { Category } from "@/types";
import { GoalOrLimitDialog } from "./goal-or-limit-dialog";

export interface IncomeGoalDialogProps {
  category: Category;
  /** Mês da meta (YYYY-MM). */
  month: string;
  /** Meta atual em centavos. */
  currentExpectedCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Permite abrir o formulário cadastral da categoria (nome, cor, ícone). */
  onEditCategory?: (category: Category) => void;
}

function IncomeGoalDialogContent({
  category,
  month,
  currentExpectedCents,
  open,
  onOpenChange,
  onEditCategory,
}: IncomeGoalDialogProps) {
  const [cents, setCents] = useState(currentExpectedCents);
  const [error, setError] = useState<string | null>(null);

  const setGoal = useSetIncomeGoal();
  const removeGoal = useRemoveIncomeGoal();
  const pending = setGoal.isPending || removeGoal.isPending;

  const handleSave = async () => {
    setError(null);
    if (cents <= 0) return;
    try {
      await setGoal.mutateAsync({ categoryId: category.id, month, expected: cents / 100 });
      triggerSensory("success");
      onOpenChange(false);
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  const handleRemove = async () => {
    setError(null);
    try {
      await removeGoal.mutateAsync({ categoryId: category.id, month });
      triggerSensory("destructive");
      onOpenChange(false);
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  const formattedMonth = monthLabel(month);

  return (
    <GoalOrLimitDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Meta de Renda — ${category.name}`}
      description={`Definição para ${formattedMonth}`}
      inputId="goal-amount"
      amountLabel="Expectativa de renda mensal"
      inputAriaLabel="Expectativa de renda mensal da categoria"
      inputPlaceholder="Ex.: R$ 5.000,00"
      helperText={`Define quanto você planeja receber nesta categoria em ${formattedMonth}.`}
      cents={cents}
      onCentsChange={setCents}
      error={error}
      pending={pending}
      saveDisabled={cents <= 0}
      saveLabel="Salvar meta"
      saveAriaLabel={pending ? "Salvando…" : "Salvar meta"}
      canRemove={currentExpectedCents > 0}
      removeLabel="Remover meta"
      onSave={() => void handleSave()}
      onRemove={() => void handleRemove()}
      category={category}
      onEditCategory={onEditCategory}
    />
  );
}

/** Edição da meta de renda de uma categoria (§3.5.3). */
export function IncomeGoalDialog(props: IncomeGoalDialogProps) {
  if (!props.open) return null;

  return <IncomeGoalDialogContent key={`${props.category.id}:${props.month}`} {...props} />;
}
