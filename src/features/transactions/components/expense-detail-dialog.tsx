import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Modal } from "@/components/ui";
import { SplitExpenseDialog } from "@/components/modules/split-expense-dialog";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import type { Expense, InstallmentDeleteMode } from "@/types";
import { ExpenseDetailFooter } from "./expense-detail-footer";
import { ExpenseDetailView } from "./expense-detail-view";
import { ExpenseEditForm } from "./expense-edit-form";
import { TransactionDeleteScopeModal } from "./transaction-delete-scope-modal";
import type { TripDeleteMode } from "./transaction-group-constants";
import { useExpenseDetailActions } from "./use-expense-detail-actions";

export interface ExpenseDetailDialogProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEditing?: boolean;
}

/** Detalhe da despesa + edição completa com troca de categoria + exclusão coordenada. */
export function ExpenseDetailDialog(props: ExpenseDetailDialogProps) {
  const [hasOpened, setHasOpened] = useState(props.open);
  if (props.open && !hasOpened) setHasOpened(true);
  if (!hasOpened) return null;
  return <ExpenseDetailDialogContent {...props} />;
}

function ExpenseDetailDialogContent({
  expense,
  open,
  onOpenChange,
  initialEditing = false,
}: ExpenseDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [prevOpen, setPrevOpen] = useState(open);
  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({ moduleKey: "transactions" });
  const navigate = useNavigate();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [mode, setMode] = useState<InstallmentDeleteMode>("single");
  const [editScope, setEditScope] = useState<InstallmentDeleteMode>("single");
  const [tripDeleteMode, setTripDeleteMode] = useState<TripDeleteMode>("both");
  const [error, setError] = useState<string | null>(null);
  const editSubmitRef = useRef<(() => void) | null>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setIsEditing(isReadOnlyMode ? false : initialEditing);
  }

  const actions = useExpenseDetailActions({
    expense,
    open,
    onOpenChange,
    mode,
    editScope,
    tripDeleteMode,
    setError,
    setConfirmOpen,
    setIsEditing,
  });

  const resetAndClose = (next: boolean) => {
    setError(null);
    setIsEditing(false);
    setConfirmOpen(false);
    setEditScope("single");
    setTripDeleteMode("both");
    onOpenChange(next);
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={resetAndClose}
        title={isEditing ? "Editar despesa" : "Detalhes da despesa"}
        size={isEditing ? "xl" : "lg"}
        showCalculator={isEditing}
        footer={
          <ExpenseDetailFooter
            expense={expense}
            isEditing={isEditing}
            editPending={actions.editPending}
            repeatPending={actions.repeatPending}
            onCancelEdit={() => {
              setIsEditing(false);
              setError(null);
              setEditScope("single");
            }}
            onSubmitEdit={() => editSubmitRef.current?.()}
            onGoToTrip={(tripId) => {
              onOpenChange(false);
              navigate(`/viagens/${tripId}`);
            }}
            onSplit={() => guardAction(() => setSplitOpen(true), "Rachar Despesa")}
            onShare={() => void actions.handleShare()}
            onRepeat={() => guardAction(() => void actions.handleRepeat(), "Duplicar Despesa")}
            onStartEdit={() => guardAction(() => setIsEditing(true), "Editar Despesa")}
            onDelete={() => guardAction(() => setConfirmOpen(true), "Excluir Despesa")}
          />
        }
      >
        {expense ? (
          <div className="flex flex-col gap-4 min-w-0">
            {error ? <Alert variant="error">{error}</Alert> : null}
            {isEditing ? (
              <ExpenseEditForm
                key={expense.id}
                expense={expense}
                categories={actions.categories}
                cards={actions.cards}
                isPending={actions.editPending}
                grouped={actions.isGrouped}
                isRecurring={actions.isRecurring}
                scope={editScope}
                onScopeChange={setEditScope}
                submitRef={editSubmitRef}
                onSave={actions.handleSaveEdit}
              />
            ) : (
              <ExpenseDetailView
                expense={expense}
                currentCategory={actions.currentCategory}
                isFamilyActive={actions.isFamilyActive}
                isInstallment={actions.isInstallment}
                isRecurring={actions.isRecurring}
                priceEvolution={actions.priceEvolution}
              />
            )}
          </div>
        ) : null}
      </Modal>

      {splitOpen && expense ? (
        <SplitExpenseDialog
          open={splitOpen}
          onOpenChange={setSplitOpen}
          expense={expense}
          categoryName={actions.currentCategory?.name}
          categoryIcon={actions.currentCategory?.icon ?? undefined}
        />
      ) : null}

      <TransactionDeleteScopeModal
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (next) setTripDeleteMode("both");
        }}
        title={
          actions.isRachaExpense
            ? "Excluir despesa e racha vinculado?"
            : expense?.trip_id
              ? "Excluir despesa vinculada?"
              : "Excluir despesa?"
        }
        description={
          expense?.trip_id
            ? "Esta despesa está vinculada ao Modo Viagem. Escolha como deseja prosseguir com a exclusão:"
            : actions.isRachaExpense
              ? "Esta ação não pode ser desfeita e cancelará o racha vinculado."
              : actions.isGrouped
                ? "A exclusão remove também as dívidas pendentes vinculadas. Dívidas quitadas não são alteradas."
                : "Esta ação não pode ser desfeita. Dívidas pendentes vinculadas também serão removidas."
        }
        confirmLabel={actions.deletePending ? "Excluindo…" : "Excluir"}
        confirmPending={actions.deletePending}
        onConfirm={() => void actions.handleConfirmDelete()}
        isRachaExpense={actions.isRachaExpense}
        tripId={expense?.trip_id}
        tripName={actions.tripName}
        tripDeleteMode={tripDeleteMode}
        onTripDeleteModeChange={setTripDeleteMode}
        isGrouped={actions.isGrouped}
        isRecurring={actions.isRecurring}
        mode={mode}
        onModeChange={setMode}
      />

      {upgradeModal}
    </>
  );
}
