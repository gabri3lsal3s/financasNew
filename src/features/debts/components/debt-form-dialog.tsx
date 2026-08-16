import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert, Button, ConfirmDialog, DatePicker, Input, Modal, MoneyInput, RadioGroup } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { useCreateDebt, useUpdateDebt } from "@/state";
import type { Debt, DebtType } from "@/types";

export interface DebtFormDialogProps {
  /** Dívida em edição; `null` = criação. */
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando o usuário confirma a exclusão (apenas em edição).
   *  Deve rejeitar em falha — o formulário permanece aberto com o erro. */
  onDelete?: (debt: Debt) => Promise<void>;
}

/** Formulário de dívida (CRUD §3.4) — contas a pagar e a receber. */
export function DebtFormDialog({ debt, open, onOpenChange, onDelete }: DebtFormDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DebtType>("payable");
  const [cents, setCents] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const pending = createDebt.isPending || updateDebt.isPending;

  const reset = () => {
    setError(null);
    if (debt) {
      setName(debt.name);
      setType(debt.type);
      setCents(Math.round(debt.amount * 100));
      setDueDate(debt.due_date);
    } else {
      setName("");
      setType("payable");
      setCents(0);
      setDueDate("");
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const input = {
      name: name.trim(),
      type,
      amount: cents / 100,
      due_date: dueDate,
    };
    try {
      if (debt) {
        await updateDebt.mutateAsync({ id: debt.id, input });
      } else {
        await createDebt.mutateAsync(input);
      }
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const valid = name.trim() !== "" && cents > 0 && dueDate !== "";

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setError(null);
        onOpenChange(next);
      }}
      title={debt ? "Editar dívida" : "Nova dívida"}
      description="Conta a pagar ou a receber com status derivado (nunca armazenado)."
    >
      <div className="mt-4 flex flex-col gap-4">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="debt-name" className="text-sm font-medium">
            Nome
          </label>
          <Input id="debt-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Conta de luz" />
        </div>

        <RadioGroup
          value={type}
          onValueChange={(value) => setType(value as DebtType)}
          name="debt-type"
          options={[
            { value: "payable", label: "A pagar" },
            { value: "receivable", label: "A receber" },
          ]}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="debt-amount" className="text-sm font-medium">
            Valor
          </label>
          <MoneyInput id="debt-amount" cents={cents} onCentsChange={setCents} aria-label="Valor da dívida" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Vencimento</span>
          <DatePicker value={dueDate} onValueChange={setDueDate} ariaLabel="Vencimento da dívida" />
        </div>

        <div className="flex items-center gap-2 pt-2">
          {debt && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-negative hover:bg-negative/10 hover:text-negative"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Excluir
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="ml-auto">
            Cancelar
          </Button>
          <Button type="button" disabled={!valid || pending} onClick={() => void handleSubmit()}>
            {pending ? "Salvando…" : debt ? "Salvar alterações" : "Criar dívida"}
          </Button>
        </div>

        {debt && onDelete ? (
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="Excluir dívida?"
            description="Esta ação não pode ser desfeita. Dívidas quitadas permanecem no histórico."
            confirmLabel="Excluir"
            variant="destructive"
            onConfirm={() => {
              setConfirmDelete(false);
              // Exclusão com falha mantém o formulário aberto com o erro visível
              // (o toast do hook também avisa) — o usuário não perde a edição.
              void Promise.resolve(onDelete(debt))
                .then(() => onOpenChange(false))
                .catch((err: unknown) => {
                  setError(getErrorMessage(err));
                });
            }}
          />
        ) : null}
      </div>
    </Modal>
  );
}
