import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Modal } from "@/components/ui";
import { ManageSplitDialog } from "@/components/modules/manage-split-dialog";
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
  const [manageSplitOpen, setManageSplitOpen] = useState(false);
  const [convertToSplit, setConvertToSplit] = useState(false);
  const [splitSeedExpense, setSplitSeedExpense] = useState<Expense | null>(null);
  const [mode, setMode] = useState<InstallmentDeleteMode>("single");
  const [editScope, setEditScope] = useState<InstallmentDeleteMode>("single");
  const [tripDeleteMode, setTripDeleteMode] = useState<TripDeleteMode>("both");
  const [error, setError] = useState<string | null>(null);
  const editSubmitRef = useRef<(() => void) | null>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsEditing(isReadOnlyMode ? false : initialEditing);
      setConvertToSplit(false);
      setSplitSeedExpense(null);
    }
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
    onRequestOpenSplit: (updatedExpense) => {
      setSplitSeedExpense(updatedExpense);
      setConvertToSplit(false);
      setSplitOpen(true);
    },
  });

  const resetAndClose = (next: boolean) => {
    setError(null);
    setIsEditing(false);
    setConfirmOpen(false);
    setConvertToSplit(false);
    setEditScope("single");
    setTripDeleteMode("both");
    onOpenChange(next);
  };

  const handleOpenCreateSplit = () =>
    guardAction(() => {
      setSplitSeedExpense(null);
      setSplitOpen(true);
    }, "Rachar Despesa");

  const handleOpenManageSplit = () =>
    guardAction(() => {
      setManageSplitOpen(true);
    }, "Gerenciar Racha");

  const activeSplitExpense = splitSeedExpense ?? expense;
  const activeSplitAmountCents =
    splitSeedExpense && actions.groupExpenses.length <= 1
      ? Math.round(splitSeedExpense.value * 100)
      : actions.groupTotalCents;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={resetAndClose}
        confirmDiscard={isEditing}
        isDirty={isEditing}
        onDiscard={() => resetAndClose(false)}
        discardTitle="Descartar edição da despesa?"
        discardDescription="Você está no modo de edição deste lançamento. Se sair agora, as alterações não salvas serão descartadas."
        title={isEditing ? "Editar despesa" : "Detalhes da despesa"}
        size={isEditing ? "xl" : "lg"}
        showCalculator={isEditing}
        footer={
          <ExpenseDetailFooter
            expense={expense}
            isEditing={isEditing && !actions.isInternalTransfer}
            isInternalTransfer={actions.isInternalTransfer}
            editPending={actions.editPending}
            repeatPending={actions.repeatPending}
            hasLinkedSplit={actions.hasLinkedSplit}
            onCancelEdit={() => {
              setIsEditing(false);
              setConvertToSplit(false);
              setError(null);
              setEditScope("single");
            }}
            onClose={() => resetAndClose(false)}
            onSubmitEdit={() => editSubmitRef.current?.()}
            onGoToTrip={(tripId) => {
              onOpenChange(false);
              navigate(`/viagens/${tripId}`);
            }}
            onSplit={handleOpenCreateSplit}
            onManageSplit={handleOpenManageSplit}
            onShare={() => void actions.handleShare()}
            onRepeat={() => guardAction(() => void actions.handleRepeat(), "Duplicar Despesa")}
            onStartEdit={() => {
              if (!actions.isInternalTransfer) guardAction(() => setIsEditing(true), "Editar Despesa");
            }}
            onDelete={() => guardAction(() => setConfirmOpen(true), "Excluir Despesa")}
          />
        }
      >
        {expense ? (
          <div className="flex flex-col gap-4 min-w-0">
            {error ? <Alert variant="error">{error}</Alert> : null}
            {isEditing && !actions.isInternalTransfer ? (
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
                hasLinkedSplit={actions.hasLinkedSplit}
                onManageSplit={handleOpenManageSplit}
                convertToSplit={convertToSplit}
                onConvertToSplitChange={setConvertToSplit}
              />
            ) : (
              <ExpenseDetailView
                expense={expense}
                currentCategory={actions.currentCategory}
                isFamilyActive={actions.isFamilyActive}
                isBusinessActive={actions.isBusinessActive}
                isInstallment={actions.isInstallment}
                isRecurring={actions.isRecurring}
                priceEvolution={actions.priceEvolution}
                linkedSplitShare={actions.linkedSplitShare}
                linkedRachaDebt={actions.linkedRachaDebt}
                onManageSplit={handleOpenManageSplit}
                onCreateSplit={handleOpenCreateSplit}
              />
            )}
          </div>
        ) : null}
      </Modal>

      {splitOpen && activeSplitExpense ? (
        <SplitExpenseDialog
          open={splitOpen}
          onOpenChange={(next) => {
            setSplitOpen(next);
            if (!next) setSplitSeedExpense(null);
          }}
          expense={activeSplitExpense}
          initialAmountCents={activeSplitAmountCents}
          linkedDebtId={actions.linkedRachaDebt?.id ?? null}
          categoryName={actions.currentCategory?.name}
          categoryIcon={actions.currentCategory?.icon ?? undefined}
        />
      ) : null}

      {manageSplitOpen && actions.linkedSplitShare ? (
        <ManageSplitDialog
          open={manageSplitOpen}
          onOpenChange={setManageSplitOpen}
          share={actions.linkedSplitShare}
          linkedDebt={actions.linkedRachaDebt}
        />
      ) : null}

      <TransactionDeleteScopeModal
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (next) setTripDeleteMode("both");
        }}
        title={
          actions.isInternalTransfer
            ? "Excluir transferência interna pareada PF/PJ?"
            : actions.isRachaExpense
              ? "Excluir despesa e racha vinculado?"
              : expense?.trip_id
                ? "Excluir despesa vinculada?"
                : "Excluir despesa?"
        }
        description={
          actions.isInternalTransfer
            ? "Esta ação exclui simultaneamente a saída e a entrada correspondentes nos dois caixas (PF e PJ) e não pode ser desfeita."
            : expense?.trip_id
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
        tripId={actions.isInternalTransfer ? null : expense?.trip_id}
        tripName={actions.tripName}
        tripDeleteMode={tripDeleteMode}
        onTripDeleteModeChange={setTripDeleteMode}
        isGrouped={actions.isInternalTransfer ? false : actions.isGrouped}
        isRecurring={actions.isInternalTransfer ? false : actions.isRecurring}
        mode={mode}
        onModeChange={setMode}
      />

      {upgradeModal}
    </>
  );
}
