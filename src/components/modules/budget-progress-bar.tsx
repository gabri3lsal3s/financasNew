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
    <div className="flex flex-col gap-1.5">
      {label ? <p className="text-xs font-medium text-muted-foreground">{label}</p> : null}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          <MoneyText cents={spentCents} tone="default" />
          <span className="text-muted-foreground">de</span>
          <MoneyText cents={limitCents} tone="default" className="text-muted-foreground" />
        </span>
        <span className={over ? "num text-xs font-semibold text-critical" : "num text-xs text-muted-foreground"}>
          {over ? "Excedido" : `${Math.round(percent)}%`}
        </span>
      </div>
      <Progress value={percent} tone="auto" aria-label={`Uso do orçamento: ${Math.round(percent)}%`} />
    </div>
  );
}
