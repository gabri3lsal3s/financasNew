import { useState } from "react";
import { Button, MoneyText } from "@/components/ui";
import { suggestCategory, suggestLimitCents } from "@/domain/budgets";
import { monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useRemoveBudgetLimit, useSetBudgetLimit } from "@/state";
import type { Category } from "@/types";
import { GoalOrLimitDialog } from "./goal-or-limit-dialog";

export interface LimitDialogProps {
  category: Category;
  /** Mês do orçamento (YYYY-MM). */
  month: string;
  /** Limite efetivo (com herança) em centavos. */
  currentLimitCents: number;
  /** O limite atual veio de herança do mês anterior? */
  inherited: boolean;
  /** Renda do mês (centavos) — base da sugestão por % da renda. */
  monthlyIncomeCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Permite abrir o formulário cadastral da categoria (nome, cor, ícone). */
  onEditCategory?: (category: Category) => void;
}

function LimitDialogContent({
  category,
  month,
  currentLimitCents,
  inherited,
  monthlyIncomeCents,
  open,
  onOpenChange,
  onEditCategory,
}: LimitDialogProps) {
  const [cents, setCents] = useState(currentLimitCents);
  const [error, setError] = useState<string | null>(null);

  const setLimit = useSetBudgetLimit();
  const removeLimit = useRemoveBudgetLimit();
  const pending = setLimit.isPending || removeLimit.isPending;

  const rule = suggestCategory(category.name);
  const suggestionCents = rule ? suggestLimitCents(monthlyIncomeCents, rule.limitPercent) : 0;

  const handleSave = async () => {
    setError(null);
    try {
      await setLimit.mutateAsync({
        categoryId: category.id,
        month,
        limit: cents <= 0 ? 0 : cents / 100,
      });
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
      if (inherited) {
        await setLimit.mutateAsync({ categoryId: category.id, month, limit: 0 });
      } else {
        await removeLimit.mutateAsync({ categoryId: category.id, month });
      }
      triggerSensory("destructive");
      onOpenChange(false);
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  const formattedMonth = monthLabel(month);
  const saveLabel = cents === 0 ? "Salvar sem limite" : "Salvar limite";

  return (
    <GoalOrLimitDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Limite — ${category.name}`}
      description={`${formattedMonth}${
        inherited
          ? " · herdado do mês anterior (ao salvar ou remover, aplica-se a este mês)"
          : currentLimitCents === 0
            ? " · sem limite configurado"
            : ""
      }`}
      inputId="limit-amount"
      amountLabel="Limite mensal"
      inputAriaLabel="Limite mensal da categoria"
      statusNote={currentLimitCents === 0 ? "Categoria sem limite ativo" : undefined}
      helperText={
        cents === 0
          ? "Ao salvar com valor R$ 0,00, a categoria fica livre de orçamento neste mês."
          : "Defina o valor máximo que você planeja gastar com esta categoria no mês."
      }
      cents={cents}
      onCentsChange={setCents}
      error={error}
      pending={pending}
      saveLabel={saveLabel}
      saveAriaLabel={pending ? "Salvando…" : saveLabel}
      canRemove={currentLimitCents > 0}
      removeLabel={inherited ? "Deixar sem limite" : "Remover limite"}
      onSave={() => void handleSave()}
      onRemove={() => void handleRemove()}
      category={category}
      onEditCategory={onEditCategory}
      extraContent={
        rule && suggestionCents > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface-raised p-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Sugestão ({rule.limitPercent}% da renda)</p>
              <p className="text-[11px] text-muted-foreground">
                Com base na renda de{" "}
                <MoneyText cents={monthlyIncomeCents} tone="default" className="text-xs" /> deste
                mês.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent="selection"
              onClick={() => setCents(suggestionCents)}
            >
              Aplicar <MoneyText cents={suggestionCents} tone="default" className="text-xs" />
            </Button>
          </div>
        ) : null
      }
    />
  );
}

/** Edição do limite mensal de uma categoria (§3.5.2) com sugestão inteligente. */
export function LimitDialog(props: LimitDialogProps) {
  if (!props.open) return null;

  return <LimitDialogContent key={`${props.category.id}:${props.month}`} {...props} />;
}
