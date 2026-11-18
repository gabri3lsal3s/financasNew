import { Copy, Pencil, Plane, Share2, Trash2, Users } from "lucide-react";
import { Button, ModalFooter } from "@/components/ui";
import type { Expense } from "@/types";

export interface ExpenseDetailFooterProps {
  expense: Expense | null;
  isEditing: boolean;
  editPending: boolean;
  repeatPending: boolean;
  onCancelEdit: () => void;
  onSubmitEdit: () => void;
  onGoToTrip: (tripId: string) => void;
  onSplit: () => void;
  onShare: () => void;
  onRepeat: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}

/** Rodapé canônico do modal de detalhe/edição de despesa. */
export function ExpenseDetailFooter({
  expense,
  isEditing,
  editPending,
  repeatPending,
  onCancelEdit,
  onSubmitEdit,
  onGoToTrip,
  onSplit,
  onShare,
  onRepeat,
  onStartEdit,
  onDelete,
}: ExpenseDetailFooterProps) {
  if (!expense) return null;

  if (isEditing) {
    return (
      <ModalFooter borderless>
        <Button type="button" variant="outline" onClick={onCancelEdit}>
          Cancelar
        </Button>
        <Button type="button" disabled={editPending} onClick={onSubmitEdit}>
          {editPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </ModalFooter>
    );
  }

  return (
    <ModalFooter
      borderless
      destructiveAction={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-critical hover:bg-critical/10 hover:text-critical gap-1.5"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Excluir</span>
        </Button>
      }
    >
      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          {expense.trip_id ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-8 !min-w-8 !w-8 p-0 shrink-0 border-portfolio/40 text-portfolio hover:bg-portfolio/10"
              onClick={() => onGoToTrip(expense.trip_id!)}
              title="Ver esta despesa no Modo Viagem"
              aria-label="Na Viagem"
            >
              <Plane className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Na Viagem</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-8 !min-w-8 !w-8 p-0 shrink-0"
              onClick={onSplit}
              title="Rachar despesa"
              aria-label="Rachar"
            >
              <Users className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Rachar</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-8 !min-w-8 !w-8 p-0 shrink-0"
            onClick={onShare}
            title="Compartilhar comprovante"
            aria-label="Compartilhar"
          >
            <Share2 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Compartilhar</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-8 !min-w-8 !w-8 p-0 shrink-0"
            onClick={onRepeat}
            disabled={repeatPending}
            title="Repetir no mês atual"
            aria-label="Repetir no mês atual"
          >
            <Copy className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{repeatPending ? "Repetindo…" : "Repetir no mês atual"}</span>
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 flex-1 min-w-0 sm:flex-initial sm:w-auto sm:min-w-[100px]"
          onClick={onStartEdit}
        >
          <Pencil className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Editar</span>
        </Button>
      </div>
    </ModalFooter>
  );
}
