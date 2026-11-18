import { AlertCircle } from "lucide-react";
import { Badge, MoneyText } from "@/components/ui";
import type { GoalCompositionResult } from "@/types/goals";

export interface GoalCompositionPreviewCardProps {
  preview: GoalCompositionResult;
  targetCents: number;
}

export function GoalCompositionPreviewCard({
  preview,
  targetCents,
}: GoalCompositionPreviewCardProps) {
  const safeTarget = Math.max(1, targetCents);
  const contribPct = Math.min(100, (preview.totalDesembolsadoCents / safeTarget) * 100);
  const yieldPct = Math.min(100 - contribPct, (preview.totalRendimentosCents / safeTarget) * 100);

  return (
    <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Progresso Previsto
        </span>
        <Badge
          variant={preview.isReached ? "positive" : "portfolio"}
          size="xs"
          className="font-semibold"
        >
          {Math.round(preview.progressPercent)}% Concluído
        </Badge>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <MoneyText
            cents={preview.currentCents}
            tone="default"
            className="text-lg font-bold text-foreground"
          />
          <span className="text-muted-foreground text-xs">
            de <MoneyText cents={targetCents} tone="default" className="text-xs" />
          </span>
        </div>
        {preview.isCapApplied && (
          <Badge variant="warning" size="xs">
            Teto Aplicado
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
          <div
            style={{ width: `${contribPct}%` }}
            className="h-full bg-primary transition-all duration-300"
            title="Aportes e Desembolsos Realizados"
          />
          <div
            style={{ width: `${yieldPct}%` }}
            className="h-full bg-portfolio transition-all duration-300"
            title="Rendimentos e Juros Compostos"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            <span>
              Aportes: <MoneyText cents={preview.totalDesembolsadoCents} />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-portfolio" aria-hidden="true" />
            <span>
              Rendimentos: <MoneyText cents={preview.totalRendimentosCents} />
            </span>
          </div>
        </div>
      </div>

      {preview.warnings.length > 0 && (
        <div className="rounded-lg bg-warning/10 border border-warning/20 p-2 text-[11px] text-warning-strong flex flex-col gap-1">
          {preview.warnings.map((w, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
