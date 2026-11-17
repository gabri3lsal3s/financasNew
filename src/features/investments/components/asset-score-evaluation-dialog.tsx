import { useState } from "react";
import { Check, ShieldCheck, AlertTriangle, AlertCircle, Ban, ArrowRight, Loader2 } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  CRITERIA_BY_ARCHETYPE,
  getScoreArchetypeKey,
  getScoreConvictionMeta,
  REVIEW_FREQUENCY_OPTIONS,
} from "@/domain/portfolio";
import { useUpdatePortfolioAsset } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { AssetAllocationStatus, PortfolioAsset } from "@/types";

export interface AssetScoreEvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: PortfolioAsset | null;
}

export function AssetScoreEvaluationDialog({
  open,
  onOpenChange,
  asset,
}: AssetScoreEvaluationDialogProps) {
  if (!asset) return null;

  return (
    <AssetScoreEvaluationDialogContent
      key={`${asset.id}-${open ? "open" : "closed"}`}
      open={open}
      onOpenChange={onOpenChange}
      asset={asset}
    />
  );
}

function AssetScoreEvaluationDialogContent({
  open,
  onOpenChange,
  asset,
}: AssetScoreEvaluationDialogProps & { asset: PortfolioAsset }) {
  const updateMutation = useUpdatePortfolioAsset();

  const [score, setScore] = useState<number | null>(() => asset.score ?? null);
  const [allocationStatus, setAllocationStatus] = useState<AssetAllocationStatus>(
    () => asset.allocation_status ?? "active",
  );
  const [reviewFrequencyMonths, setReviewFrequencyMonths] = useState<number>(
    () => asset.review_frequency_months ?? 6,
  );
  const [thesisSummary, setThesisSummary] = useState<string>(() => asset.thesis_summary ?? "");
  const [criteria, setCriteria] = useState<Record<string, number>>(
    () => (asset.score_criteria as Record<string, number> | null) ?? {},
  );

  const archetypeKey = getScoreArchetypeKey(asset.asset_class);
  const availableCriteria = CRITERIA_BY_ARCHETYPE[archetypeKey] || CRITERIA_BY_ARCHETYPE.default!;
  const conviction = getScoreConvictionMeta(score);

  const handleToggleCriterion = (key: string) => {
    setCriteria((prev) => {
      const next = { ...prev };
      if (next[key] === 1) {
        delete next[key];
      } else {
        next[key] = 1;
      }
      return next;
    });
    triggerSensory("selection");
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: asset.id,
        patch: {
          score,
          allocation_status: allocationStatus,
          review_frequency_months: reviewFrequencyMonths,
          thesis_summary: thesisSummary.trim() || null,
          score_criteria: Object.keys(criteria).length > 0 ? criteria : null,
          last_reviewed_at: score !== null ? new Date().toISOString() : asset.last_reviewed_at ?? null,
        },
      });

      pushToast({
        title: "Governança atualizada",
        description: `Tese e nota de ${asset.ticker} salvas com sucesso.`,
        variant: "success",
      });
      onOpenChange(false);
    } catch {
      // O hook já dispara toast de erro
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Avaliação de Tese: ${asset.ticker}`}
      description="Defina a nota de convicção, o status de governança e os critérios estratégicos para o motor de rebalanceamento."
      footer={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
            className="cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="cursor-pointer font-semibold"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Salvando...
              </>
            ) : (
              "Salvar Avaliação"
            )}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 py-1">
        {/* Bloco 1: Seletor de Nota (0 a 10) com Semáforo Cognitivo */}
        <section aria-label="Nota de convicção" className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-semibold text-foreground">
              Nota de Convicção (0 a 10)
            </span>
            <div className="flex items-center gap-2 flex-wrap">
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
              <Badge size="xs" variant={conviction.badgeVariant}>
                {conviction.label}
              </Badge>
              <Button
                type="button"
                variant={score === null ? "secondary" : "outline"}
                size="xs"
                onClick={() => setScore(null)}
              >
                Sem nota
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 w-full">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => {
              const isSelected = score === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setScore(n);
                    triggerSensory("selection");
                  }}
                  className={cn(
                    "flex items-center justify-center h-9 rounded-lg font-mono text-xs font-semibold transition-all cursor-pointer border",
                    isSelected
                      ? n >= 7
                        ? "bg-positive text-primary-foreground border-positive shadow-xs scale-105"
                        : n >= 4
                          ? "bg-warning text-warning-foreground border-warning shadow-xs scale-105"
                          : "bg-critical text-critical-foreground border-critical shadow-xs scale-105"
                      : "bg-surface border-border/80 text-foreground hover:bg-surface-hover hover:border-border",
                  )}
                  aria-label={`Nota ${n}`}
                  aria-pressed={isSelected}
                >
                  {n}
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

        {/* Bloco 2: Status de Governança */}
        <section aria-label="Status de alocação" className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-foreground">
            Status de Governança na Carteira
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {
                value: "active" as const,
                label: "Aportar",
                icon: ShieldCheck,
                desc: "Recebe aportes normalmente",
                activeClass: "border-positive bg-positive/10 text-positive-strong",
              },
              {
                value: "neutral" as const,
                label: "Manter",
                icon: ArrowRight,
                desc: "Sem aportes no momento",
                activeClass: "border-border/90 bg-muted/70 text-foreground",
              },
              {
                value: "quarantine" as const,
                label: "Quarentena",
                icon: AlertTriangle,
                desc: "Congelado para análise",
                activeClass: "border-warning bg-warning/15 text-warning-strong",
              },
              {
                value: "exit" as const,
                label: "Saída",
                icon: Ban,
                desc: "Desinvestimento programado",
                activeClass: "border-critical bg-critical/10 text-critical-strong",
              },
            ].map((opt) => {
              const isSelected = allocationStatus === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setAllocationStatus(opt.value);
                    triggerSensory("selection");
                  }}
                  className={cn(
                    "flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                    isSelected
                      ? opt.activeClass
                      : "border-border/80 bg-surface hover:bg-surface-hover text-muted-foreground",
                  )}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                  </div>
                  <span className="text-[10px] leading-tight opacity-80">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Bloco 3: Checklist Polimórfico de Critérios Estratégicos */}
        <section aria-label="Critérios avaliados" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Critérios da Tese ({asset.asset_class ?? "Geral"})
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {Object.keys(criteria).length} / {availableCriteria.length} atendidos
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableCriteria.map((c) => {
              const isChecked = Boolean(criteria[c.key]);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleToggleCriterion(c.key)}
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                    isChecked
                      ? "border-positive/40 bg-positive/5 text-foreground"
                      : "border-border/70 bg-surface/80 hover:bg-surface-hover text-muted-foreground",
                  )}
                  aria-checked={isChecked}
                  role="checkbox"
                >
                  <div
                    className={cn(
                      "flex size-4.5 shrink-0 items-center justify-center rounded-md border mt-0.5 transition-colors",
                      isChecked
                        ? "bg-positive text-primary-foreground border-positive"
                        : "border-border/90 bg-muted/40",
                    )}
                  >
                    {isChecked ? <Check className="size-3" aria-hidden="true" /> : null}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground">{c.label}</span>
                    <span className="text-[10.5px] text-muted-foreground leading-tight">
                      {c.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Bloco 4: Resumo da Tese & Periodicidade de Revisão */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="thesis-summary" className="text-xs font-semibold text-foreground">
              Resumo da Tese de Investimento
            </label>
            <Textarea
              id="thesis-summary"
              rows={3}
              placeholder="Ex.: Líder de mercado em motores elétricos, forte receita dolarizada e rentabilidade histórica acima de 20%..."
              value={thesisSummary}
              onChange={(e) => setThesisSummary(e.target.value)}
              className="text-base sm:text-xs min-h-[76px] resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Periodicidade de Revisão
            </label>
            <Select
              value={String(reviewFrequencyMonths)}
              onValueChange={(val) => {
                setReviewFrequencyMonths(Number(val));
                triggerSensory("selection");
              }}
              options={[...REVIEW_FREQUENCY_OPTIONS]}
              className="text-xs h-9"
            />
            {asset.last_reviewed_at ? (
              <span className="text-[10.5px] text-muted-foreground mt-1">
                Última revisão formal:{" "}
                <strong className="text-foreground">
                  {formatDateBR(asset.last_reviewed_at)}
                </strong>
              </span>
            ) : (
              <span className="text-[10.5px] text-warning-strong mt-1 flex items-center gap-1">
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                Nunca revisado formalmente
              </span>
            )}
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
