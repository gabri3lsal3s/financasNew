import { Plus, Receipt, Users } from "lucide-react";
import { Badge, Button, ConfirmDialog, Modal, ModalFooter } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import type { PublicShare } from "@/types";
import { ContributionHistoryRow } from "./manage-contributions/ContributionHistoryRow";
import { NewContributionForm } from "./manage-contributions/NewContributionForm";
import { useGoalContributionsCrud } from "./manage-contributions/use-goal-contributions-crud";

export interface ManageContributionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share: PublicShare;
}

export function ManageContributionsDialog({
  open,
  onOpenChange,
  share,
}: ManageContributionsDialogProps) {
  const crud = useGoalContributionsCrud(share);

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Gestão de Arrecadações & Participantes"
        description={`Gerencie os depósitos e doadores registrados na meta "${crud.title}".`}
        size="lg"
        showCalculator
        footer={
          <ModalFooter borderless>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </ModalFooter>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/80 bg-surface shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Users className="size-4.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">
                  Total Arrecadado pelos Participantes
                </p>
                <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                  <MoneyText
                    cents={crud.totalContributionsCents}
                    tone="positive"
                    variant="hero"
                  />
                  <Badge variant="muted" size="xs">
                    {crud.contributions.length} depósito{crud.contributions.length === 1 ? "" : "s"}
                  </Badge>
                </div>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              sensoryIntent="selection"
              onClick={() => crud.setIsAddingOpen((prev) => !prev)}
              className="gap-1.5 self-start sm:self-auto"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>{crud.isAddingOpen ? "Ocultar Formulário" : "Novo Depósito"}</span>
            </Button>
          </div>

          {crud.isAddingOpen && (
            <NewContributionForm
              amountCents={crud.newAmountCents}
              contributorName={crud.newContributorName}
              date={crud.newDate}
              isPending={crud.isPending}
              onAmountChange={crud.setNewAmountCents}
              onNameChange={crud.setNewContributorName}
              onDateChange={crud.setNewDate}
              onCancel={() => crud.setIsAddingOpen(false)}
              onSubmit={() => void crud.handleAddSubmit()}
            />
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Histórico de Recebimentos</span>
              <span>Ações de Edição e Exclusão</span>
            </div>

            {crud.contributions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-border/80 text-center gap-2">
                <Receipt className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-medium text-foreground">
                  Nenhum depósito individual registrado ainda
                </p>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  Registre os valores recebidos dos participantes via Pix ou dinheiro para acompanhar o progresso.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/80 bg-surface overflow-hidden">
                {crud.contributions.map((c) => (
                  <ContributionHistoryRow
                    key={c.id}
                    contribution={c}
                    isEditing={crud.editingContribId === c.id}
                    isPending={crud.isPending}
                    editAmountCents={crud.editAmountCents}
                    editContributorName={crud.editContributorName}
                    editDate={crud.editDate}
                    onEditAmountChange={crud.setEditAmountCents}
                    onEditNameChange={crud.setEditContributorName}
                    onEditDateChange={crud.setEditDate}
                    onStartEdit={() => crud.startEdit(c)}
                    onCancelEdit={crud.cancelEdit}
                    onSaveEdit={() => void crud.handleSaveEdit(c.id)}
                    onRequestDelete={() => crud.setDeletingContribId(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={crud.deletingContribId !== null}
        onOpenChange={(next) => !next && crud.setDeletingContribId(null)}
        title="Excluir Depósito da Meta?"
        description="Esta contribuição será removida e o valor arrecadado será recalculado automaticamente."
        cancelLabel="Cancelar"
        confirmLabel={crud.isPending ? "Excluindo…" : "Confirmar Exclusão"}
        variant="destructive"
        confirmPending={crud.isPending}
        elevated
        onConfirm={() => {
          if (crud.deletingContribId) {
            void crud.handleDelete(crud.deletingContribId);
          }
        }}
      >
        <p className="text-xs text-muted-foreground">
          O total acumulado no termômetro e na página pública será reduzido pelo valor deste depósito.
        </p>
      </ConfirmDialog>
    </>
  );
}
