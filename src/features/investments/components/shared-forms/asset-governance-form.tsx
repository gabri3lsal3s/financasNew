import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Ban, Clock, ShieldCheck, Sparkles } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  ChoiceCard,
} from "@/components/ui";
import {
  ALLOCATION_STATUS_META,
  CRITERIA_BY_ARCHETYPE,
  getScoreArchetypeKey,
  getScoreConvictionMeta,
  REVIEW_FREQUENCY_OPTIONS,
} from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { AssetAllocationStatus } from "@/types";
import { AssetGovernanceDetailsSection } from "./asset-governance-details-section";

export interface AssetGovernanceFormProps {
  assetClass?: string | null;
  score: number | null;
  onScoreChange: (score: number | null) => void;
  allocationStatus: AssetAllocationStatus;
  onAllocationStatusChange: (status: AssetAllocationStatus) => void;
  scoreCriteria: Record<string, number>;
  onToggleCriterion: (key: string) => void;
  thesisSummary: string;
  onThesisSummaryChange: (value: string) => void;
  reviewFrequencyMonths: number | null;
  onReviewFrequencyMonthsChange: (months: number) => void;
  lastReviewedAt?: string | null;
  showLastReviewed?: boolean;
  collapsibleDetails?: boolean;
  interactionMode?: "wizard" | "dialog";
  effectiveTargetSlot?: ReactNode;
  idPrefix: string;
}

const SCORE_SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const STATUS_ITEMS: readonly { value: AssetAllocationStatus; icon: typeof ShieldCheck }[] = [
  { value: "active", icon: ShieldCheck },
  { value: "neutral", icon: ArrowRight },
  { value: "quarantine", icon: AlertTriangle },
  { value: "exit", icon: Ban },
];

