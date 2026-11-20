import type { RefObject } from "react";
import { ArrowDownRight, ArrowUpRight, History, Pencil, Plus, X } from "lucide-react";
import { Alert, Badge, Button, DatePicker, Input, MoneyInput } from "@/components/ui";
import { formatCentsAsBRL } from "@/services/masks";
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
  lastAporteCents?: number;
  onZeroAporte?: () => void;
  onRepeatLastAporte?: () => void;
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
  lastAporteCents = 0,
  onZeroAporte,
  onRepeatLastAporte,
  onSubmit,
  onCancelEdit,
}: PocketContributionFormCardProps) {
  const canSubmit = !isPending && (newAmountCents > 0 || newGrossBalanceCents > 0);

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className={`rounded-xl border p-3.5 flex flex-col gap-3.5 transition-colors shadow-xs ${
        editingMarco ? "border-primary/50 bg-primary/5" : "border-border/80 bg-surface"
      }`}
    >
      {/* Cabeçalho do Card: Título + Seletor Segmentado de Tipo na mesma linha */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-border/70">
        <div className="flex items-center gap-2">
          <History className="size-4 text-portfolio shrink-0" aria-hidden="true" />
          <span className="font-semibold text-foreground text-xs sm:text-sm">
            {editingMarco ? "Editar Marco Histórico" : "Adicionar Novo Marco"}
          </span>
          {editingMarco ? <Badge variant="default" size="xs">Modo Edição</Badge> : null}
        </div>

        <div className="flex items-center p-0.5 rounded-lg bg-surface border border-border/80">
          <Button
            type="button"
            variant={entryType === "aporte" ? "default" : "ghost"}
            size="xs"
            sensoryIntent="selection"
            onClick={() => onEntryTypeChange("aporte")}
            className="gap-1 text-xs h-7 px-2.5"
          >
            <ArrowUpRight className="size-3 text-positive-strong" aria-hidden="true" />
            <span>Aporte (+)</span>
          </Button>
          <Button
            type="button"
            variant={entryType === "resgate" ? "warning" : "ghost"}
            size="xs"
            sensoryIntent="selection"
            onClick={() => onEntryTypeChange("resgate")}
            className="gap-1 text-xs h-7 px-2.5"
          >
            <ArrowDownRight className="size-3 text-warning-strong" aria-hidden="true" />
            <span>Resgate (-)</span>
          </Button>
        </div>
      </div>

      {formError ? <Alert variant="error">{formError}</Alert> : null}

      {/* Linha 1: 3 Colunas perfeitamente alinhadas (Data, Valor Aportado, Saldo da Carteira) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
        {/* Coluna 1: Data de Competência */}
        <div className="sm:col-span-4 flex flex-col gap-1">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1" htmlFor="pocket-marco-date">
            <span>Data de Competência</span>
            <span className="text-destructive font-normal" aria-hidden="true">*</span>
          </label>
          <DatePicker
            id="pocket-marco-date"
            value={newDate}
            onValueChange={(d) => {
              if (d) onDateChange(d);
            }}
            placeholder="Data"
            ariaLabel="Data do marco histórico"
          />
          <span className="text-[11px] text-muted-foreground min-h-[16px] flex items-center">
            Mês de competência do aporte
          </span>
        </div>

        {/* Coluna 2: Valor Aportado / Retirado com atalhos abaixo do input */}
        <div className="sm:col-span-4 flex flex-col gap-1">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1" htmlFor="pocket-marco-amount">
            <span>{entryType === "resgate" ? "Valor Retirado" : "Valor Aportado"}</span>
            <span className="text-destructive font-normal" aria-hidden="true">*</span>
          </label>
          <MoneyInput
            id="pocket-marco-amount"
            cents={newAmountCents}
            onCentsChange={onAmountCentsChange}
            placeholder="R$ 0,00"
            className="text-base sm:text-sm"
            showCalculatorAction
          />
          <div className="flex items-center gap-1.5 text-[11px] min-h-[16px] overflow-hidden">
            {onZeroAporte ? (
              <button
                type="button"
                onClick={onZeroAporte}
                className="text-muted-foreground hover:text-foreground underline decoration-dotted transition-colors shrink-0"
                title="Define aporte como R$ 0 para registrar apenas o saldo de fechamento da carteira"
              >
                Sem aporte (R$ 0)
              </button>
            ) : null}
            {onRepeatLastAporte && lastAporteCents > 0 ? (
              <>
                <span className="text-muted-foreground/40 shrink-0">·</span>
                <button
                  type="button"
                  onClick={onRepeatLastAporte}
                  className="text-portfolio hover:text-portfolio-strong font-medium underline decoration-dotted transition-colors truncate"
                  title={`Repete o último valor: ${formatCentsAsBRL(lastAporteCents)}`}
                >
                  Repetir anterior ({formatCentsAsBRL(lastAporteCents)})
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Coluna 3: Saldo da Carteira no Fim do Mês */}
        <div className="sm:col-span-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground" htmlFor="pocket-marco-gross">
              Saldo no Fim do Mês
            </label>
            <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
          </div>
          <MoneyInput
            id="pocket-marco-gross"
            cents={newGrossBalanceCents}
            onCentsChange={onGrossBalanceCentsChange}
            placeholder="R$ 0,00"
            className="text-base sm:text-sm"
            showCalculatorAction
          />
          <span className="text-[11px] text-muted-foreground min-h-[16px] flex items-center">
            Snapshot p/ cota oficial (TWR)
          </span>
        </div>
      </div>

      {/* Linha 2: Rentabilidade, Descrição e Ação de Envio perfeitamente distribuídos */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        {/* Rentabilidade % a.m. */}
        <div className="sm:col-span-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground" htmlFor="pocket-marco-rate">
              Rentabilidade % a.m.
            </label>
            <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
          </div>
          <Input
            id="pocket-marco-rate"
            value={newRatePctText}
            onChange={(e) => onRatePctTextChange(e.target.value)}
            placeholder="Ex: 1,24 ou -0,46"
            className="text-base sm:text-sm h-9"
          />
        </div>

        {/* Descrição */}
        <div className={`flex flex-col gap-1 ${editingMarco ? "sm:col-span-4" : "sm:col-span-5"}`}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground" htmlFor="pocket-marco-notes">
              Descrição
            </label>
            <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
          </div>
          <Input
            id="pocket-marco-notes"
            value={newNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={entryType === "resgate" ? "Ex: Resgate parcial" : "Ex: Aporte mensal"}
            className="text-base sm:text-sm h-9"
          />
        </div>

        {/* Botão de Submit / Cancelar alinhado à base dos campos */}
        <div className={`flex items-center gap-2 pt-1 sm:pt-0 ${editingMarco ? "sm:col-span-5" : "sm:col-span-4"}`}>
          {editingMarco ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelEdit}
              disabled={isPending}
              className="gap-1 flex-1 h-9"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>Cancelar</span>
            </Button>
          ) : null}

          <Button
            type="submit"
            variant="default"
            size="sm"
            loading={isPending}
            disabled={!canSubmit}
            sensoryIntent={false}
            className="gap-1.5 flex-1 h-9"
          >
            {editingMarco ? (
              <Pencil className="size-3.5" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            <span className="truncate">
              {editingMarco
                ? "Salvar"
                : newAmountCents <= 0 && newGrossBalanceCents > 0
                  ? "Gravar Fechamento"
                  : "Adicionar Marco"}
            </span>
          </Button>
        </div>
      </div>
    </form>
  );
}
