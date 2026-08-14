import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { MoneyText } from "@/components/ui/money-text";
import type { SpendingPace } from "@/domain/projection";

export interface SmartSpendingPaceCardProps {
  /** Ritmo calculado (domain/projection) — null quando indisponível. */
  pace: SpendingPace | null;
  /** Gasto disponível diário (centavos) — null fora do mês atual. */
  dailyCents: number | null;
}

/** Card inteligente de ritmo de gastos (F8) — motores de domain/projection. */
export function SmartSpendingPaceCard({ pace, dailyCents }: SmartSpendingPaceCardProps) {
  const active = pace?.active ?? false;
  const ahead = pace?.ahead ?? false;

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center">
          <Gauge className="size-4 text-foreground" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold text-foreground">Ritmo de gastos</h2>
      </div>

      {!active ? (
        <p className="text-xs text-muted-foreground">
          Acompanhamento ativo a partir do 8º dia do mês (fração decorrida ≥ 30%).
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="num text-2xl font-semibold text-foreground">
              {Math.round(pace?.spentPercent ?? 0)}%
            </p>
            <p className="text-xs text-muted-foreground">
              do orçamento gasto · {Math.round(pace?.elapsedPercent ?? 0)}% do mês decorrido
            </p>
          </div>
          <p className={cn("text-xs font-medium", ahead ? "text-critical" : "text-positive-strong")}>
            {ahead ? "Acima do ritmo esperado" : "No ritmo esperado"}
            {pace && pace.gapPoints !== 0 ? ` (${Math.abs(Math.round(pace.gapPoints))} pontos ${ahead ? "acima" : "abaixo"})` : ""}
          </p>
        </div>
      )}

      {dailyCents !== null ? (
        <p className="text-xs text-muted-foreground">
          Disponível hoje: <MoneyText cents={dailyCents} tone="default" className="text-xs" />
        </p>
      ) : null}
    </article>
  );
}
