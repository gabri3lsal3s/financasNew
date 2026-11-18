import { Calendar, CheckCircle2, Clock, Target, TrendingUp, Wallet } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  MoneyText,
  Progress,
} from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { SharedGoalTrackerResult } from "@/types";

export interface GoalThermometerHeroCardProps {
  goalData: SharedGoalTrackerResult;
}

/**
 * Hero do termômetro, grade de KPIs, contagem regressiva de prazo e histórico
 * transparente de depósitos da meta coletiva pública.
 */
export function GoalThermometerHeroCard({ goalData }: GoalThermometerHeroCardProps) {
  const isArchived = goalData.status === "archived";
  const isCompleted =
    goalData.target_cents > 0
      ? goalData.current_cents >= goalData.target_cents
      : goalData.status === "completed";
  const progressTone = isCompleted ? "positive" : "portfolio";
  const hasDeadline = Boolean(goalData.deadline);

  const statusBadge = isArchived ? (
    <Badge variant="muted" size="xs" className="gap-1">
      <CheckCircle2 className="size-3 text-muted-foreground" aria-hidden="true" />
      <span>Arrecadação Concluída</span>
    </Badge>
  ) : isCompleted ? (
    <Badge variant="positive" size="xs" className="gap-1">
      <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
      <span>Meta Atingida ({goalData.percentage}%)</span>
    </Badge>
  ) : (
    <Badge variant="portfolio" size="xs" className="gap-1">
      <Target className="size-3 text-portfolio" aria-hidden="true" />
      <span>Em Arrecadação ({goalData.percentage}%)</span>
    </Badge>
  );

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {goalData.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Organizado por {goalData.organizer_name} · {goalData.organizer_city}
              </p>
            </div>
            <div className="shrink-0">{statusBadge}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Progresso da Arrecadação</span>
              <span className="font-semibold tabular-nums text-foreground">
                {goalData.percentage}% concluído
              </span>
            </div>
            <Progress
              value={goalData.percentage}
              tone={progressTone}
              size="lg"
              aria-label={`Progresso da meta: ${goalData.percentage}%`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1">
                <span>Arrecadado:</span>
                <MoneyText cents={goalData.current_cents} variant="caption" tone="positive" />
              </span>
              <span className="flex items-center gap-1 font-medium">
                <span>Alvo:</span>
                <MoneyText cents={goalData.target_cents} variant="caption" tone="default" />
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <section aria-label="Indicadores da Meta Coletiva">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Meta Total</span>
                <Target className="size-4 text-muted-foreground" aria-hidden="true" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
                <MoneyText cents={goalData.target_cents} variant="hero" tone="default" />
              </div>
              <p className="text-[11px] text-muted-foreground">Objetivo financeiro total</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Total Arrecadado</span>
                <TrendingUp className="size-4 text-positive-strong" aria-hidden="true" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
                <MoneyText cents={goalData.current_cents} variant="hero" tone="positive" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {goalData.percentage}% do valor acumulado
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>{isCompleted ? "Saldo Restante" : "Falta Arrecadar"}</span>
                {isCompleted ? (
                  <CheckCircle2 className="size-4 text-positive-strong" aria-hidden="true" />
                ) : (
                  <Wallet className="size-4 text-portfolio" aria-hidden="true" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
                <MoneyText
                  cents={goalData.remaining_cents}
                  variant="hero"
                  tone={isCompleted ? "positive" : "portfolio"}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isCompleted ? "Meta 100% financiada" : "Restante para completar o alvo"}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {hasDeadline && goalData.deadline && (
        <section aria-label="Prazo e contagem regressiva">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <Calendar className="size-4.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-foreground block">
                    Data Alvo: {formatDateBR(goalData.deadline)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Prazo limite estipulado pelo organizador para o encerramento da arrecadação
                  </p>
                </div>
              </div>
              {goalData.days_remaining !== null && (
                <div className="shrink-0">
                  {goalData.days_remaining > 1 && (
                    <Badge variant="muted" size="sm" className="font-semibold text-xs gap-1.5">
                      <Clock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>{goalData.days_remaining} dias restantes</span>
                    </Badge>
                  )}
                  {goalData.days_remaining === 1 && (
                    <Badge variant="warning" size="sm" className="font-semibold text-xs gap-1.5">
                      <Clock className="size-3.5 text-warning-strong" aria-hidden="true" />
                      <span>1 dia restante (último dia)</span>
                    </Badge>
                  )}
                  {goalData.days_remaining === 0 && (
                    <Badge variant="warning" size="sm" className="font-semibold text-xs gap-1.5">
                      <Clock className="size-3.5 text-warning-strong" aria-hidden="true" />
                      <span>Hoje é o dia alvo da meta</span>
                    </Badge>
                  )}
                  {goalData.days_remaining < 0 && (
                    <Badge variant="critical" size="sm" className="font-semibold text-xs gap-1.5">
                      <Clock className="size-3.5 text-critical-strong" aria-hidden="true" />
                      <span>Prazo encerrado</span>
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {goalData.show_contributions_publicly !== false &&
        goalData.contributions &&
        goalData.contributions.length > 0 && (
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-3 border-b border-border/80">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between gap-2">
                <span>Depósitos Registrados na Vaquinha</span>
                <Badge variant="muted" size="xs">
                  {goalData.contributions.length} recebimento
                  {goalData.contributions.length > 1 ? "s" : ""}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 divide-y divide-border/80 text-xs">
              {goalData.contributions.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {c.contributor_name || "Participante Anônimo"}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDateBR(c.date)}
                    </span>
                  </div>
                  <MoneyText
                    cents={c.amount_cents}
                    tone="positive"
                    className="font-semibold shrink-0"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
