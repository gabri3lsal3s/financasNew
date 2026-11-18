import { Clock, SlidersHorizontal } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { AssetDetailMetrics } from "./use-asset-detail-metrics";

export interface AssetGovernanceCardProps {
  metrics: AssetDetailMetrics;
  onOpenEvaluation: () => void;
}

export function AssetGovernanceCard({ metrics, onOpenEvaluation }: AssetGovernanceCardProps) {
  const {
    currentAsset,
    effectiveResult,
    assetScore,
    allocationStatus,
    convictionMeta,
    statusMeta,
    archetypeCriteria,
    metCriteriaCount,
    reviewFreqMonths,
    isReviewOverdue,
  } = metrics;

  const statusBadgeVariant =
    allocationStatus === "active"
      ? ("positive" as const)
      : allocationStatus === "quarantine"
        ? ("warning" as const)
        : allocationStatus === "exit"
          ? ("negative" as const)
          : ("muted" as const);

  const scoreBadgeVariant =
    assetScore === null
      ? ("muted" as const)
      : assetScore >= 7
        ? ("positive" as const)
        : assetScore >= 4
          ? ("warning" as const)
          : ("negative" as const);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Tese &amp; Governança do Ativo
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={scoreBadgeVariant} size="xs">
            {assetScore !== null ? `Nota ${assetScore}/10` : "Sem nota"}
          </Badge>
          <Badge variant={statusBadgeVariant} size="xs">{statusMeta.label}</Badge>
          {assetScore !== null ? <Badge variant="muted" size="xs">{convictionMeta.label}</Badge> : null}
          {isReviewOverdue ? (
            <Badge variant="warning" size="xs" className="gap-1">
              <Clock className="size-3" aria-hidden="true" />
              <span>Revisão vencida</span>
            </Badge>
          ) : null}
        </div>
      </div>

      {effectiveResult?.formulaLabel ? (
        <p className="text-[11px] text-muted-foreground">
          Fórmula na carteira:{" "}
          <span className="font-medium text-foreground">{effectiveResult.formulaLabel}</span>
        </p>
      ) : null}

      {currentAsset.thesis_summary ? (
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Tese de Investimento
          </span>
          <p className="text-xs text-foreground/90 italic bg-surface-hover/50 border-l-2 border-primary/50 rounded-r-lg p-2.5">
            &ldquo;{currentAsset.thesis_summary}&rdquo;
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs pt-1">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Ciclo de Revisão
          </span>
          <span className="text-xs font-semibold text-foreground">
            A cada {reviewFreqMonths} meses
          </span>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Critérios Atendidos
          </span>
          <span className="text-xs font-semibold text-foreground font-mono">
            {metCriteriaCount}/{archetypeCriteria.length}
          </span>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Última Avaliação
          </span>
          <span className="text-xs font-semibold text-foreground">
            {currentAsset.last_reviewed_at
              ? formatDateBR(currentAsset.last_reviewed_at.slice(0, 10))
              : "Não registrada"}
          </span>
        </div>

        <div className="flex flex-col justify-end min-w-0 col-span-2 sm:col-span-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenEvaluation}
            className="gap-1.5 text-xs font-medium w-full"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            <span>Avaliar Tese &amp; Nota</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
