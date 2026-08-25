import { useState } from "react";
import { Alert, Button, Input, Modal, Select } from "@/components/ui";
import { LOAN_TYPE_LABELS } from "@/domain/loans";
import { getErrorMessage } from "@/services/errors";
import { useUpdateLoan } from "@/state";
import type { Loan, LoanType } from "@/types";

export interface LoanEditDialogProps {
  loan: Loan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LOAN_TYPE_OPTIONS = (Object.keys(LOAN_TYPE_LABELS) as LoanType[]).map((key) => ({
  value: key,
  label: LOAN_TYPE_LABELS[key],
}));

interface LoanEditFormProps {
  loan: Loan;
  onClose: () => void;
}

function LoanEditForm({ loan, onClose }: LoanEditFormProps) {
  const updateLoan = useUpdateLoan();

  const [name, setName] = useState(loan.name);
  const [loanType, setLoanType] = useState<LoanType>(loan.loan_type);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Informe o nome ou identificação do contrato.");
      return;
    }

    try {
      await updateLoan.mutateAsync({
        id: loan.id,
        patch: {
          name: trimmedName,
          loan_type: loanType,
        },
      });

      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-loan-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Nome do Contrato / Instituição
        </label>
        <Input
          id="edit-loan-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Financiamento Imobiliário Caixa"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tipo de Empréstimo
        </span>
        <Select
          value={loanType}
          onValueChange={(val) => setLoanType(val as LoanType)}
          options={LOAN_TYPE_OPTIONS}
          ariaLabel="Tipo de empréstimo"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateLoan.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={updateLoan.isPending}>
          {updateLoan.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Diálogo para edição segura dos metadados de um contrato de empréstimo
 * (nome, tipo, notas) sem violar o histórico financeiro das parcelas já geradas.
 */
export function LoanEditDialog({
  loan,
  open,
  onOpenChange,
}: LoanEditDialogProps) {
  if (!loan) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Contrato de Empréstimo"
      description="Atualize o nome, categoria e observações deste contrato."
      size="md"
    >
      {open && <LoanEditForm loan={loan} onClose={() => onOpenChange(false)} />}
    </Modal>
  );
}
