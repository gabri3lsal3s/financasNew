import { ArrowRight, CalendarClock, FileUp } from "lucide-react";
import { Button } from "@/components/ui";
import { monthLabel } from "@/lib/date";

export interface StatementCompetenceConflictProps {
  detectedCompetenceMonth: string;
  activeCompetenceMonth: string;
  detectedDueDate?: string | null;
  isBusy?: boolean;
  onKeepCurrent: () => void;
  onChangeFile: () => void;
  onSwitchCompetence: (targetMonth: string) => void;
}

/**
 * Confirmação limpa inline quando o documento pertence a uma competência diferente da selecionada.
 */
export function StatementCompetenceConflict({
  detectedCompetenceMonth,
  activeCompetenceMonth,
  detectedDueDate,
  isBusy = false,
  onKeepCurrent,
  onChangeFile,
  onSwitchCompetence,
}: StatementCompetenceConflictProps) {
  return (
    <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex items-start gap-3">
        <CalendarClock
          className="size-4 text-warning-strong shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="space-y-1.5 min-w-0">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 break-words">
            Fatura detectada em outro mês
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            O documento enviado corresponde à competência de{" "}
            <strong className="text-foreground">{monthLabel(detectedCompetenceMonth)}</strong>,
            enquanto o diálogo foi aberto em{" "}
            <strong className="text-foreground">{monthLabel(activeCompetenceMonth)}</strong>.
          </p>
          {detectedDueDate ? (
            <p className="text-xs text-muted-foreground">
              Vencimento identificado:{" "}
              <strong className="text-foreground">
                {detectedDueDate.split("-").reverse().join("/")}
              </strong>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-border/80">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isBusy}
          onClick={onKeepCurrent}
          className="text-xs text-muted-foreground hover:text-foreground sm:mr-auto"
        >
          Manter {monthLabel(activeCompetenceMonth)} mesmo assim
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={onChangeFile}
          className="gap-1.5"
        >
          <FileUp className="size-3.5" aria-hidden="true" />
          Trocar arquivo
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isBusy}
          onClick={() => onSwitchCompetence(detectedCompetenceMonth)}
          className="gap-1.5"
        >
          <span>Ajustar para {monthLabel(detectedCompetenceMonth)} e prosseguir</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
