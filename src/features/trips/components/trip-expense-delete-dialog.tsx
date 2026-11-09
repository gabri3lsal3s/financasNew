/**
 * Modal de confirmação e exclusão coordenada de despesa de viagem.
 * Suporta despesas vinculadas ao extrato pessoal (RPC delete_trip_expense_sync).
 * Respeita as regras de governança do AGENTS.md (Regras 4, 7, 8, 11, 15, 18 e 20).
 */

import { useState } from "react";
import { Link2 } from "lucide-react";
import {
  Modal,
  ModalFooter,
  Button,
  Badge,
  MoneyText,
  RadioGroup,
} from "@/components/ui";
import { useDeleteTripExpenseMutation } from "@/state/queries/use-trips";
import type { TripExpense } from "@/types/trips";

export interface TripExpenseDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  expense: TripExpense | null;
  onSuccess?: () => void;
}

type DeleteMode = "both" | "trip_only";

function TripExpenseDeleteDialogForm({
  open,
  onOpenChange,
  tripId,
  expense,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  expense: TripExpense;
  onSuccess?: () => void;
}) {
  const isLinked = Boolean(expense.linked_personal_expense_id);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>("both");
  const deleteMutation = useDeleteTripExpenseMutation(tripId);

  const handleConfirm = async () => {
    const deletePersonal = isLinked && deleteMode === "both";
    try {
      await deleteMutation.mutateAsync({
        expenseId: expense.id,
        deletePersonal,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // O erro já é tratado no onError da mutation (toast e sensory)
    }
  };

  const title = isLinked
    ? "Excluir despesa vinculada"
    : "Excluir despesa da viagem?";

  const description = isLinked
    ? "Esta despesa foi lançada no seu extrato pessoal. Escolha como deseja prosseguir com a exclusão:"
    : `Tem certeza de que deseja excluir a despesa "${expense.description}"? Os saldos da viagem serão recalculados automaticamente.`;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={title}
      description={description}
      footer={
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={deleteMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            sensoryIntent="destructive"
            onClick={() => void handleConfirm()}
          >
            {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4 py-1">
        <div className="rounded-xl border border-border/80 bg-surface/60 p-3 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {expense.description}
            </span>
            <MoneyText
              cents={expense.amount_cents}
              className="text-xs font-bold text-foreground shrink-0"
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate">
              <span>{expense.category_name}</span>
              <span>-</span>
              <span>{expense.expense_date}</span>
            </div>
            {isLinked ? (
              <Badge size="xs" variant="muted" className="gap-1 shrink-0">
                <Link2 className="size-3 text-muted-foreground" aria-hidden="true" />
                <span>Extrato pessoal</span>
              </Badge>
            ) : null}
          </div>
        </div>

        {isLinked ? (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground">
              Como deseja excluir?
            </span>
            <RadioGroup
              variant="cards"
              value={deleteMode}
              onValueChange={(val) => setDeleteMode(val as DeleteMode)}
              name="trip-expense-delete-mode"
              options={[
                {
                  value: "both",
                  label: "Excluir da viagem e do meu extrato pessoal",
                  description:
                    "Apaga a despesa da viagem e remove definitivamente o lançamento do seu extrato pessoal.",
                },
                {
                  value: "trip_only",
                  label: "Excluir apenas da viagem",
                  description:
                    "Desvincula a despesa e remove da viagem, mantendo o lançamento registrado no seu extrato pessoal.",
                },
              ]}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export function TripExpenseDeleteDialog(props: TripExpenseDeleteDialogProps) {
  if (!props.expense) return null;
  return (
    <TripExpenseDeleteDialogForm
      key={props.expense.id}
      {...props}
      expense={props.expense}
    />
  );
}
