import { Calendar, Check, Edit2, Trash2, User } from "lucide-react";
import { Button, DatePicker, Input, MoneyInput, MoneyText } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { GoalContribution } from "@/types";

export interface ContributionHistoryRowProps {
  contribution: GoalContribution;
  isEditing: boolean;
  isPending: boolean;
  editAmountCents: number;
  editContributorName: string;
  editDate: string;
  onEditAmountChange: (cents: number) => void;
  onEditNameChange: (name: string) => void;
  onEditDateChange: (date: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onRequestDelete: () => void;
}

export function ContributionHistoryRow({
  contribution,
  isEditing,
  isPending,
  editAmountCents,
  editContributorName,
  editDate,
  onEditAmountChange,
  onEditNameChange,
  onEditDateChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
}: ContributionHistoryRowProps) {
  if (isEditing) {
    return (
      <div className="p-3 bg-muted/20 flex flex-col gap-3">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Edit2 className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Editar Depósito</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`edit-amt-${contribution.id}`} className="text-xs font-semibold text-foreground">
              Valor
            </label>
            <MoneyInput
              id={`edit-amt-${contribution.id}`}
              cents={editAmountCents}
              onCentsChange={onEditAmountChange}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`edit-name-${contribution.id}`} className="text-xs font-semibold text-foreground">
              Nome de quem pagou
            </label>
            <Input
              id={`edit-name-${contribution.id}`}
              value={editContributorName}
              onChange={(e) => onEditNameChange(e.target.value)}
              placeholder="Nome ou Anônimo"
              className="text-base sm:text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`edit-date-${contribution.id}`} className="text-xs font-semibold text-foreground">
              Data
            </label>
            <DatePicker
              id={`edit-date-${contribution.id}`}
              value={editDate}
              onChange={(next) => onEditDateChange(next ?? contribution.date)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            sensoryIntent="success"
            disabled={editAmountCents <= 0 || isPending}
            onClick={onSaveEdit}
            className="gap-1.5"
            aria-label="Salvar Alterações"
          >
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Salvar Alterações</span>
            <span className="sm:hidden">Salvar</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border/80 text-muted-foreground">
          <User className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            {contribution.contributor_name || "Participante Anônimo"}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>{formatDateBR(contribution.date)}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <MoneyText
          cents={contribution.amount_cents}
          tone="positive"
          variant="value"
          className="font-bold"
        />

        <Button
          type="button"
          size="icon"
          variant="ghost"
          sensoryIntent="selection"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={onStartEdit}
          title="Editar nome ou valor deste depósito"
          aria-label={`Editar depósito de ${contribution.contributor_name || "anônimo"}`}
        >
          <Edit2 className="size-3.5" aria-hidden="true" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 text-critical-strong hover:text-critical-strong hover:bg-critical/10"
          onClick={onRequestDelete}
          title="Excluir este depósito"
          aria-label={`Excluir depósito de ${contribution.contributor_name || "anônimo"}`}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
