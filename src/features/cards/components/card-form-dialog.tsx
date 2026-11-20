import { useId } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { Alert, Button, ConfirmDialog, Modal, ModalFooter } from "@/components/ui";
import { CreditCard3D } from "@/components/modules";
import { bestPurchaseDay } from "@/domain/cards";
import type { CreditCard } from "@/types";
import { CardFormFields } from "./card-form-fields";
import { useCardFormSubmit } from "./use-card-form-submit";

export interface CardFormDialogProps {
  /** Cartão em edição; `null` = criação. */
  card: CreditCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback executado após a exclusão bem-sucedida do cartão. */
  onDeleted?: (deletedCardId: string) => void;
}

interface CardFormContentProps {
  card: CreditCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (deletedCardId: string) => void;
}

function CardFormContent({ card, open, onOpenChange, onDeleted }: CardFormContentProps) {
  const formId = useId();
  const state = useCardFormSubmit({
    card,
    onClose: () => onOpenChange(false),
    onDeleted,
  });

  const previewCard: CreditCard = {
    id: card?.id ?? "preview-card",
    user_id: card?.user_id ?? "",
    name: state.name.trim() || "Nome do Cartão",
    brand: state.brand.trim() || null,
    credit_limit: state.limitCents > 0 ? state.limitCents / 100 : null,
    closing_day: state.closingDay,
    due_day: state.dueDay,
    color: state.color.trim() || null,
    is_active: state.isActive,
    last_four_digits: state.lastFourDigits.trim() || card?.last_four_digits || null,
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={card ? "Editar cartão" : "Novo cartão"}
        description={
          card
            ? "Altere as configurações ou desative o cartão."
            : "Preencha os dados do cartão de crédito."
        }
        size="xl"
        confirmDiscard
        isDirty={state.isDirty}
        discardTitle="Descartar alterações do cartão?"
        discardDescription="Você possui informações modificadas no formulário. Se fechar agora, as alterações serão descartadas."
        showCalculator
        footer={
          <ModalFooter
            borderless
            destructiveAction={
              card ? (
                <Button
                  type="button"
                  variant="ghost"
                  sensoryIntent="selection"
                  onClick={() => state.setDeleteConfirmOpen(true)}
                  disabled={state.pending}
                  className="text-critical-strong hover:bg-critical/10 gap-1.5 px-2.5"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Excluir
                </Button>
              ) : null
            }
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={state.pending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form={formId}
              sensoryIntent={false}
              aria-label={card ? "Salvar alterações" : "Criar cartão"}
              disabled={state.name.trim() === "" || state.pending}
            >
              {state.pending ? (
                "Salvando…"
              ) : (
                <>
                  <span className="hidden sm:inline">
                    {card ? "Salvar alterações" : "Criar cartão"}
                  </span>
                  <span className="sm:hidden">Salvar</span>
                </>
              )}
            </Button>
          </ModalFooter>
        }
      >
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            if (state.name.trim() !== "" && !state.pending) {
              void state.handleSubmit();
            }
          }}
          className="mt-2 flex flex-col gap-4"
        >
          {state.error ? (
            <div className="flex flex-col gap-2">
              <Alert variant="error">{state.error}</Alert>
              {state.error.includes("desativá-lo") && card && card.is_active ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  sensoryIntent={false}
                  onClick={() => void state.handleDeactivateNow()}
                  className="self-start text-xs"
                >
                  Desativar cartão agora
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            <div className="md:col-span-5 flex flex-col gap-2.5 md:sticky md:top-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pré-visualização
              </span>
              <CreditCard3D
                card={previewCard}
                isPrimary={state.isPrimary}
                isInteractive={false}
                disableTilt
                className="mx-auto sm:mx-0"
              />
              <div className="w-full max-w-[390px] sm:max-w-[420px] mx-auto sm:mx-0 rounded-xl bg-surface-raised border border-border/80 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Sparkles className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>
                  Melhor dia para compras:{" "}
                  <strong className="text-foreground font-semibold">
                    dia {bestPurchaseDay(state.closingDay)}
                  </strong>
                </span>
              </div>
            </div>

            <CardFormFields
              isEditing={Boolean(card)}
              name={state.name}
              onNameChange={state.setName}
              brand={state.brand}
              onBrandChange={state.setBrand}
              color={state.color}
              onColorChange={state.setColor}
              limitCents={state.limitCents}
              onLimitCentsChange={state.setLimitCents}
              lastFourDigits={state.lastFourDigits}
              onLastFourDigitsChange={state.setLastFourDigits}
              closingDay={state.closingDay}
              onClosingDayChange={state.setClosingDay}
              dueDay={state.dueDay}
              onDueDayChange={state.setDueDay}
              isPrimary={state.isPrimary}
              onIsPrimaryChange={state.setIsPrimary}
              isActive={state.isActive}
              onIsActiveChange={state.setIsActive}
            />
          </div>
        </form>
      </Modal>

      {card ? (
        <ConfirmDialog
          open={state.deleteConfirmOpen}
          onOpenChange={state.setDeleteConfirmOpen}
          elevated
          title="Excluir cartão"
          description={`Tem certeza que deseja excluir o cartão "${card.name}"? Se houver histórico de despesas ou pagamentos, você deve desativá-lo em vez de excluí-lo.`}
          confirmLabel="Excluir cartão"
          variant="destructive"
          confirmPending={state.pending}
          onConfirm={() => void state.handleDelete()}
        />
      ) : null}
    </>
  );
}

/** Formulário de cartão (CRUD §3.3.1) — criação, edição e exclusão no mesmo componente. */
export function CardFormDialog({ card, open, onOpenChange, onDeleted }: CardFormDialogProps) {
  if (!open) return null;

  return (
    <CardFormContent
      key={card?.id ?? "new-card"}
      card={card}
      open={open}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
    />
  );
}
