import { useState } from "react";
import { Calendar, Check, Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/domain/debts";
import { useCreateCashCheckpoint } from "@/state";
import { triggerHaptic } from "@/services/haptics";

export interface CashCheckpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalanceCents?: number;
  onSave?: (data: { date: string; balance_cents: number; notes: string | null }) => Promise<void> | void;
  isSaving?: boolean;
}

interface CashCheckpointFormProps {
  onOpenChange: (open: boolean) => void;
  initialBalanceCents: number;
  onSave?: (data: { date: string; balance_cents: number; notes: string | null }) => Promise<void> | void;
  isSaving?: boolean;
}

function CashCheckpointForm({
  onOpenChange,
  initialBalanceCents,
  onSave,
  isSaving,
}: CashCheckpointFormProps) {
  const [balanceCents, setBalanceCents] = useState<number>(initialBalanceCents);
  const [date, setDate] = useState<string>(todayISO());
  const [notes, setNotes] = useState<string>("");

  const createMutation = useCreateCashCheckpoint();
  const isPending = isSaving ?? createMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic("light");

    const payload = {
      date,
      balance_cents: balanceCents,
      notes: notes.trim() || null,
    };

    if (onSave) {
      await onSave(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }

    onOpenChange(false);
  };


  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          Esta calibração ajusta o saldo em caixa sem criar despesas fictícias e sem poluir seus gráficos de categorias ou relatórios.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cash-balance-input" className="text-xs font-semibold text-foreground">
          Saldo Real no Banco (Total em Contas)
        </label>
        <MoneyInput
          id="cash-balance-input"
          cents={balanceCents}
          onCentsChange={(cents) => setBalanceCents(cents)}
        />

      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
          Data da Aferição
        </label>
        <DatePicker value={date} onValueChange={setDate} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cash-notes-input" className="text-xs font-semibold text-foreground">
          Anotação (opcional)
        </label>
        <Input
          id="cash-notes-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: Extrato Nubank + Itaú"
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={isPending}
          className="gap-1.5"
        >
          <Check className="size-4" aria-hidden="true" />
          {isPending ? "Salvando..." : "Salvar Saldo Real"}
        </Button>
      </div>
    </form>
  );
}

export function CashCheckpointDialog({
  open,
  onOpenChange,
  currentBalanceCents = 0,
  onSave,
  isSaving,
}: CashCheckpointDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Calibrar Saldo com o Banco"
      description="Informe a soma real do dinheiro disponível nas suas contas bancárias hoje. O app usará este valor como âncora a partir de agora."
      showCalculator
    >
      {open ? (
        <CashCheckpointForm
          onOpenChange={onOpenChange}
          initialBalanceCents={currentBalanceCents}
          onSave={onSave}
          isSaving={isSaving}
        />
      ) : null}
    </Modal>
  );
}

