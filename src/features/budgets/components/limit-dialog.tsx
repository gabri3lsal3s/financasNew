import { useState } from "react";
import { Edit2 } from "lucide-react";
import { Alert, Button, Modal, ModalFooter, MoneyInput } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { suggestCategory, suggestLimitCents } from "@/domain/budgets";
import { getErrorMessage } from "@/services/errors";
import { useRemoveBudgetLimit, useSetBudgetLimit } from "@/state";
import type { Category } from "@/types";

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

interface LimitDialogContentProps {
  category: Category;
  month: string;
  currentLimitCents: number;
  inherited: boolean;
  monthlyIncomeCents: number;
  onClose: () => void;
  onEditCategory?: (category: Category) => void;
}

function LimitDialogContent({
  category,
  month,
  currentLimitCents,
  inherited,
  monthlyIncomeCents,
  onClose,
  onEditCategory,
}: LimitDialogContentProps) {
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
      if (cents <= 0) {
        // Salvar zero explícito para remover o limite e quebrar herança (§3.5.2)
        await setLimit.mutateAsync({ categoryId: category.id, month, limit: 0 });
      } else {
        await setLimit.mutateAsync({ categoryId: category.id, month, limit: cents / 100 });
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleRemove = async () => {
    setError(null);
    try {
      if (inherited) {
        // Se veio herdado do mês anterior, salvar limite 0 neste mês quebra a herança
        await setLimit.mutateAsync({ categoryId: category.id, month, limit: 0 });
      } else {
        // Se era próprio deste mês, remove o registro
        await removeLimit.mutateAsync({ categoryId: category.id, month });
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) {
          void handleSave();
        }
      }}
      className="mt-4 flex flex-col gap-4"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="limit-amount" className="text-xs font-semibold text-foreground">
            Limite mensal
          </label>
          {currentLimitCents === 0 && (
            <span className="text-[11px] text-muted-foreground font-medium">
              Categoria sem limite ativo
            </span>
          )}
        </div>
        <MoneyInput id="limit-amount" cents={cents} onCentsChange={setCents} aria-label="Limite mensal da categoria" />
        <p className="text-[11px] text-muted-foreground">
          {cents === 0
            ? "Ao salvar com valor R$ 0,00, a categoria fica livre de orçamento neste mês."
            : "Defina o valor máximo que você planeja gastar com esta categoria no mês."}
        </p>
      </div>

      {rule && suggestionCents > 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
          <div>
            <p className="font-medium text-foreground">Sugestão ({rule.limitPercent}% da renda)</p>
            <p className="text-[11px] text-muted-foreground">
              Com base na renda de <MoneyText cents={monthlyIncomeCents} tone="default" className="privacy-mask text-xs" /> deste mês.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCents(suggestionCents)}
          >
            Aplicar <MoneyText cents={suggestionCents} tone="default" className="privacy-mask" />
          </Button>
        </div>
      ) : null}

      {onEditCategory ? (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 px-0"
            onClick={() => {
              onClose();
              onEditCategory(category);
            }}
          >
            <Edit2 className="size-3.5" aria-hidden="true" />
            <span>Editar detalhes da categoria (nome, cor, ícone)</span>
          </Button>
        </div>
      ) : null}

      <ModalFooter
        destructiveAction={
          currentLimitCents > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="text-critical hover:text-critical"
              onClick={() => void handleRemove()}
              disabled={pending}
            >
              {inherited ? "Deixar sem limite" : "Remover limite"}
            </Button>
          ) : null
        }
      >
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={pending}
          aria-label={
            pending
              ? "Salvando…"
              : cents === 0
                ? "Salvar sem limite"
                : "Salvar limite"
          }
        >
          {pending ? (
            "Salvando…"
          ) : (
            <>
              <span className="hidden sm:inline">
                {cents === 0 ? "Salvar sem limite" : "Salvar limite"}
              </span>
              <span className="sm:hidden">Salvar</span>
            </>
          )}
        </Button>
      </ModalFooter>
    </form>
  );
}

/** Edição do limite mensal de uma categoria (§3.5.2) com sugestão inteligente. */
export function LimitDialog({
  category,
  month,
  currentLimitCents,
  inherited,
  monthlyIncomeCents,
  open,
  onOpenChange,
  onEditCategory,
}: LimitDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Limite — ${category.name}`}
      description={`Mês ${month}${inherited ? " · herdado do mês anterior (ao salvar ou remover, aplica-se a este mês)" : currentLimitCents === 0 ? " · sem limite configurado" : ""}`}
      size="md"
      showCalculator
    >
      {open ? (
        <LimitDialogContent
          key={`${category.id}:${month}`}
          category={category}
          month={month}
          currentLimitCents={currentLimitCents}
          inherited={inherited}
          monthlyIncomeCents={monthlyIncomeCents}
          onClose={() => onOpenChange(false)}
          onEditCategory={onEditCategory}
        />
      ) : null}
    </Modal>
  );
}

