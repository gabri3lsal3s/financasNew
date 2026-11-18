import type { RefObject } from "react";
import { AlertCircle, Calendar, Pencil, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import {
  cleanContributionNotes,
  extractExplicitRateFromNotes,
  isHistoricalWithdrawal,
} from "@/domain/portfolio/pocket-statement-parser";
import { formatDateBR } from "@/lib/date";
import type { PortfolioContribution, PortfolioSnapshot } from "@/types";
import { PocketContributionFormCard } from "./pocket-contribution-form-card";

export interface PocketContributionsLedgerTabProps {
  formRef: RefObject<HTMLFormElement | null>;
  historicalContributions: readonly PortfolioContribution[];
  snapshotsCount: number;
  snapshotsByMonth: ReadonlyMap<string, PortfolioSnapshot>;
  netPocketCapitalBRL: number;
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
  deletingId: string | null;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onStartEdit: (marco: PortfolioContribution) => void;
  onCancelEdit: () => void;
  onDelete: (marco: PortfolioContribution) => void;
}

export function PocketContributionsLedgerTab(props: PocketContributionsLedgerTabProps) {
  const {
    historicalContributions,
    snapshotsCount,
    snapshotsByMonth,
    netPocketCapitalBRL,
    editingMarco,
    deletingId,
    onStartEdit,
    onDelete,
  } = props;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-2.5">
        <AlertCircle className="size-4 text-warning-strong shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex flex-col gap-0.5 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">
            Informe apenas as movimentações do mês (Deltas)
          </span>
          <p>
            Cadastre apenas o dinheiro que <strong>entrou (Aporte)</strong> ou <strong>saiu (Resgate)</strong> da sua conta. Se tiver o extrato bancário com o valor acumulado mês a mês, utilize a aba <strong>Assistente de Extrato</strong> para calcular tudo automaticamente.
          </p>
        </div>
      </div>

      <PocketContributionFormCard
        formRef={props.formRef}
        editingMarco={props.editingMarco}
        entryType={props.entryType}
        onEntryTypeChange={props.onEntryTypeChange}
        newDate={props.newDate}
        onDateChange={props.onDateChange}
        newAmountCents={props.newAmountCents}
        onAmountCentsChange={props.onAmountCentsChange}
        newGrossBalanceCents={props.newGrossBalanceCents}
        onGrossBalanceCentsChange={props.onGrossBalanceCentsChange}
        newRatePctText={props.newRatePctText}
        onRatePctTextChange={props.onRatePctTextChange}
        newNotes={props.newNotes}
        onNotesChange={props.onNotesChange}
        formError={props.formError}
        isPending={props.isPending}
        onSubmit={props.onSubmit}
        onCancelEdit={props.onCancelEdit}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-xs">
              Marcos Registrados ({historicalContributions.length})
            </span>
            {snapshotsCount > 0 ? (
              <Badge variant="muted" size="xs" className="font-normal text-muted-foreground">
                {snapshotsCount} snapshots (TWR)
              </Badge>
            ) : null}
          </div>
          <span className="text-[11px] text-muted-foreground">
            Líquido: <MoneyText cents={numberToCents(netPocketCapitalBRL)} />
          </span>
        </div>

        {historicalContributions.length === 0 ? (
          <EmptyState
            title="Nenhum marco cadastrado"
            description="Cadastre o seu primeiro marco acima ou importe pelo Assistente de Extrato para que a TIR calcule o retorno sobre o capital real."
            headingLevel="h3"
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {historicalContributions.map((marco) => {
              const isWithdrawal = isHistoricalWithdrawal(marco);
              const snap = snapshotsByMonth.get(marco.date.slice(0, 7));
              const explicitRate = extractExplicitRateFromNotes(marco.notes);
              const cleanNotes = cleanContributionNotes(marco.notes);
              const formattedDate = formatDateBR(marco.date);
              return (
                <div
                  key={marco.id}
                  className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2.5 transition-colors ${
                    editingMarco?.id === marco.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/80 bg-surface hover:bg-surface-hover/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Calendar className={`size-4 shrink-0 ${isWithdrawal ? "text-warning-strong" : "text-muted-foreground"}`} aria-hidden="true" />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-medium text-foreground text-xs">{formattedDate}</span>
                        <Badge variant={isWithdrawal ? "warning" : "muted"} size="xs">
                          {isWithdrawal ? "Resgate" : "Aporte"}
                        </Badge>
                        {snap && snap.total_value > 0 ? (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            Saldo: <MoneyText cents={numberToCents(snap.total_value)} variant="caption" tone="default" />
                          </span>
                        ) : null}
                        {explicitRate !== null ? (
                          <Badge variant={explicitRate >= 0 ? "positive" : "negative"} size="xs" className="font-mono">
                            {explicitRate >= 0 ? `+${explicitRate}%` : `${explicitRate}%`}
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {cleanNotes || "Marco Histórico"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`font-mono font-semibold text-xs tabular-nums ${isWithdrawal ? "text-warning-strong" : "text-foreground"}`}>
                      {isWithdrawal ? "- " : "+ "}
                      <MoneyText
                        cents={numberToCents(Number(marco.amount))}
                        tone="default"
                        className={isWithdrawal ? "text-warning-strong" : undefined}
                      />
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      sensoryIntent="selection"
                      onClick={() => onStartEdit(marco)}
                      aria-label={`Editar marco de ${formattedDate}`}
                      className="size-8 p-0 shrink-0 text-muted-foreground hover:text-primary-strong hover:bg-primary/10"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      sensoryIntent={false}
                      onClick={() => onDelete(marco)}
                      disabled={deletingId === marco.id}
                      aria-label={`Excluir marco de ${formattedDate}`}
                      className="size-8 p-0 shrink-0 text-muted-foreground hover:text-critical-strong hover:bg-critical/10"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
