import { Calendar, Flame, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, MoneyText } from "@/components/ui";
import type { CompoundInterestResult } from "@/domain/portfolio";

export interface CompoundKpiAndMilestonesProps {
  result: CompoundInterestResult;
  periodYears: number;
  annualRatePercent: number;
  monthlyLivingCostCents: number;
  criticalCapitalCents: number;
  interestPercentage: number;
}

export function CompoundKpiAndMilestones({
  result,
  periodYears,
  annualRatePercent,
  monthlyLivingCostCents,
  criticalCapitalCents,
  interestPercentage,
}: CompoundKpiAndMilestonesProps) {
  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-primary/30 bg-primary/5 shadow-xs">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-primary-strong dark:text-primary">
              Patrimônio Final Projetado
            </span>
            <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
              <MoneyText
                cents={result.finalBalanceCents}
                tone="default"
                variant="hero"
                animated
                className="font-bold text-xl sm:text-2xl"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Em {periodYears} anos de acumulação</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Renda Passiva Mensal Estimada
            </span>
            <CardTitle className="text-xl sm:text-2xl font-bold text-positive-strong">
              <MoneyText
                cents={result.monthlyPassiveIncomeCents}
                tone="positive"
                variant="hero"
                animated
                className="font-bold text-xl sm:text-2xl"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Sem consumir o patrimônio principal</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Total em Juros Acumulados
            </span>
            <CardTitle className="text-xl sm:text-2xl font-bold text-positive-strong">
              <MoneyText
                cents={result.totalInterestCents}
                tone="positive"
                variant="hero"
                animated
                className="font-bold text-xl sm:text-2xl"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {interestPercentage}% do patrimônio gerado por juros
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Total Aportado por Você
            </span>
            <CardTitle className="text-xl sm:text-2xl font-bold">
              <MoneyText
                cents={result.totalContributedCents}
                tone="default"
                variant="hero"
                animated
                className="font-bold text-xl sm:text-2xl"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Capital saído diretamente do seu bolso</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80 bg-surface shadow-xs p-4 flex items-start gap-3">
          <Zap className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 text-xs min-w-0">
            <h4 className="font-bold text-foreground">Ponto de Inflexão</h4>
            {result.interestExceedsContributionAt ? (
              <p className="text-muted-foreground leading-relaxed">
                No{" "}
                <strong className="text-foreground">
                  Ano {result.interestExceedsContributionAt.year} (Mês{" "}
                  {result.interestExceedsContributionAt.month})
                </strong>
                , o rendimento mensal dos juros superará o seu aporte mensal.
              </p>
            ) : (
              <p className="text-muted-foreground leading-relaxed">
                Ainda não atingido no período simulado. Aumente o prazo ou a taxa.
              </p>
            )}
          </div>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs p-4 flex items-start gap-3">
          <Flame className="size-4 text-positive-strong shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 text-xs min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-foreground">Independência Financeira (FIRE)</h4>
              {criticalCapitalCents > 0 ? (
                <span className="text-[11px] font-mono font-medium text-muted-foreground">
                  Meta:{" "}
                  <MoneyText
                    cents={criticalCapitalCents}
                    tone="default"
                    className="inline text-foreground font-semibold"
                  />
                </span>
              ) : null}
            </div>
            {result.fireReachedAt ? (
              <p className="text-muted-foreground leading-relaxed">
                No{" "}
                <strong className="text-positive-strong">
                  Ano {result.fireReachedAt.year} (Mês {result.fireReachedAt.month})
                </strong>
                , sua renda passiva cobrirá seu custo de vida de{" "}
                <MoneyText
                  cents={monthlyLivingCostCents}
                  tone="default"
                  className="inline font-bold"
                />
                /mês.
              </p>
            ) : (
              <p className="text-muted-foreground leading-relaxed">
                Custo de vida não coberto no período de {periodYears} anos.
              </p>
            )}
          </div>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs p-4 flex items-start gap-3">
          <Calendar className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 text-xs min-w-0">
            <h4 className="font-bold text-foreground">Regra dos 72</h4>
            <p className="text-muted-foreground leading-relaxed">
              Com rentabilidade de {annualRatePercent}% ao ano, seu capital dobra aproximadamente a
              cada <strong className="text-foreground">{result.doublingTimeYears ?? "--"} anos</strong>{" "}
              apenas com os juros.
            </p>
          </div>
        </Card>
      </section>
    </>
  );
}
