import { TrendingDown, TrendingUp } from "lucide-react";
import { percentChange } from "@/domain/overview";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks";

export interface DeltaHintProps {
  currentCents: number;
  previousCents: number;
  /** Inverte a semântica (ex.: despesas — subir é ruim). */
  invert?: boolean;
}

/**
 * Comparativo Δ vs. período anterior — módulo de domínio reutilizável (F14).
 * Extraído da Overview (F2): mesmo comportamento, agora compartilhado com o
 * KPI Patrimônio da carteira (DRY — regra de ouro §4).
 */
export function DeltaHint({ currentCents, previousCents, invert }: DeltaHintProps) {
  const delta = percentChange(currentCents, previousCents);
  if (delta === null) return null;
  const up = delta >= 0;
  const positive = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5", positive ? "text-positive-strong" : "text-negative-strong")}>
      <Icon className="size-3" aria-hidden="true" />
      <span>{formatPercent(Math.abs(delta))}%</span>
    </span>
  );
}
