import { Check, Plus, User } from "lucide-react";
import { Button, DatePicker, Input, MoneyInput } from "@/components/ui";
import { todayISO } from "@/lib/date";

export interface NewContributionFormProps {
  amountCents: number;
  contributorName: string;
  date: string;
  isPending: boolean;
  onAmountChange: (cents: number) => void;
  onNameChange: (name: string) => void;
  onDateChange: (date: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function NewContributionForm({
  amountCents,
  contributorName,
  date,
  isPending,
  onAmountChange,
  onNameChange,
  onDateChange,
  onCancel,
  onSubmit,
}: NewContributionFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-3 p-3.5 rounded-xl border border-primary/25 bg-primary/5 animate-in fade-in"
    >
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Plus className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        <span>Registrar Novo Depósito</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-contrib-amount" className="text-xs font-semibold text-foreground">
            Valor
          </label>
          <MoneyInput
            id="new-contrib-amount"
            cents={amountCents}
            onCentsChange={onAmountChange}
            placeholder="R$ 0,00"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-contrib-name" className="text-xs font-semibold text-foreground">
            Nome de quem pagou
          </label>
          <div className="relative">
            <Input
              id="new-contrib-name"
              value={contributorName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ex: Lucas, Camila..."
              className="pl-8 text-base sm:text-sm"
            />
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-contrib-date" className="text-xs font-semibold text-foreground">
            Data
          </label>
          <DatePicker
            id="new-contrib-date"
            value={date}
            onChange={(next) => onDateChange(next ?? todayISO())}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          sensoryIntent="success"
          disabled={amountCents <= 0 || isPending}
          className="gap-1.5"
          aria-label="Adicionar à Meta"
        >
          <Check className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Adicionar à Meta</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>
    </form>
  );
}