export function AssetGovernanceForm({
  assetClass,
  score,
  onScoreChange,
  allocationStatus,
  onAllocationStatusChange,
  scoreCriteria,
  onToggleCriterion,
  thesisSummary,
  onThesisSummaryChange,
  reviewFrequencyMonths,
  onReviewFrequencyMonthsChange,
  lastReviewedAt,
  showLastReviewed = false,
  collapsibleDetails = false,
  interactionMode = "dialog",
  effectiveTargetSlot,
  idPrefix,
}: AssetGovernanceFormProps) {
  const conviction = getScoreConvictionMeta(score);
  const archetypeKey = getScoreArchetypeKey(assetClass);
  const availableCriteria = CRITERIA_BY_ARCHETYPE[archetypeKey] || CRITERIA_BY_ARCHETYPE.default!;
  const metCount = availableCriteria.filter((c) => (scoreCriteria?.[c.key] ?? 0) >= 1).length;
  const hasDetailsData = metCount > 0 || thesisSummary.trim().length > 0;
  const [accordionVal, setAccordionVal] = useState<string>(() =>
    !collapsibleDetails || hasDetailsData ? "governance-details" : "",
  );
  const isWizard = interactionMode === "wizard";

  const detailsNode = (
    <AssetGovernanceDetailsSection
      assetClass={assetClass}
      scoreCriteria={scoreCriteria}
      onToggleCriterion={onToggleCriterion}
      thesisSummary={thesisSummary}
      onThesisSummaryChange={onThesisSummaryChange}
      reviewFrequencyMonths={reviewFrequencyMonths}
      onReviewFrequencyMonthsChange={onReviewFrequencyMonthsChange}
      lastReviewedAt={lastReviewedAt}
      showLastReviewed={showLastReviewed}
      isWizard={isWizard}
      idPrefix={idPrefix}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Nota de convicção"
        className="flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">Nota de Convicção (0 a 10)</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isWizard && (
              <span
                className={cn(
                  "font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg border tabular-nums whitespace-nowrap",
                  score === null
                    ? "bg-muted/50 border-border/80 text-muted-foreground"
                    : score >= 7
                      ? "bg-positive/10 border-positive/30 text-positive-strong"
                      : score >= 4
                        ? "bg-warning/15 border-warning/30 text-warning-strong"
                        : "bg-critical/10 border-critical/30 text-critical-strong",
                )}
              >
                {score !== null ? `${score} / 10` : "Sem nota"}
              </span>
            )}
            <Badge size="xs" variant={conviction.badgeVariant}>
              {isWizard && score !== null ? `Nota ${score} · ${conviction.label}` : conviction.label}
            </Badge>
            <Button
              type="button"
              variant={score === null ? "default" : "outline"}
              size="xs"
              sensoryIntent="selection"
              onClick={() => onScoreChange(null)}
            >
              {isWizard ? "Avaliar depois" : "Sem nota"}
            </Button>
          </div>
        </div>

        <div
          role={isWizard ? "radiogroup" : undefined}
          aria-label="Selecionar nota de 0 a 10"
          className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-2 pt-1 w-full"
        >
          {SCORE_SCALE.map((num) => {
            const isSelected = score === num;
            const activeTone =
              num >= 7
                ? "bg-positive/15 border-positive text-positive-strong ring-1 ring-positive/40 shadow-xs"
                : num >= 4
                  ? "bg-warning/15 border-warning text-warning-strong ring-1 ring-warning/40 shadow-xs"
                  : "bg-critical/10 border-critical text-critical-strong ring-1 ring-critical/40 shadow-xs";

            return (
              <button
                key={num}
                type="button"
                role={isWizard ? "radio" : undefined}
                aria-checked={isWizard ? isSelected : undefined}
                aria-pressed={!isWizard ? isSelected : undefined}
                aria-label={`Nota ${num}`}
                onClick={() => {
                  triggerSensory("selection");
                  onScoreChange(num);
                }}
                className={cn(
                  "flex items-center justify-center min-h-11 sm:min-h-10 rounded-lg border font-mono text-xs font-semibold tabular-nums transition-colors cursor-pointer",
                  isSelected
                    ? activeTone
                    : "bg-surface border-border/80 text-foreground hover:bg-surface-hover hover:border-border",
                )}
              >
                {num}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          {score === null
            ? "Ativos sem nota entram no motor de rebalanceamento com peso neutro (5) caso o status esteja Ativo."
            : "A nota pondera a alocação do ativo dentro da sua classe ou setor no rebalanceamento."}
        </p>
      </section>

      <section aria-label="Periodicidade de reavaliação" className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">Lembrete de Reavaliação</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Quando ser lembrado para reavaliar a tese
          </span>
        </div>

        <div
          role={isWizard ? "radiogroup" : undefined}
          aria-label="Frequência do lembrete de reavaliação"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2"
        >
          {REVIEW_FREQUENCY_OPTIONS.map((opt) => {
            const months = Number(opt.value);
            const isSelected = (reviewFrequencyMonths ?? 6) === months;
            const isRecommended = months === 6;
            return (
              <ChoiceCard
                key={opt.value}
                role={isWizard ? "radio" : "button"}
                aria-pressed={!isWizard ? isSelected : undefined}
                selected={isSelected}
                onClick={() => onReviewFrequencyMonthsChange(months)}
                className="p-3"
                title={months === 3 ? "Trimestral" : months === 6 ? "Semestral" : "Anual"}
                badge={isRecommended ? "Recomendado" : undefined}
                badgeVariant={isRecommended ? "default" : "muted"}
                description={
                  months === 3
                    ? "A cada 3 meses"
                    : months === 6
                      ? "A cada 6 meses"
                      : "A cada 12 meses"
                }
              />
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {score === null
            ? "Como a nota ainda não foi definida, o lembrete de revisão periódica só começará a contar após você realizar a primeira avaliação."
            : `Você será lembrado no carrossel de governança a cada ${reviewFrequencyMonths ?? 6} meses para reavaliar a tese e calibrar a nota deste ativo.`}
        </p>
      </section>

      <section aria-label="Status de alocação" className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground">Status de Governança na Carteira</span>
        <div
          role={isWizard ? "radiogroup" : undefined}
          aria-label="Status do ativo na carteira"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
        >
          {STATUS_ITEMS.map(({ value, icon: Icon }) => {
            const meta = ALLOCATION_STATUS_META[value];
            const isSelected = allocationStatus === value;
            return (
              <ChoiceCard
                key={value}
                role={isWizard ? "radio" : "button"}
                aria-pressed={!isWizard ? isSelected : undefined}
                selected={isSelected}
                onClick={() => onAllocationStatusChange(value)}
                icon={<Icon className="size-4" aria-hidden="true" />}
                title={meta.label}
                badge={isSelected ? meta.shortLabel : undefined}
                badgeVariant={meta.badgeVariant}
                description={meta.description}
              />
            );
          })}
        </div>
      </section>

      {effectiveTargetSlot}

      {collapsibleDetails ? (
        <Accordion type="single" collapsible value={accordionVal} onValueChange={setAccordionVal}>
          <AccordionItem value="governance-details">
            <AccordionTrigger className="px-4 py-3 text-xs font-semibold">
              <span>
                Critérios da tese e anotações{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional{metCount > 0 ? ` · ${metCount}/${availableCriteria.length}` : ""})
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-1">{detailsNode}</AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        detailsNode
      )}
    </div>
  );
}
