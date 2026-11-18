import { AlertCircle } from "lucide-react";
import { Checkbox, FormField, Select, Textarea } from "@/components/ui";
import {
  CRITERIA_BY_ARCHETYPE,
  getScoreArchetypeKey,
  REVIEW_FREQUENCY_OPTIONS,
} from "@/domain/portfolio";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface AssetGovernanceDetailsSectionProps {
  assetClass?: string | null;
  scoreCriteria: Record<string, number>;
  onToggleCriterion: (key: string) => void;
  thesisSummary: string;
  onThesisSummaryChange: (value: string) => void;
  reviewFrequencyMonths: number | null;
  onReviewFrequencyMonthsChange: (months: number) => void;
  lastReviewedAt?: string | null;
  showLastReviewed?: boolean;
  isWizard?: boolean;
  idPrefix: string;
}

export function AssetGovernanceDetailsSection({
  assetClass,
  scoreCriteria,
  onToggleCriterion,
  thesisSummary,
  onThesisSummaryChange,
  reviewFrequencyMonths,
  onReviewFrequencyMonthsChange,
  lastReviewedAt,
  showLastReviewed = false,
  isWizard = false,
  idPrefix,
}: AssetGovernanceDetailsSectionProps) {
  const archetypeKey = getScoreArchetypeKey(assetClass);
  const availableCriteria = CRITERIA_BY_ARCHETYPE[archetypeKey] || CRITERIA_BY_ARCHETYPE.default!;
  const metCount = availableCriteria.filter((c) => (scoreCriteria?.[c.key] ?? 0) >= 1).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            Critérios da Tese ({assetClass ?? "Geral"})
          </span>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
            {metCount} / {availableCriteria.length} atendidos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availableCriteria.map((criterion) => {
            const isChecked = (scoreCriteria?.[criterion.key] ?? 0) >= 1;
            return (
              <div
                key={criterion.key}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-2.5 transition-colors",
                  isChecked
                    ? "border-positive/40 bg-positive/5 text-foreground"
                    : "border-border/80 bg-surface-raised/40 text-muted-foreground",
                )}
              >
                <Checkbox
                  id={`${idPrefix}-criterion-${criterion.key}`}
                  checked={isChecked}
                  onCheckedChange={() => onToggleCriterion(criterion.key)}
                />
                <label
                  htmlFor={`${idPrefix}-criterion-${criterion.key}`}
                  className="flex flex-col gap-0.5 min-w-0 cursor-pointer select-none"
                >
                  <span className="text-xs font-semibold text-foreground leading-tight">
                    {criterion.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-snug">
                    {criterion.description}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <FormField
          label="Resumo da Tese de Investimento"
          htmlFor={`${idPrefix}-thesis`}
          optional={isWizard}
          className="sm:col-span-2"
        >
          <Textarea
            id={`${idPrefix}-thesis`}
            rows={3}
            placeholder="Ex.: Líder de mercado com forte geração de caixa e vantagem competitiva..."
            value={thesisSummary}
            onChange={(e) => onThesisSummaryChange(e.target.value)}
            className="min-h-[80px] resize-none text-base sm:text-sm"
          />
        </FormField>

        <div className="flex flex-col gap-1.5">
          <FormField label="Periodicidade de Revisão">
            <Select
              value={String(reviewFrequencyMonths ?? 6)}
              onValueChange={(val) => onReviewFrequencyMonthsChange(Number(val) || 6)}
              options={[...REVIEW_FREQUENCY_OPTIONS]}
            />
          </FormField>

          {showLastReviewed &&
            (lastReviewedAt ? (
              <span className="text-[11px] text-muted-foreground mt-1">
                Última revisão formal:{" "}
                <strong className="text-foreground">{formatDateBR(lastReviewedAt)}</strong>
              </span>
            ) : (
              <span className="text-[11px] text-warning-strong mt-1 flex items-center gap-1">
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                Nunca revisado formalmente
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
