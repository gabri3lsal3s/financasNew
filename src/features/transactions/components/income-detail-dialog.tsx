import { useRef, useState } from "react";
import { Copy, Pencil, Share2, Trash2 } from "lucide-react";
import { Alert, Button, Modal, ModalFooter } from "@/components/ui";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import type { Income, InstallmentDeleteMode } from "@/types";
import { IncomeDetailView } from "./income-detail-view";
import { IncomeEditForm } from "./income-edit-form";
import { TransactionDeleteScopeModal } from "./transaction-delete-scope-modal";
import { useIncomeDetailActions } from "./use-income-detail-actions";

export interface IncomeDetailDialogProps {
  income: Income | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEditing?: boolean;
}

/**
 * Detalhe da receita + edição completa + exclusão. Rendas automáticas
 * (source_ref, ex.: estorno [REFUND]) são somente-leitura (§3.1).
 */
export function IncomeDetailDialog(props: IncomeDetailDialogProps) {
  const [hasOpened, setHasOpened] = useState(props.open);
  if (props.open && !hasOpened) setHasOpened(true);
  if (!hasOpened) return null;
  return <IncomeDetailDialogContent {...props} />;
}

function IncomeDetailDialogContent({
  income,
  open,
  onOpenChange,
  initialEditing = false,
}: IncomeDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [prevOpen, setPrevOpen] = useState(open);
  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({ moduleKey: "transactions" });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mode, setMode] = useState<InstallmentDeleteMode>("single");
  const [editScope, setEditScope] = useState<InstallmentDeleteMode>("single");
  const [error, setError] = useState<string | null>(null);
  const editSubmitRef = useRef<(() => void) | null>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setIsEditing(isReadOnlyMode ? false : initialEditing);
  }

  const actions = useIncomeDetailActions({
    income,
    onOpenChange,
    mode,
    editScope,
    setError,
    setConfirmOpen,
    setIsEditing,
  });

  const resetAndClose = (next: boolean) => {
    setError(null);
    setIsEditing(false);
    setConfirmOpen(false);
    setEditScope("single");
    onOpenChange(next);
  };

  const footer = !income ? undefined : isEditing ? (
    <ModalFooter borderless>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setIsEditing(false);
          setError(null);
          setEditScope("single");
        }}
      >
        Cancelar
      </Button>
      <Button type="button" disabled={actions.editPending} onClick={() => editSubmitRef.current?.()}>
        {actions.editPending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </ModalFooter>
  ) : actions.isReadOnly ? (
    <ModalFooter borderless>
      <Button type="button" variant="outline" onClick={() => resetAndClose(false)}>
        Fechar
      </Button>
    </ModalFooter>
  ) : (
    <ModalFooter
      borderless
      destructiveAction={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-critical hover:bg-critical/10 hover:text-critical gap-1.5"
          onClick={() => guardAction(() => setConfirmOpen(true), "Excluir Receita")}
        >
          <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Excluir</span>
        </Button>
      }
    >
      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-8 !min-w-8 !w-8 p-0 shrink-0"
            onClick={() => void actions.handleShare()}
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
            onClick={() => guardAction(() => void actions.handleRepeat(), "Duplicar Receita")}
            disabled={actions.repeatPending}
            title="Repetir no mês atual"
            aria-label="Repetir no mês atual"
          >
            <Copy className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{actions.repeatPending ? "Repetindo…" : "Repetir no mês atual"}</span>
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => guardAction(() => setIsEditing(true), "Editar Receita")}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          <span>Editar</span>
        </Button>
      </div>
    </ModalFooter>
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={resetAndClose}
        title={isEditing ? "Editar receita" : "Detalhes da receita"}
        size={isEditing ? "xl" : "lg"}
        showCalculator={isEditing}
        footer={footer}
      >
        {income ? (
          <div className="flex flex-col gap-4 min-w-0">
            {error ? <Alert variant="error">{error}</Alert> : null}
            {isEditing ? (
              <IncomeEditForm
                key={income.id}
                income={income}
                categories={actions.categories}
                isPending={actions.editPending}
                grouped={actions.isGrouped}
                isRecurring={actions.isRecurring}
                scope={editScope}
                onScopeChange={setEditScope}
                submitRef={editSubmitRef}
                onSave={actions.handleSaveEdit}
              />
            ) : (
              <IncomeDetailView
                income={income}
                currentCategory={actions.currentCategory}
                isFamilyActive={actions.isFamilyActive}
                isReadOnly={actions.isReadOnly}
                isInstallment={actions.isInstallment}
                isRecurring={actions.isRecurring}
              />
            )}
          </div>
        ) : null}
      </Modal>

      <TransactionDeleteScopeModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir receita?"
        description="Esta ação não pode ser desfeita."
        confirmLabel={actions.deletePending ? "Excluindo…" : "Excluir"}
        confirmPending={actions.deletePending}
        onConfirm={() => void actions.handleConfirmDelete()}
        isGrouped={actions.isGrouped}
        isRecurring={actions.isRecurring}
        mode={mode}
        onModeChange={setMode}
      />

      {upgradeModal}
    </>
  );
}
