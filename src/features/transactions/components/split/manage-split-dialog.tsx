import { Edit2, Lock, Trash2, Users } from "lucide-react";
import { Badge, Button, Input, Modal, ModalFooter } from "@/components/ui";
import { isParticipantFullySettled } from "@/domain/finance/split-math";
import { formatCentsAsBRL } from "@/services/masks";
import type { Debt, PublicShare } from "@/types";
import { SplitDeleteConfirmModal } from "./split-delete-confirm-modal";
import { SplitParticipantRow } from "./split-participant-row";
import { SplitSummaryKpis } from "./split-summary-kpis";
import { useManageSplit } from "./use-manage-split";

export interface ManageSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share: PublicShare;
  linkedDebt?: Debt | null;
  onSuccess?: () => void;
}

/** Modal de gestão de baixas por participante, parcelas e finalização do racha. */
export function ManageSplitDialog({ open, onOpenChange, share, linkedDebt, onSuccess }: ManageSplitDialogProps) {
  const split = useManageSplit({ share, linkedDebt, onOpenChange, onSuccess });

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        title={split.payload.title || "Gerenciar Racha de Despesa"}
        description="Acompanhe baixas por pessoa, registre calotes parciais ou finalize o racha."
        showCalculator={Boolean(split.customInputParticipantId)}
        footer={
          <ModalFooter
            borderless
            destructiveAction={
              <Button
                type="button" variant="ghost"
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
              <Button type="button" variant="default" onClick={() => split.setConfirmFinalizeOpen(true)} className="gap-1.5">
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
        <div className="space-y-4">
          <SplitSummaryKpis
            totalCents={split.totalCents}
            totalSettledFromFriendsCents={split.totalSettledFromFriendsCents}
            settledSubtitle={split.settledSubtitle}
            hostNetCostCents={split.hostNetCostCents}
            netReportWeight={split.netReportWeight}
          />

          {split.isEditingInfo ? (
            <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Editar Dados do Racha</span>
                <Button type="button" size="xs" variant="ghost" onClick={() => split.setIsEditingInfo(false)}>
                  Cancelar
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Título do racha</label>
                  <Input value={split.editedTitle} onChange={(e) => split.setEditedTitle(e.target.value)} placeholder="Ex.: Pizza com a galera" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Chave Pix</label>
                  <Input value={split.editedPixKey} onChange={(e) => split.setEditedPixKey(e.target.value)} placeholder="Chave Pix para cobrança" />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button type="button" size="xs" variant="default" onClick={() => void split.handleSaveInfo()}>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <div className="flex items-center gap-1.5">
                <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>
                  {split.friends.length} participantes amigos · Status:{" "}
                  <strong className={split.isCompleted ? "text-positive-strong" : "text-warning-strong"}>
                    {split.isCompleted ? "Finalizado" : "Em Aberto"}
                  </strong>
                </span>
              </div>
              <Button type="button" size="xs" variant="ghost" onClick={() => split.setIsEditingInfo(true)} className="gap-1 h-7 px-2 text-xs">
                <Edit2 className="size-3" aria-hidden="true" />
                <span>Editar dados</span>
              </Button>
            </div>
          )}

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
                    onToggleCustomSettle={() => isCustomInputOpen ? split.setCustomInputParticipantId(null) : split.handleOpenCustomSettle(friend)}
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
      </Modal>

      <Modal
        open={split.confirmFinalizeOpen}
        onOpenChange={split.setConfirmFinalizeOpen}
        size="sm"
        elevated
        title="Finalizar este racha de despesa?"
        description={`Você recebeu ${formatCentsAsBRL(split.totalSettledFromFriendsCents)} dos amigos. Sua despesa final no extrato considerará ${formatCentsAsBRL(split.hostNetCostCents)} e a cobrança vinculada será encerrada.`}
        footer={
          <ModalFooter borderless>
            <Button type="button" variant="outline" onClick={() => split.setConfirmFinalizeOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="default" onClick={() => void split.handleFinalizeSplit()}>
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
