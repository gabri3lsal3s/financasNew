import { Progress } from "@/components/ui/progress";
import { MoneyText } from "@/components/ui/money-text";

export interface BudgetProgressBarProps {
  spentCents: number;
  limitCents: number;
  /** Rótulo opcional acima da barra (ex.: nome da categoria). */
  label?: string;
}

/**
 * Progresso de orçamento — módulo de domínio reutilizável.
 * O `Progress` com `tone="auto"` aplica as faixas do DESIGN_SYSTEM §2.3
 * (≥ 85% crítico, ≥ 70% atenção); as faixas de orçamento 85/90/95% são
 * refinadas na entrega 2.7 (orçamentos).
 */
export function BudgetProgressBar({ spentCents, limitCents, label }: BudgetProgressBarProps) {
  const percent = limitCents > 0 ? Math.min(100, (spentCents / limitCents) * 100) : 0;
  const over = spentCents > limitCents;

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {label ? <p className="truncate text-xs font-medium text-muted-foreground">{label}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 min-w-0">
        <span className="flex flex-wrap items-center gap-1 text-xs min-w-0">
          <MoneyText cents={spentCents} tone="default" className="text-xs font-medium" />
          <span className="text-muted-foreground">de</span>
          <MoneyText cents={limitCents} tone="default" className="text-xs text-muted-foreground" />
        </span>
        <span className={over ? "num shrink-0 text-xs font-semibold text-critical" : "num shrink-0 text-xs text-muted-foreground"}>
          {over ? "Excedido" : `${Math.round(percent)}%`}
        </span>
      </div>
      <Progress value={percent} tone="auto" aria-label={`Uso do orçamento: ${Math.round(percent)}%`} />
    </div>
  );
}
