import { Flame, Info, Snowflake } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, MoneyText } from "@/components/ui";
import type { DebtComparisonResult, DebtPayoffStrategy } from "@/domain/debts";

export interface DebtStrategyComparisonCardProps {
  activeTab: DebtPayoffStrategy;
  onTabChange: (strategy: DebtPayoffStrategy) => void;
  comparison: DebtComparisonResult;
}

export function DebtStrategyComparisonCard({
  activeTab,
  onTabChange,
  comparison,
}: DebtStrategyComparisonCardProps) {
  const activeResult = activeTab === "avalanche" ? comparison.avalanche : comparison.snowball;

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="pb-3 border-b border-border/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <CardTitle className="text-base font-bold">Estratégia Selecionada</CardTitle>
          <div className="inline-flex rounded-lg border border-border/80 bg-surface-raised/60 p-0.5 self-start sm:self-auto">
            <Button
              type="button"
              variant={activeTab === "avalanche" ? "default" : "ghost"}
              size="xs"
              onClick={() => onTabChange("avalanche")}
              className="gap-1.5 font-semibold text-xs px-3"
            >
              <Flame className="size-3" aria-hidden="true" />
              <span>Avalanche</span>
            </Button>
            <Button
              type="button"
              variant={activeTab === "snowball" ? "default" : "ghost"}
              size="xs"
              onClick={() => onTabChange("snowball")}
              className="gap-1.5 font-semibold text-xs px-3"
            >
              <Snowflake className="size-3" aria-hidden="true" />
              <span>Bola de Neve</span>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          {activeTab === "avalanche"
            ? "Elimina primeiro as dívidas com maiores juros para minimizar o custo financeiro."
            : "Elimina primeiro as menores dívidas para obter vitórias psicológicas consecutivas."}
        </p>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        <div className="p-3 rounded-lg border border-border/80 bg-surface-raised/50 flex items-start gap-2.5">
          <Info className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-foreground">
              {comparison.recommendedStrategy === "avalanche"
                ? "Recomendação Técnica: Método Avalanche"
                : "Recomendação Prática: Método Bola de Neve"}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {comparison.interestSavedWithAvalancheCents > 0
                ? "Adotar o método Avalanche economizará "
                : "Ambos os métodos apresentam custos similares."}
              {comparison.interestSavedWithAvalancheCents > 0 ? (
                <strong className="text-positive-strong">
                  <MoneyText
                    cents={comparison.interestSavedWithAvalancheCents}
                    tone="positive"
                    className="inline font-bold"
                  />
                </strong>
              ) : null}
              {comparison.interestSavedWithAvalancheCents > 0
                ? " em juros ao longo de todo o plano."
                : null}
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Cronograma de Eliminação de Dívidas
          </h4>
          {activeResult.milestones.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Ajuste o orçamento mensal para viabilizar a quitação.
            </p>
          ) : (
            <div className="space-y-2">
              {activeResult.milestones.map((m, idx) => (
                <div
                  key={m.debtId}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/80 bg-surface-raised/50 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-strong dark:text-primary font-bold text-[11px]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{m.debtName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Total pago:{" "}
                        <MoneyText
                          cents={m.totalPaidCents}
                          tone="default"
                          className="inline font-medium"
                        />
                      </p>
                    </div>
                  </div>
                  <Badge variant="muted" size="xs" className="shrink-0">
                    Quitada no Mês {m.paidOffMonth}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-border/70 space-y-1.5 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Prazo total de quitação:</span>
            <strong className="text-foreground font-mono tabular-nums">
              {activeResult.totalMonths} meses
            </strong>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Total de juros desembolsados:</span>
            <MoneyText
              cents={activeResult.totalInterestCents}
              tone="negative"
              className="font-semibold"
            />
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Custo total desembolsado:</span>
            <MoneyText
              cents={activeResult.totalPaidCents}
              tone="default"
              className="font-bold text-foreground"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
