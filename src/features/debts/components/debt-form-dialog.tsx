import { useState } from "react";
import { Check, RotateCcw, Trash2 } from "lucide-react";
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

interface DebtFormContentProps {
  debt: Debt | null;
  onClose: () => void;
  onDelete?: (debt: Debt) => Promise<void>;
}

function DebtFormContent({ debt, onClose, onDelete }: DebtFormContentProps) {
  const [name, setName] = useState(debt?.name ?? "");
  const [type, setType] = useState<DebtType>(debt?.type ?? "payable");
  const [cents, setCents] = useState(debt ? Math.round(debt.amount * 100) : 0);
  const [dueDate, setDueDate] = useState(debt?.due_date ?? "");
  const [isPaid, setIsPaid] = useState(debt?.paid_at !== null && debt?.paid_at !== undefined);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const pending = createDebt.isPending || updateDebt.isPending;

  const handleSubmit = async () => {
    setError(null);
    const input = {
      name: name.trim(),
      type,
      amount: cents / 100,
      due_date: dueDate,
      ...(debt?.paid_at ? { paid_at: isPaid ? debt.paid_at : null } : {}),
    };
    try {
      if (debt) {
        await updateDebt.mutateAsync({ id: debt.id, input });
      } else {
        await createDebt.mutateAsync(input);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const valid = name.trim() !== "" && cents > 0 && dueDate !== "";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !pending) {
          void handleSubmit();
        }
      }}
      className="mt-4 flex flex-col gap-4"
    >
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
      </div>

      {debt?.paid_at ? (
        isPaid ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-positive/30 bg-positive/5 p-3 text-xs text-positive-strong">
            <div className="flex items-center gap-2">
              <Check className="size-4" aria-hidden="true" />
              <span>Quitada em {debt.paid_at.slice(0, 10)}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs border-positive/40 hover:bg-positive/10"
              onClick={() => setIsPaid(false)}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reabrir dívida
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            <span>A dívida será reaberta como pendente ao salvar.</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setIsPaid(true)}
            >
              Desfazer
            </Button>
          </div>
        )
      ) : null}

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
        <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid || pending}>
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
              .then(() => onClose())
              .catch((err: unknown) => {
                setError(getErrorMessage(err));
              });
          }}
        />
      ) : null}
    </form>
  );
}

/** Formulário de dívida (CRUD §3.4) — contas a pagar e a receber. */
export function DebtFormDialog({ debt, open, onOpenChange, onDelete }: DebtFormDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={debt ? "Editar dívida" : "Nova dívida"}
      description="Conta a pagar ou a receber com status derivado (nunca armazenado)."
      size="lg"
      showCalculator
    >
      {open ? (
        <DebtFormContent
          key={debt?.id ?? "new-debt"}
          debt={debt}
          onClose={() => onOpenChange(false)}
          onDelete={onDelete}
        />
      ) : null}
    </Modal>
  );
}
