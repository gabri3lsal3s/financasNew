import type { RefObject } from "react";
import { ArrowDownRight, ArrowUpRight, Pencil, Plus, X } from "lucide-react";
import { Alert, Badge, Button, DatePicker, FormField, Input, MoneyInput } from "@/components/ui";
import type { PortfolioContribution } from "@/types";

export interface PocketContributionFormCardProps {
  formRef: RefObject<HTMLFormElement | null>;
  editingMarco: PortfolioContribution | null;
  entryType: "aporte" | "resgate";
  onEntryTypeChange: (type: "aporte" | "resgate") => void;
  newDate: string;
  onDateChange: (date: string) => void;
  newAmountCents: number;
  onAmountCentsChange: (cents: number) => void;
  newGrossBalanceCents: number;
  onGrossBalanceCentsChange: (cents: number) => void;
  newRatePctText: string;
  onRatePctTextChange: (text: string) => void;
  newNotes: string;
  onNotesChange: (notes: string) => void;
  formError: string | null;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancelEdit: () => void;
}

export function PocketContributionFormCard({
  formRef,
  editingMarco,
  entryType,
  onEntryTypeChange,
  newDate,
  onDateChange,
  newAmountCents,
  onAmountCentsChange,
  newGrossBalanceCents,
  onGrossBalanceCentsChange,
  newRatePctText,
  onRatePctTextChange,
  newNotes,
  onNotesChange,
  formError,
  isPending,
  onSubmit,
  onCancelEdit,
}: PocketContributionFormCardProps) {
  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className={`rounded-xl border p-3.5 flex flex-col gap-3 transition-colors ${
        editingMarco ? "border-primary/50 bg-primary/5" : "border-border/80 bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground text-xs">
            {editingMarco ? "Editar Marco Histórico" : "Adicionar Novo Marco"}
          </span>
          {editingMarco ? <Badge variant="default" size="xs">Modo Edição</Badge> : null}
        </div>
      </div>

      {formError ? <Alert variant="error">{formError}</Alert> : null}

      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface border border-border/80 self-start">
        <Button
          type="button"
          variant={entryType === "aporte" ? "default" : "ghost"}
          size="sm"
          sensoryIntent="selection"
          onClick={() => onEntryTypeChange("aporte")}
          className="gap-1.5 text-xs"
        >
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
          <span>Aporte (+)</span>
        </Button>
        <Button
          type="button"
          variant={entryType === "resgate" ? "warning" : "ghost"}
          size="sm"
          sensoryIntent="selection"
          onClick={() => onEntryTypeChange("resgate")}
          className="gap-1.5 text-xs"
        >
          <ArrowDownRight className="size-3.5" aria-hidden="true" />
          <span>Resgate (-)</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <FormField label="Data" htmlFor="pocket-marco-date" required className="sm:col-span-4">
          <DatePicker
            id="pocket-marco-date"
            value={newDate}
            onValueChange={(d) => { if (d) onDateChange(d); }}
            placeholder="Data"
            ariaLabel="Data do marco histórico"
          />
        </FormField>

        <FormField
          label={entryType === "resgate" ? "Valor Retirado" : "Valor Aportado"}
          htmlFor="pocket-marco-amount"
          required
          className="sm:col-span-4"
        >
          <MoneyInput
            id="pocket-marco-amount"
            cents={newAmountCents}
            onCentsChange={onAmountCentsChange}
            placeholder="R$ 0,00"
            className="text-base sm:text-sm"
            showCalculatorAction
          />
        </FormField>

        <FormField label="Saldo Bruto (p/ TWR)" htmlFor="pocket-marco-gross" optional className="sm:col-span-4">
          <MoneyInput
            id="pocket-marco-gross"
            cents={newGrossBalanceCents}
            onCentsChange={onGrossBalanceCentsChange}
            placeholder="Opcional"
            className="text-base sm:text-sm"
            showCalculatorAction
          />
        </FormField>

        <FormField label="Rentabilidade % a.m." htmlFor="pocket-marco-rate" optional className="sm:col-span-4">
          <Input
            id="pocket-marco-rate"
            value={newRatePctText}
            onChange={(e) => onRatePctTextChange(e.target.value)}
            placeholder="Ex: 1,24 ou -0,46"
            className="text-base sm:text-sm"
          />
        </FormField>

        <FormField label="Descrição" htmlFor="pocket-marco-notes" optional className="sm:col-span-8">
          <Input
            id="pocket-marco-notes"
            value={newNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={entryType === "resgate" ? "Ex: Resgate parcial" : "Ex: Aporte inicial"}
            className="text-base sm:text-sm"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {editingMarco ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancelEdit} disabled={isPending} className="gap-1">
            <X className="size-3.5" aria-hidden="true" />
            <span>Cancelar</span>
          </Button>
        ) : null}

        <Button
          type="submit"
          variant="default"
          size="sm"
          loading={isPending}
          disabled={isPending || newAmountCents <= 0}
          sensoryIntent={false}
          className="gap-1.5 w-full sm:w-auto"
        >
          {editingMarco ? <Pencil className="size-3.5" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          <span>{editingMarco ? "Salvar Alterações" : "Adicionar Marco"}</span>
        </Button>
      </div>
    </form>
  );
}
