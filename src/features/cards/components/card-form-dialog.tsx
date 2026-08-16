import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert, Button, Checkbox, ColorPicker, ConfirmDialog, Input, Modal, MoneyInput, NumberStepper } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { useCreateCard, useDeleteCard, useUpdateCard } from "@/state";
import type { CreditCard } from "@/types";
import type { CreditCardForm } from "@/data/repositories/credit-cards";

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
  onClose: () => void;
  onDeleted?: (deletedCardId: string) => void;
}

function CardFormContent({ card, onClose, onDeleted }: CardFormContentProps) {
  const [name, setName] = useState(card?.name ?? "");
  const [brand, setBrand] = useState(card?.brand ?? "");
  const [limitCents, setLimitCents] = useState(
    card?.credit_limit === null || card?.credit_limit === undefined ? 0 : Math.round(card.credit_limit * 100),
  );
  const [closingDay, setClosingDay] = useState(card?.closing_day ?? 10);
  const [dueDay, setDueDay] = useState(card?.due_day ?? 15);
  const [color, setColor] = useState(card?.color ?? "");
  const [isActive, setIsActive] = useState(card?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const pending = createCard.isPending || updateCard.isPending || deleteCard.isPending;

  const handleSubmit = async () => {
    setError(null);
    const form: CreditCardForm = {
      name: name.trim(),
      brand: brand.trim() || null,
      credit_limit: limitCents > 0 ? limitCents / 100 : null,
      closing_day: closingDay,
      due_day: dueDay,
      color: color.trim() || null,
      is_active: isActive,
    };
    try {
      if (card) {
        await updateCard.mutateAsync({ id: card.id, input: form });
      } else {
        await createCard.mutateAsync(form);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDeactivateNow = async () => {
    if (!card) return;
    setError(null);
    try {
      await updateCard.mutateAsync({
        id: card.id,
        input: {
          name: name.trim() || card.name,
          brand: brand.trim() || card.brand,
          credit_limit: limitCents > 0 ? limitCents / 100 : null,
          closing_day: closingDay,
          due_day: dueDay,
          color: color.trim() || null,
          is_active: false,
        },
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    setError(null);
    try {
      await deleteCard.mutateAsync(card.id);
      setDeleteConfirmOpen(false);
      onClose();
      onDeleted?.(card.id);
    } catch (err) {
      setDeleteConfirmOpen(false);
      const msg = getErrorMessage(err);
      if (
        msg.toLowerCase().includes("foreign key") ||
        msg.toLowerCase().includes("histórico") ||
        msg.toLowerCase().includes("vinculad") ||
        msg.toLowerCase().includes("desativá-lo")
      ) {
        setError(
          "Não é possível excluir um cartão que possui despesas ou pagamentos registrados. Você pode desativá-lo para mantê-lo no histórico.",
        );
      } else {
        setError(msg);
      }
    }
  };

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() !== "" && !pending) {
            void handleSubmit();
          }
        }}
        className="mt-4 flex flex-col gap-4"
      >
        {error ? (
          <div className="flex flex-col gap-2">
            <Alert variant="error">{error}</Alert>
            {error.includes("desativá-lo") && card && card.is_active ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDeactivateNow()}
                className="self-start text-xs"
              >
                Desativar cartão agora
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="card-name" className="text-sm font-medium">
            Nome
          </label>
          <Input
            id="card-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Nubank Ultravioleta"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="card-brand" className="text-sm font-medium">
              Bandeira
            </label>
            <Input
              id="card-brand"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="Visa, Mastercard, Elo..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Cor</span>
            <ColorPicker value={color} onValueChange={setColor} ariaLabel="Cor do cartão" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="card-limit" className="text-sm font-medium">
            Limite total
          </label>
          <MoneyInput
            id="card-limit"
            cents={limitCents}
            onCentsChange={setLimitCents}
            aria-label="Limite total do cartão"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Dia de fechamento</span>
            <NumberStepper
              value={closingDay}
              onValueChange={setClosingDay}
              min={1}
              max={31}
              decreaseLabel="Diminuir dia de fechamento"
              increaseLabel="Aumentar dia de fechamento"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Dia de vencimento</span>
            <NumberStepper
              value={dueDay}
              onValueChange={setDueDay}
              min={1}
              max={31}
              decreaseLabel="Diminuir dia de vencimento"
              increaseLabel="Aumentar dia de vencimento"
            />
          </div>
        </div>

        {card ? (
          <div className="pt-1 flex flex-col gap-2">
            <Checkbox
              checked={isActive}
              onCheckedChange={setIsActive}
              label="Cartão ativo para novas compras"
              id="card-active"
            />
            {!isActive && (
              <p className="text-xs text-muted-foreground">
                Cartão desativado: permanece no histórico de faturas e relatórios passados, mas fica oculto para novas despesas.
              </p>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border mt-1">
          {card ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={pending}
              className="text-critical hover:bg-critical/10 gap-1.5 px-2.5"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Excluir
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={name.trim() === "" || pending}
            >
              {pending ? "Salvando…" : card ? "Salvar alterações" : "Criar cartão"}
            </Button>
          </div>
        </div>
      </form>

      {card ? (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Excluir cartão"
          description={`Tem certeza que deseja excluir o cartão "${card.name}"? Se houver histórico de despesas ou pagamentos, você deve desativá-lo em vez de excluí-lo.`}
          confirmLabel="Excluir cartão"
          variant="destructive"
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}

/** Formulário de cartão (CRUD §3.3.1) — criação, edição e exclusão no mesmo componente. */
export function CardFormDialog({ card, open, onOpenChange, onDeleted }: CardFormDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={card ? "Editar cartão" : "Novo cartão"}
      description={card ? "Altere as configurações ou desative o cartão." : "Preencha os dados do cartão de crédito."}
    >
      {open ? (
        <CardFormContent
          key={card?.id ?? "new-card"}
          card={card}
          onClose={() => onOpenChange(false)}
          onDeleted={onDeleted}
        />
      ) : null}
    </Modal>
  );
}
