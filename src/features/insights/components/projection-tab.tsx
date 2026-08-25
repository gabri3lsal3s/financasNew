import { ArrowRight, Sparkles } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { ProjectionLine } from "@/components/modules";
import type { ChallengeOption, DiscretionaryChallenge, LimitSuggestion } from "@/domain/savings";

export interface ProjectionTabProps {
  dailyCents: number | null;
  projectedExpensesCents: number | null;
  surplusCents: number | null;
  onTrack: boolean | null;
  spentPercent: number;
  elapsedPercent: number;
  paceActive: boolean;
  pendingSummary: {
    receivablesCents: number;
    payablesCents: number;
    balanceCents: number;
  };
  challenges: ChallengeOption[];
  showDiscretionary: boolean;
  discretionary: DiscretionaryChallenge | null;
  limitSuggestions: LimitSuggestion[];
}

export function ProjectionTab({
  dailyCents,
  projectedExpensesCents,
  surplusCents,
  onTrack,
  spentPercent,
  elapsedPercent,
  paceActive,
  pendingSummary,
  challenges,
  showDiscretionary,
  discretionary,
  limitSuggestions,
}: ProjectionTabProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Bloco 1: Fechamento Projetado */}
      <section aria-label="Fechamento do mês" className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Fechamento Projetado do Mês
        </h2>

        <div className="flex flex-col gap-3">
          <ProjectionLine
            dailyCents={dailyCents}
            projectedExpensesCents={projectedExpensesCents}
            surplusCents={surplusCents}
            onTrack={onTrack}
            spentPercent={spentPercent}
            elapsedPercent={elapsedPercent}
            paceActive={paceActive}
          />

          {/* Pendências projetadas */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden">
            <h3 className="text-sm font-semibold text-foreground">Pendências do período</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs min-w-0">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 min-w-0">
                <p className="text-muted-foreground">A receber</p>
                <MoneyText cents={pendingSummary.receivablesCents} tone="positive" className="text-sm font-semibold truncate" />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 min-w-0">
                <p className="text-muted-foreground">A pagar</p>
                <MoneyText cents={pendingSummary.payablesCents} tone="negative" className="text-sm font-semibold truncate" />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 min-w-0">
                <p className="text-muted-foreground">Saldo projetado das pendências</p>
                <MoneyText cents={pendingSummary.balanceCents} tone={pendingSummary.balanceCents >= 0 ? "positive" : "negative"} className="text-sm font-semibold truncate" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bloco 2: Oportunidades de Economia & Cortes */}
      <section aria-label="Desafios de economia" className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Plano de Economia & Cortes
        </h2>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning/10 border border-warning/20 text-warning-strong">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Desafios de economia sugeridos</h3>
              <p className="text-[11px] text-muted-foreground truncate">Metas inteligentes de corte nas suas categorias de maior volume.</p>
            </div>
          </div>

          {challenges.length === 0 && !showDiscretionary ? (
            <p className="text-xs text-muted-foreground py-2">Nenhum desafio sugerido no momento para os seus gastos atuais.</p>
          ) : (
            <div className="flex flex-col gap-2 min-w-0">
              {challenges.map((challenge) => (
                <div key={`${challenge.categoryId}-${challenge.percent}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3 text-xs min-w-0">
                  <span className="font-medium text-foreground min-w-0 flex-1">
                    {challenge.name} — cortar {challenge.percent}% (meta{" "}
                    <MoneyText cents={challenge.targetCents} tone="default" className="privacy-mask text-xs" />)
                  </span>
                  <span className="num shrink-0 font-semibold text-positive-strong">
                    <MoneyText cents={-challenge.savingsCents} tone="positive" sign="explicit" />/mês
                  </span>
                </div>
              ))}
              {showDiscretionary && discretionary ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-positive/40 bg-positive/5 p-3 text-xs min-w-0">
                  <span className="font-medium text-foreground min-w-0 flex-1">30% em não essenciais</span>
                  <span className="num shrink-0 font-semibold text-positive-strong">
                    <MoneyText cents={-discretionary.savingsCents} tone="positive" sign="explicit" />/mês
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {/* Bloco 3: Otimização de Limites */}
      <section aria-label="Sugestões de limite" className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Otimização de Limites
        </h2>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Sugestões de ajuste de limite</h3>
            <p className="text-[11px] text-muted-foreground">Ajustes recomendados para alinhar os limites de orçamento ao consumo real.</p>
          </div>

          {limitSuggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhuma sugestão de ajuste de limite no momento.</p>
          ) : (
            <div className="flex flex-col gap-2 min-w-0">
              {limitSuggestions.map((s) => (
                <div key={`${s.categoryId}-${s.kind}`} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/60 p-3 text-xs min-w-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-medium text-foreground truncate">{s.name}</span>
                    <span className="text-muted-foreground text-[11px]">{s.reason}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-semibold text-foreground">
                    <MoneyText cents={s.currentLimitCents} tone="default" />
                    <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
                    <MoneyText cents={s.suggestedLimitCents} tone="default" />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground mt-1">
                Para aplicar uma sugestão, acesse a tela de Orçamentos e atualize o limite da categoria.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
