import { MoneyText } from "@/components/ui/money-text";
import { EmergencyThermometer, ProjectionLine } from "@/components/modules";
import type { EmergencyFundComposition } from "@/domain/projection";
import type { ChallengeOption, DiscretionaryChallenge } from "@/domain/savings";

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
  balanceCents?: number;
  monthlyExpensesCents?: number;
  liquidReserveCents?: number;
  baselineMonthlyExpensesCents?: number;
  monthlySavingsVelocityCents?: number;
  referenceMonth?: string;
  composition?: EmergencyFundComposition;
  onOpenEmergencyConfig?: () => void;
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
  balanceCents,
  monthlyExpensesCents,
  liquidReserveCents,
  baselineMonthlyExpensesCents,
  monthlySavingsVelocityCents,
  referenceMonth,
  composition,
  onOpenEmergencyConfig,
}: ProjectionTabProps) {
  return (
    <div className="flex flex-col gap-6 min-w-0">
      {/* Bloco 1: Fechamento Projetado & Caixa */}
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

          <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-4 min-w-0 shadow-xs">
            <h3 className="text-sm font-semibold text-foreground">Pendências do período</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs min-w-0">
              <div className="flex flex-col gap-1 rounded-lg bg-surface-raised/80 p-3 min-w-0">
                <span className="text-muted-foreground">A receber</span>
                <MoneyText
                  cents={pendingSummary.receivablesCents}
                  tone="positive"
                  className="text-sm sm:text-base font-semibold"
                />
              </div>
              <div className="flex flex-col gap-1 rounded-lg bg-surface-raised/80 p-3 min-w-0">
                <span className="text-muted-foreground">A pagar</span>
                <MoneyText
                  cents={pendingSummary.payablesCents}
                  tone="negative"
                  className="text-sm sm:text-base font-semibold"
                />
              </div>
              <div className="flex flex-col gap-1 rounded-lg bg-surface-raised/80 p-3 min-w-0">
                <span className="text-muted-foreground">Saldo projetado das pendências</span>
                <MoneyText
                  cents={pendingSummary.balanceCents}
                  tone={pendingSummary.balanceCents >= 0 ? "positive" : "negative"}
                  className="text-sm sm:text-base font-semibold"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bloco 2: Reserva de Emergência & Autonomia (Centro de Segurança) */}
      <section aria-label="Reserva e autonomia" className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Segurança Financeira &amp; Reserva
        </h2>

        <EmergencyThermometer
          liquidReserveCents={liquidReserveCents ?? balanceCents ?? 0}
          monthlyExpensesCents={baselineMonthlyExpensesCents ?? monthlyExpensesCents ?? 0}
          monthlySavingsVelocityCents={monthlySavingsVelocityCents}
          referenceMonth={referenceMonth}
          composition={composition}
          onOpenConfig={onOpenEmergencyConfig}
        />
      </section>

      {/* Bloco 3: Oportunidades de Economia & Cortes */}
      <section aria-label="Desafios de economia" className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Plano de Economia &amp; Cortes Sugeridos
        </h2>

        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-4 min-w-0 shadow-xs">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Desafios de economia inteligentes
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Metas de corte nas suas maiores categorias de consumo discricionário.
            </p>
          </div>

          {challenges.length === 0 && !showDiscretionary ? (
            <p className="text-xs text-muted-foreground py-2">
              Nenhum desafio sugerido no momento para os seus gastos atuais.
            </p>
          ) : (
            <div className="flex flex-col gap-2 min-w-0">
              {challenges.map((challenge) => (
                <div
                  key={`${challenge.categoryId}-${challenge.percent}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-raised/80 p-3 text-xs min-w-0"
                >
                  <span className="font-medium text-foreground min-w-0 flex-1 break-words">
                    {challenge.name} — cortar {challenge.percent}% (meta{" "}
                    <MoneyText
                      cents={challenge.targetCents}
                      tone="default"
                      className="text-xs font-semibold"
                    />
                    )
                  </span>
                  <span className="shrink-0 font-semibold text-positive-strong tabular-nums whitespace-nowrap">
                    <MoneyText cents={-challenge.savingsCents} tone="positive" sign="explicit" />
                    /mês
                  </span>
                </div>
              ))}
              {showDiscretionary && discretionary ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-positive/30 bg-positive/10 p-3 text-xs min-w-0">
                  <span className="font-medium text-foreground min-w-0 flex-1">
                    30% em não essenciais
                  </span>
                  <span className="shrink-0 font-semibold text-positive-strong tabular-nums whitespace-nowrap">
                    <MoneyText cents={-discretionary.savingsCents} tone="positive" sign="explicit" />
                    /mês
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
