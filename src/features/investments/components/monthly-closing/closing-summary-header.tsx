import { AlertCircle, Check, RotateCcw, ShieldCheck, Wallet } from "lucide-react";
import { Badge, Button, MoneyInput, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { formatMonthYear } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "@/services/masks/percent";
import type { ClosingRecalculatedSummary } from "./use-monthly-closing-draft";

export interface ClosingSummaryHeaderProps {
  month: string;
  isBalanceOnly: boolean;
  snapshotTotalValue: number | null;
  cashBalanceCents: number;
  onCashBalanceChange: (cents: number) => void;
  summary: ClosingRecalculatedSummary;
  isSaving: boolean;
  onReset: () => void;
  onSave: () => void;
}

export function ClosingSummaryHeader({
  month,
  isBalanceOnly,
  snapshotTotalValue,
  cashBalanceCents,
  onCashBalanceChange,
  summary,
  isSaving,
  onReset,
  onSave,
}: ClosingSummaryHeaderProps) {
  const custodyCount = summary.items.filter((i) => i.quantity > 0).length;
  const isTwaAligned = Math.abs(summary.discrepancyBRL ?? 0) < 1;

  return (
    <div className="flex flex-col gap-4">
      {isBalanceOnly ? (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-2.5 shadow-xs">
          <AlertCircle className="size-4 text-warning-strong shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="font-semibold text-foreground">
              Competência registrada apenas com saldo consolidado (TWA)
            </span>
            <p className="text-muted-foreground leading-relaxed m-0 text-[11px]">
              O saldo registrado no histórico de rentabilidade para este mês é de{" "}
              <MoneyText
                cents={numberToCents(snapshotTotalValue ?? 0)}
                tone="portfolio"
                className="inline font-bold"
              />
              . Carregamos os ativos da sua carteira abaixo para você calibrar quantidades, cotações e saldo de caixa.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-2.5 min-w-0">
          <ShieldCheck className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground">
              Conferência e Calibração do Fechamento ({month})
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed m-0">
              Revise e calibre as quantidades e cotações de fechamento para auditar {formatMonthYear(month)}. Ao salvar, o Relatório Executivo A4 será atualizado oficialmente.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            disabled={isSaving}
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Restaurar Valores</span>
          </Button>

          <Button
            type="button"
            onClick={onSave}
            loading={isSaving}
            disabled={isSaving}
            size="sm"
            sensoryIntent={false}
            className="gap-1.5 font-semibold"
          >
            <Check className="size-3.5" aria-hidden="true" />
            <span>Salvar Fechamento &amp; Gerar Relatório</span>
          </Button>
        </div>
      </div>

      {summary.snapshotTargetValue !== null ? (
        <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                Saldo Registrado no TWA
              </span>
              <MoneyText
                cents={numberToCents(summary.snapshotTargetValue)}
                tone="portfolio"
                className="text-sm sm:text-base font-bold"
              />
            </div>
            <span className="text-muted-foreground text-sm font-medium" aria-hidden="true">vs</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                Patrimônio Calibrado (Ativos + Caixa)
              </span>
              <MoneyText
                cents={numberToCents(summary.totalValueBRL)}
                tone={isTwaAligned ? "positive" : "default"}
                className={cn(
                  "text-sm sm:text-base font-bold",
                  !isTwaAligned && "text-warning-strong",
                )}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isTwaAligned ? (
              <Badge variant="positive" size="sm" className="font-semibold">
                100% Alinhado ao Saldo TWA
              </Badge>
            ) : (
              <Badge variant="warning" size="sm" className="font-semibold gap-1">
                <MoneyText
                  cents={numberToCents(summary.discrepancyBRL ?? 0)}
                  sign="explicit"
                  variant="caption"
                />{" "}
                vs TWA
              </Badge>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-1 shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Patrimônio Recalculado
          </span>
          <MoneyText
            cents={numberToCents(summary.totalValueBRL)}
            tone="portfolio"
            className="text-base sm:text-lg font-bold"
          />
          <span className="text-[11px] text-muted-foreground">
            {custodyCount} ativos com custódia
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-1 shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Custo Total Histórico
          </span>
          <MoneyText
            cents={numberToCents(summary.totalCostBRL)}
            tone="default"
            className="text-base sm:text-lg font-bold"
          />
          <span className="text-[11px] text-muted-foreground">
            Custo apurado até {formatMonthYear(month)}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-1 shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Resultado Contábil
          </span>
          <MoneyText
            cents={numberToCents(summary.gainBRL)}
            tone={summary.gainBRL >= 0 ? "positive" : "negative"}
            sign="explicit"
            className="text-base sm:text-lg font-bold"
          />
          <span className="text-[11px] font-mono text-muted-foreground">
            {formatSignedPct(summary.gainPct)} sobre o custo
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-1.5 shadow-xs">
          <label
            htmlFor="closing-cash-balance"
            className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"
          >
            <Wallet className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Saldo de Caixa</span>
          </label>
          <MoneyInput
            id="closing-cash-balance"
            cents={cashBalanceCents}
            onCentsChange={onCashBalanceChange}
            aria-label="Saldo de caixa no fechamento"
            className="text-base sm:text-sm font-mono font-bold"
            showCalculatorAction
          />
          <span className="text-[11px] text-muted-foreground truncate">Liquidez livre no mês</span>
        </div>
      </div>
    </div>
  );
}
