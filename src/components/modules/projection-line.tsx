import { CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui";
import { formatCentsAsBRL } from "@/services/masks/money";
import { cn } from "@/lib/utils";

export interface ProjectionLineProps {
  /** Valor diário disponível (centavos) — null quando o mês está encerrado. */
  dailyCents: number | null;
  /** Projeção de despesas do fim do mês (centavos) — null quando não aplicável. */
  projectedExpensesCents: number | null;
  /** Superávit projetado (centavos) — null quando não aplicável. */
  surplusCents: number | null;
  /** No trilho? — null quando não aplicável. */
  onTrack: boolean | null;
  /** % do orçamento já gasto (0–100+) — ritmo. */
  spentPercent?: number;
  /** % do mês decorrido (0–100) — ritmo. */
  elapsedPercent?: number;
  /** Ritmo ativo (8º dia + fração ≥ 30%)? */
  paceActive?: boolean;
}

/**
 * Linha de projeção (§3.8) — gasto diário disponível, ritmo e projeção de
 * fim de mês. Usada nas telas de Projeção/Corte e Insights.
 */
export function ProjectionLine({
  dailyCents,
  projectedExpensesCents,
  surplusCents,
  onTrack,
  spentPercent = 0,
  elapsedPercent = 0,
  paceActive = false,
}: ProjectionLineProps) {
  return (
    <section aria-label="Projeção de gastos" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Projeção de gastos</h3>
        {onTrack !== null ? (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              onTrack ? "text-positive-strong" : "text-critical",
            )}
          >
            {onTrack ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
            {onTrack ? "No trilho" : "Fora do trilho"}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Diário disponível</span>
          <span className="num text-lg font-semibold text-foreground">
            {dailyCents === null ? "—" : formatCentsAsBRL(dailyCents)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Projeção do mês</span>
          <span className="num text-lg font-semibold text-foreground">
            {projectedExpensesCents === null ? "—" : formatCentsAsBRL(projectedExpensesCents)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Superávit projetado</span>
          <span
            className={cn(
              "num text-lg font-semibold",
              surplusCents === null ? "text-foreground" : surplusCents >= 0 ? "text-positive-strong" : "text-critical",
            )}
          >
            {surplusCents === null ? "—" : formatCentsAsBRL(surplusCents)}
          </span>
        </div>
      </div>

      {paceActive ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="size-3" aria-hidden="true" />
              Ritmo de gastos
            </span>
            <span>
              {spentPercent.toFixed(0)}% gasto · {elapsedPercent.toFixed(0)}% do mês
            </span>
          </div>
          <Progress value={Math.min(100, spentPercent)} tone="auto" aria-label={`Ritmo de gastos: ${spentPercent.toFixed(0)}%`} />
        </div>
      ) : null}
    </section>
  );
}
