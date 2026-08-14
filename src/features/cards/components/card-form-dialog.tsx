import { useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, MoneyInput, NumberStepper } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { useCreateCard, useUpdateCard } from "@/state";
import type { CreditCard } from "@/types";
import type { CreditCardForm } from "@/data/repositories/credit-cards";

export interface CardFormDialogProps {
  /** Cartão em edição; `null` = criação. */
  card: CreditCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Formulário de cartão (CRUD §3.3.1) — criação e edição no mesmo componente. */
export function CardFormDialog({ card, open, onOpenChange }: CardFormDialogProps) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [limitCents, setLimitCents] = useState(0);
  const [closingDay, setClosingDay] = useState(10);
  const [dueDay, setDueDay] = useState(15);
  const [color, setColor] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const pending = createCard.isPending || updateCard.isPending;

  // Sincroniza o formulário ao abrir (criação limpa; edição preenche).
  const syncForm = () => {
    setError(null);
    if (card) {
      setName(card.name);
      setBrand(card.brand ?? "");
      setLimitCents(card.credit_limit === null ? 0 : Math.round(card.credit_limit * 100));
      setClosingDay(card.closing_day);
      setDueDay(card.due_day);
      setColor(card.color ?? "");
      setIsActive(card.is_active);
    } else {
      setName("");
      setBrand("");
      setLimitCents(0);
      setClosingDay(10);
      setDueDay(15);
      setColor("");
      setIsActive(true);
    }
  };

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
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (next) syncForm();
        setError(null);
        onOpenChange(next);
      }}
      title={card ? "Editar cartão" : "Novo cartão"}
      description={card ? "Alterar regras do cartão é auditado." : "Preencha os dados do cartão de crédito."}
    >
      <div className="mt-4 flex flex-col gap-4">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="card-name" className="text-sm font-medium">
            Nome
          </label>
          <Input id="card-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Nubank" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="card-brand" className="text-sm font-medium">
              Bandeira
            </label>
            <Input id="card-brand" value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Visa" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="card-color" className="text-sm font-medium">
              Cor
            </label>
            <Input id="card-color" value={color} onChange={(event) => setColor(event.target.value)} placeholder="#8B5CF6" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="card-limit" className="text-sm font-medium">
            Limite total
          </label>
          <MoneyInput id="card-limit" cents={limitCents} onCentsChange={setLimitCents} aria-label="Limite total do cartão" />
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
          <Checkbox checked={isActive} onCheckedChange={setIsActive} label="Cartão ativo" id="card-active" />
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={name.trim() === "" || pending} onClick={() => void handleSubmit()}>
            {pending ? "Salvando…" : card ? "Salvar alterações" : "Criar cartão"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
