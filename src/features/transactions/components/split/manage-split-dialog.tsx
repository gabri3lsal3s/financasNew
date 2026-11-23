import { BellRing, CheckCircle2, Lock, RotateCcw, Trash2, Users, X } from "lucide-react";
import { Badge, Button, Modal, ModalFooter, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { isParticipantFullySettled } from "@/domain/finance/split-math";
import { formatCentsAsBRL } from "@/services/masks";
import type { Debt, PublicShare } from "@/types";
import { SplitDeleteConfirmModal } from "./split-delete-confirm-modal";
import { SplitEditTab } from "./split-edit-tab";
import { SplitParticipantRow } from "./split-participant-row";
import { SplitPublicConfigTab } from "./split-public-config-tab";
import { SplitSummaryKpis } from "./split-summary-kpis";
import { useManageSplit, type ManageSplitTab } from "./use-manage-split";

export interface ManageSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share: PublicShare;
  linkedDebt?: Debt | null;
  onSuccess?: () => void;
}

/** Modal completo de gestão de baixas, edição do racha e configurações do link Pix. */
export function ManageSplitDialog({ open, onOpenChange, share, linkedDebt, onSuccess }: ManageSplitDialogProps) {
  const split = useManageSplit({ open, share, linkedDebt, onOpenChange, onSuccess });

  const settlementsContent = (
    <div className="space-y-4">
      <SplitSummaryKpis
        totalCents={split.totalCents}
        totalSettledFromFriendsCents={split.totalSettledFromFriendsCents}
        remainingReceivableCents={split.remainingReceivableCents}
        settledSubtitle={split.settledSubtitle}
        hostNetCostCents={split.hostNetCostCents}
        netReportWeight={split.netReportWeight}
      />

      {split.pendingSignals.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3.5 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BellRing className="size-4 text-warning-strong shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">
                Avisos de Pix Aguardando Confirmação
              </span>
            </div>
            <Badge variant="warning" size="xs">
              {split.pendingSignals.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {split.pendingSignals.map((sig) => (
              <div
                key={sig.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border/80 bg-surface p-2.5 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-foreground block truncate">
                    {sig.participant_name} informou pagamento
                  </span>
                  <MoneyText cents={sig.amount_cents} tone="portfolio" variant="caption" className="font-semibold" />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    size="xs"
                    variant="default"
                    disabled={split.isMutating}
                    onClick={() => void split.handleConfirmSignal(sig.id)}
                    className="gap-1"
                  >
                    <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
                    <span>Confirmar</span>
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={split.isMutating}
                    onClick={() => void split.handleDismissSignal(sig.id)}
                    className="gap-1 text-muted-foreground"
                  >
                    <X className="size-3" aria-hidden="true" />
                    <span>Recusar</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>
            {split.friends.length} participantes amigos · Status:{" "}
            <strong className={split.isCompleted ? "text-positive-strong" : "text-warning-strong"}>
              {split.isCompleted ? "Finalizado" : "Em Aberto"}
            </strong>
          </span>
        </div>
        {split.isCompleted ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={split.isMutating}
            onClick={() => void split.handleReopenSplit()}
            className="gap-1 self-start sm:self-center"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            <span>Reabrir Racha</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => split.setActiveTab("edit")}
            className="h-7 px-2 text-xs self-start sm:self-center"
          >
            Editar dados e participantes
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold text-foreground">Participantes e Quitações</span>
        <div className="divide-y divide-border/80 rounded-xl border border-border/80 bg-surface overflow-hidden shadow-xs">
          {split.friends.map((friend) => {
            const isCustomInputOpen = split.customInputParticipantId === friend.id;
            const friendInsts = split.participantInstallments.filter(
              (inst) =>
                inst.participant_id === friend.id ||
                (split.friends.length === 1 && !split.participants.find((p) => p.id === inst.participant_id)?.is_host),
            );
            return (
              <SplitParticipantRow
                key={friend.id}
                friend={friend}
                isSettled={isParticipantFullySettled(friend, friendInsts)}
                installments={friendInsts}
                isCustomInputOpen={isCustomInputOpen}
                customInputCents={split.customInputCents}
                onCustomInputCentsChange={split.setCustomInputCents}
                onSettleFull={(id) => void split.handleSettleFull(id)}
                onToggleCustomSettle={() =>
                  isCustomInputOpen ? split.setCustomInputParticipantId(null) : split.handleOpenCustomSettle(friend)
                }
                onCloseCustomSettle={() => split.setCustomInputParticipantId(null)}
                onConfirmCustomSettle={() => void split.handleConfirmCustomSettle()}
                onUnsettle={(id) => void split.handleUnsettle(id)}
                onToggleInstallment={(instId, mark) => void split.handleToggleSettleInstallment(instId, mark)}
              />
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-surface p-3 text-[11px] text-muted-foreground">
        Ao registrar baixas parciais ou calotes (R$ 0,00), a despesa correspondente passa a contar no extrato apenas pelo valor que não foi reembolsado.
      </div>
    </div>
  );

  const editContent = (
    <SplitEditTab
      title={split.editedTitle}
      onTitleChange={split.setEditedTitle}
      totalCents={split.editedTotalCents}
      onTotalCentsChange={split.setEditedTotalCents}
      date={split.editedDate}
      onDateChange={split.setEditedDate}
      dueDate={split.editedDueDate}
      onDueDateChange={split.setEditedDueDate}
      isMultiInstallmentGroup={split.isMultiInstallmentGroup}
      installmentsCount={split.installmentsCount}
      installmentsMode={split.editedInstallmentsMode}
      onInstallmentsModeChange={split.setEditedInstallmentsMode}
      remainderPolicy={split.editedRemainderPolicy}
      onRemainderPolicyChange={split.setEditedRemainderPolicy}
      splitMode={split.editedSplitMode}
      onSplitModeChange={split.handleEditSplitModeChange}
      participants={split.editableParticipants}
      onParticipantNameChange={split.handleEditParticipantName}
      onParticipantFixedCentsChange={split.handleEditParticipantFixedCents}
      onAddParticipant={split.handleAddParticipant}
      onRemoveParticipant={split.handleRemoveParticipant}
      overpaidNotices={split.overpaidNotices}
      customSumCents={split.customSumCents}
      isValid={split.isEditValid}
      isSaving={split.isSaving}
      onSave={() => void split.handleSaveEdit()}
    />
  );

  const publicConfigContent = (
    <SplitPublicConfigTab
      pixKey={split.editedPixKey}
      onPixKeyChange={split.setEditedPixKey}
      selectedKeyType={split.editedKeyType}
      onSelectedKeyTypeChange={split.setEditedKeyType}
      detectedType={split.detectedPixType}
      pixValidationError={split.pixValidationError}
      isAmbiguousCpfOrPhone={split.isAmbiguousCpfOrPhone}
      onQuickSelectKeyType={(t) => split.setEditedKeyType(t)}
      profileSuggestions={split.profileSuggestions}
      hostName={split.editedHostName}
      onHostNameChange={split.setEditedHostName}
      customNote={split.editedCustomNote}
      onCustomNoteChange={split.setEditedCustomNote}
      showParticipantsList={split.editedShowParticipantsList}
      onShowParticipantsListChange={split.setEditedShowParticipantsList}
      publicPagePaused={split.editedPublicPagePaused}
      onPublicPagePausedChange={split.setEditedPublicPagePaused}
      previewBrCode={split.previewBrCode}
      previewAmountCents={split.firstGuestPreviewAmountCents}
      expiresAt={share.expires_at}
      publicUrl={split.publicUrl}
      isValid={split.isPublicConfigValid}
      isSaving={split.isSaving}
      onTestCopyBrCode={() => void split.handleTestCopyBrCode()}
      onCopyPublicLink={() => void split.handleCopyPublicLink()}
      onExtendExpiration={() => void split.handleExtendExpiration()}
      onRegenerateLink={() => void split.handleRegenerateLink()}
      onSavePublicConfig={() => void split.handleSavePublicConfig()}
    />
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="xl"
        title={split.payload.title || "Gerenciar Racha de Despesa"}
        description="Acompanhe baixas por pessoa, edite valores e participantes ou ajuste sua chave Pix e link público."
        showCalculator={Boolean(split.customInputParticipantId) || split.activeTab === "edit"}
        footer={
          <ModalFooter
            borderless
            destructiveAction={
              <Button
                type="button"
                variant="ghost"
                onClick={split.handleOpenDeleteConfirm}
                className="gap-1.5 text-critical hover:bg-critical/10"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span>Excluir Racha</span>
              </Button>
            }
          >
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {!split.isCompleted ? (
              <Button
                type="button"
                variant="default"
                onClick={() => split.setConfirmFinalizeOpen(true)}
                className="gap-1.5"
              >
                <Lock className="size-3.5" aria-hidden="true" />
                <span>Finalizar Racha</span>
              </Button>
            ) : (
              <Badge variant="positive" size="sm" className="justify-center w-full sm:w-auto">
                Racha Finalizado
              </Badge>
            )}
          </ModalFooter>
        }
      >
        <Tabs
          value={split.activeTab}
          onValueChange={(val) => split.setActiveTab(val as ManageSplitTab)}
          fullWidth
          ariaLabel="Seções de gestão do racha"
          items={[
            {
              value: "settlements",
              label: "Baixas",
              badge:
                split.pendingSignals.length > 0 ? (
                  <Badge variant="warning" size="xs">
                    {split.pendingSignals.length}
                  </Badge>
                ) : undefined,
              content: <div className="pt-3">{settlementsContent}</div>,
            },
            {
              value: "edit",
              label: "Editar Racha",
              content: <div className="pt-3">{editContent}</div>,
            },
            {
              value: "public",
              label: "Pix e Página",
              content: <div className="pt-3">{publicConfigContent}</div>,
            },
          ]}
        />
      </Modal>

      <Modal
        open={split.confirmFinalizeOpen}
        onOpenChange={split.setConfirmFinalizeOpen}
        size="sm"
        elevated
        title="Finalizar este racha de despesa?"
        description={`Você recebeu ${formatCentsAsBRL(split.totalSettledFromFriendsCents)} dos amigos. Deseja marcar todos os pendentes como pagos ou encerrar mantendo apenas o valor já recebido (${formatCentsAsBRL(split.hostNetCostCents)} como sua parte)?`}
        footer={
          <ModalFooter borderless>
            <Button type="button" variant="outline" onClick={() => split.setConfirmFinalizeOpen(false)}>
              Cancelar
            </Button>
            {split.remainingReceivableCents > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={split.isMutating}
                onClick={() => void split.handleSettleAll()}
              >
                Recebi Tudo
              </Button>
            ) : null}
            <Button
              type="button"
              variant="default"
              disabled={split.isMutating}
              onClick={() => void split.handleFinalizeSplit()}
            >
              Finalizar e Quitar Cobrança
            </Button>
          </ModalFooter>
        }
      />

      <SplitDeleteConfirmModal
        open={split.confirmDeleteOpen}
        onOpenChange={split.setConfirmDeleteOpen}
        linkedDebt={linkedDebt}
        expenseId={split.payload.expense_id}
        hasLinkedExpense={split.hasLinkedExpense}
        isExpenseFetched={split.isExpenseFetched}
        linkedExpense={split.linkedExpense}
        totalCents={split.totalCents}
        deleteLinkedDebt={split.deleteLinkedDebt}
        onDeleteLinkedDebtChange={split.setDeleteLinkedDebt}
        deleteOriginalExpense={split.deleteOriginalExpense}
        onDeleteOriginalExpenseChange={split.setDeleteOriginalExpense}
        isDeleting={split.isDeleting}
        onConfirmDelete={() => void split.handleDeleteSplit()}
      />
    </>
  );
}
