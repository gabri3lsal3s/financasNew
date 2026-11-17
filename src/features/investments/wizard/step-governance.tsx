import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Shield, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ChoiceCard,
  Select,
  Textarea,
} from "@/components/ui";
import {
  ALLOCATION_STATUS_META,
  CRITERIA_BY_ARCHETYPE,
  calculateEffectiveAssetTargets,
  getScoreArchetypeKey,
  getScoreConvictionMeta,
  REVIEW_FREQUENCY_OPTIONS,
} from "@/domain/portfolio";
import { isCashAssetClass, normalizeClassName } from "@/domain/portfolio/valuation";
import { formatPercent } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import type { AssetAllocationStatus, GroupTarget, PortfolioAsset } from "@/types";
import { cn } from "@/lib/utils";
import type { InvestmentWizardState } from "./wizard-state";

export interface StepGovernanceProps {
  state: InvestmentWizardState;
  onChange: (patch: Partial<InvestmentWizardState>) => void;
  existingAssets: readonly PortfolioAsset[];
  classTargets: readonly GroupTarget[];
  sectorTargets: readonly GroupTarget[];
}

const SCORE_SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const STATUS_ORDER: readonly AssetAllocationStatus[] = ["active", "neutral", "quarantine", "exit"];

export function StepGovernance({
  state,
  onChange,
  existingAssets,
  classTargets,
  sectorTargets,
}: StepGovernanceProps) {
  const [showChecklist, setShowChecklist] = useState(
    () =>
      Object.keys(state.scoreCriteria ?? {}).length > 0 ||
      state.thesisSummary.trim().length > 0,
  );

  const isCash = state.isCash || isCashAssetClass(state.assetClass);
  const conviction = getScoreConvictionMeta(state.score);
  const archetypeKey = getScoreArchetypeKey(state.assetClass);
  const availableCriteria = CRITERIA_BY_ARCHETYPE[archetypeKey] || CRITERIA_BY_ARCHETYPE.default!;
  const metCount = availableCriteria.filter((c) => (state.scoreCriteria?.[c.key] ?? 0) >= 1).length;

  const classTargetInputs = useMemo(
    () =>
      classTargets.map((ct) => ({
        className: ct.name,
        targetPercentage: ct.target_percentage,
      })),
    [classTargets],
  );

  const sectorTargetInputs = useMemo(
    () =>
      sectorTargets
        .filter((st) => Boolean(st.class_name && st.class_name.trim().length > 0))
        .map((st) => ({
          className: st.class_name as string,
          sectorName: st.name,
          targetPercentage: st.target_percentage,
        })),
    [sectorTargets],
  );

  const normalizedClassKey = normalizeClassName(state.assetClass);
  const configuredClassTarget = useMemo(
    () =>
      classTargetInputs.find((ct) => normalizeClassName(ct.className) === normalizedClassKey) ?? null,
    [classTargetInputs, normalizedClassKey],
  );

  const effectiveTargetPreview = useMemo(() => {
    if (isCash) return null;
    const simulatedAsset = {
      id: "__wizard_new_asset__",
      ticker: state.ticker.trim().toUpperCase() || "NOVO",
      assetClass: state.assetClass,
      sector: state.sector.trim() || null,
      score: state.score,
      allocation_status: state.allocationStatus,
    };

    const results = calculateEffectiveAssetTargets({
      assets: [
        ...existingAssets.map((asset) => ({
          id: asset.id,
          ticker: asset.ticker,
          assetClass: asset.asset_class,
          sector: asset.sector,
          score: asset.score ?? null,
          allocation_status: asset.allocation_status ?? "active",
        })),
        simulatedAsset,
      ],
      classTargets: classTargetInputs,
      sectorTargets: sectorTargetInputs,
    });

    return results.find((item) => item.assetId === "__wizard_new_asset__") ?? null;
  }, [
    isCash,
    state.ticker,
    state.assetClass,
    state.sector,
    state.score,
    state.allocationStatus,
    existingAssets,
    classTargetInputs,
    sectorTargetInputs,
  ]);

  const handleToggleCriterion = (key: string) => {
    const next = { ...(state.scoreCriteria ?? {}) };
    if (next[key] === 1) {
      delete next[key];
    } else {
      next[key] = 1;
    }
    triggerSensory("selection");
    onChange({ scoreCriteria: next });
  };

  if (isCash) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs">
        <div className="flex items-start gap-2.5">
          <Shield className="size-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">
              Caixa / Liquidez fora das metas de alocação
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O saldo em Caixa não recebe Nota de Convicção nem Meta % na governança de 3 níveis. Ele funciona como liquidez disponível e pode ser somado ao seu dinheiro do bolso no Simulador de Aporte Composto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Nota de Convicção (0-10) ou Avaliar depois */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">
              Nota de Convicção (0 a 10)
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={conviction.badgeVariant} size="sm">
              {state.score !== null ? `Nota ${state.score} · ${conviction.label}` : conviction.label}
            </Badge>
            <Button
              type="button"
              variant={state.score === null ? "secondary" : "outline"}
              size="xs"
              onClick={() => onChange({ score: null })}
            >
              Avaliar depois
            </Button>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Selecionar nota de 0 a 10"
          className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 pt-1"
        >
          {SCORE_SCALE.map((num) => {
            const isSelected = state.score === num;
            const activeTone =
              num >= 7
                ? "border-positive bg-positive/15 text-positive-strong ring-1 ring-positive/40"
                : num >= 4
                  ? "border-primary bg-primary/10 text-primary-strong ring-1 ring-primary/40"
                  : "border-negative bg-negative/10 text-negative-strong ring-1 ring-negative/40";
            return (
              <button
                key={num}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Nota ${num}`}
                onClick={() => {
                  triggerSensory("selection");
                  onChange({ score: num });
                }}
                className={cn(
                  "h-9 rounded-lg border text-xs font-mono font-semibold transition-all cursor-pointer",
                  isSelected
                    ? activeTone
                    : "border-border/80 bg-surface-hover/40 text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {num}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          {state.score === null
            ? "Sem nota: o ativo entra no motor com peso neutro (5) caso esteja Ativo e é exibido como \"Sem nota\" até você avaliá-lo."
            : "A nota define o peso relativo deste ativo frente aos demais ativos da mesma classe ou setor."}
        </p>
      </div>

      {/* 2. Status de Governança na Carteira */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground">
          Status do Ativo na Carteira
        </span>
        <div
          role="radiogroup"
          aria-label="Status do ativo na carteira"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
        >
          {STATUS_ORDER.map((statusKey) => {
            const meta = ALLOCATION_STATUS_META[statusKey];
            const isSelected = state.allocationStatus === statusKey;
            return (
              <ChoiceCard
                key={statusKey}
                selected={isSelected}
                onClick={() => onChange({ allocationStatus: statusKey })}
                title={meta.label}
                badge={isSelected ? meta.shortLabel : undefined}
                badgeVariant={meta.badgeVariant}
                description={meta.description}
              />
            );
          })}
        </div>
      </div>

      {/* 3. Prévia ao Vivo da % Efetiva Derivada */}
      {configuredClassTarget && configuredClassTarget.targetPercentage > 0 && effectiveTargetPreview ? (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-border/80 bg-muted/35 p-3.5 text-xs">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold text-foreground">
              Meta Efetiva Derivada na Carteira
            </span>
            <span className="font-mono text-sm font-bold text-primary-strong tabular-nums whitespace-nowrap">
              {formatPercent(effectiveTargetPreview.effectiveTargetPct)}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {effectiveTargetPreview.formulaLabel}
          </p>
        </div>
      ) : (
        <Alert variant="info">
          A classe {state.assetClass} ainda não possui meta % configurada em Rebalancear &gt; Metas. Assim que você definir a meta da classe, este ativo herdará automaticamente sua participação proporcional à nota.
        </Alert>
      )}

      {/* 4. Checklist de Critérios, Periodicidade e Tese (Colapsável — opcional) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface p-3.5 shadow-xs">
        <button
          type="button"
          onClick={() => setShowChecklist((prev) => !prev)}
          className="flex items-center justify-between gap-2 w-full text-left text-xs font-semibold text-foreground cursor-pointer"
          aria-expanded={showChecklist}
        >
          <span>
            Checklist de critérios, revisão e tese{" "}
            <span className="text-muted-foreground font-normal">
              (opcional{metCount > 0 ? ` · ${metCount}/${availableCriteria.length}` : ""})
            </span>
          </span>
          {showChecklist ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </button>

        {showChecklist && (
          <div className="flex flex-col gap-4 pt-2 border-t border-border/60">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">
                Critérios para {state.assetClass}
              </span>
              <div className="grid grid-cols-1 gap-2">
                {availableCriteria.map((criterion) => {
                  const checked = (state.scoreCriteria?.[criterion.key] ?? 0) >= 1;
                  return (
                    <label
                      key={criterion.key}
                      className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface-hover/25 p-2.5 cursor-pointer hover:bg-surface-hover/50 transition-colors"
                    >
                      <Checkbox
                        id={`wizard-criterion-${criterion.key}`}
                        checked={checked}
                        onCheckedChange={() => handleToggleCriterion(criterion.key)}
                      />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-semibold text-foreground leading-tight">
                          {criterion.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-snug">
                          {criterion.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Frequência de Revisão
                </span>
                <Select
                  value={String(state.reviewFrequencyMonths ?? 6)}
                  onValueChange={(val) => onChange({ reviewFrequencyMonths: Number(val) || 6 })}
                  options={[...REVIEW_FREQUENCY_OPTIONS]}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-thesis-summary" className="text-xs font-semibold text-foreground">
                Resumo da Tese de Investimento{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <Textarea
                id="wizard-thesis-summary"
                value={state.thesisSummary}
                onChange={(e) => onChange({ thesisSummary: e.target.value })}
                placeholder="Ex: Vantagem competitiva em transmissão de energia com receita indexada ao IPCA..."
                rows={3}
                className="text-base sm:text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
