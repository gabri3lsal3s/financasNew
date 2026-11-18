import { AlertTriangle, Wallet } from "lucide-react";
import { Button, Checkbox, MoneyText } from "@/components/ui";
import type { EmergencyFundComposition } from "@/domain/projection";

export interface EmergencySummaryBannerProps {
  previewComposition: EmergencyFundComposition;
  coverageMonths: number;
  targetMonths: 3 | 6 | 12;
}

export function EmergencySummaryBanner({
  previewComposition,
  coverageMonths,
  targetMonths,
}: EmergencySummaryBannerProps) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">Reserva Total Configurada</span>
        <MoneyText
          cents={previewComposition.totalReserveCents}
          tone="positive"
          variant="hero"
          className="font-display"
        />
        <span className="text-[11px] text-muted-foreground">
          {previewComposition.cashInAccountsCents > 0 && (
            <span>
              Contas:{" "}
              <MoneyText cents={previewComposition.cashInAccountsCents} tone="default" variant="caption" className="font-medium" />
            </span>
          )}
          {previewComposition.cashInAccountsCents > 0 && previewComposition.portfolioReserveCents > 0 && " + "}
          {previewComposition.portfolioReserveCents > 0 && (
            <span>
              Investimentos:{" "}
              <MoneyText cents={previewComposition.portfolioReserveCents} tone="default" variant="caption" className="font-medium" />
            </span>
          )}
        </span>
      </div>

      <div className="flex flex-col sm:items-end gap-1">
        <span className="text-xs font-medium text-muted-foreground">Cobertura Estimada</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold font-display text-foreground tabular-nums">
            {coverageMonths} {coverageMonths === 1 ? "mês" : "meses"}
          </span>
          <span className="text-xs text-muted-foreground">
            (~{Math.round(coverageMonths * 30)} dias)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>Meta pessoal ({targetMonths}m):</span>
          <span className="font-semibold text-foreground tabular-nums">
            {previewComposition.targetMonthsProgressPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}

export interface EmergencyCheckingAccountCardProps {
  includeCheckingAccounts: boolean;
  onIncludeCheckingAccountsChange: (checked: boolean) => void;
  realCashCents: number;
}

export function EmergencyCheckingAccountCard({
  includeCheckingAccounts,
  onIncludeCheckingAccountsChange,
  realCashCents,
}: EmergencyCheckingAccountCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-surface-hover text-muted-foreground shrink-0">
            <Wallet className="size-4" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">Saldo em Contas Correntes</span>
            <span className="text-xs text-muted-foreground">
              Considera o saldo líquido de contas e caixas como capital de emergência imediato.
            </span>
          </div>
        </div>
        <Checkbox
          checked={includeCheckingAccounts}
          onCheckedChange={onIncludeCheckingAccountsChange}
          aria-label="Incluir contas correntes na reserva"
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs pt-2 border-t border-border/80">
        <span className="text-muted-foreground">Disponível em conta corrente:</span>
        <MoneyText cents={realCashCents} tone="default" className="font-semibold" />
      </div>
    </div>
  );
}

export interface EmergencyPrecisionSectionProps {
  useNetValue: boolean;
  onUseNetValueChange: (checked: boolean) => void;
  targetMonths: 3 | 6 | 12;
  onTargetMonthsChange: (months: 3 | 6 | 12) => void;
  warnings: EmergencyFundComposition["warnings"];
}

export function EmergencyPrecisionSection({
  useNetValue,
  onUseNetValueChange,
  targetMonths,
  onTargetMonthsChange,
  warnings,
}: EmergencyPrecisionSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">Descontar IR Regressivo</span>
            <Checkbox
              checked={useNetValue}
              onCheckedChange={onUseNetValueChange}
              aria-label="Descontar IR regressivo da renda fixa"
            />
          </div>
          <span className="text-[11px] text-muted-foreground">
            Utiliza o valor líquido estimado de resgate para títulos de renda fixa tributáveis.
          </span>
        </div>

        <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
          <span className="text-xs font-semibold text-foreground">Meta Pessoal de Autonomia</span>
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {([3, 6, 12] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant={targetMonths === m ? "default" : "outline"}
                size="sm"
                sensoryIntent="selection"
                onClick={() => onTargetMonthsChange(m)}
                className="font-medium"
              >
                {m} Meses
              </Button>
            ))}
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-3.5 flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-strong">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>Diagnósticos da Seleção Atual ({warnings.length}):</span>
          </div>
          <ul className="flex flex-col gap-1 text-[11px] text-muted-foreground pl-5 list-disc">
            {warnings.map((w) => (
              <li key={w.id}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
