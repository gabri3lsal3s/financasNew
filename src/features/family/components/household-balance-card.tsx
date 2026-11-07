import { ArrowRightLeft, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import type {
  FamilyConsolidationMember,
  FamilyConsolidationSettlement,
  FamilySplitRule,
} from "@/types";

export interface HouseholdBalanceCardProps {
  members: FamilyConsolidationMember[];
  splitRule: FamilySplitRule;
  isSettled: boolean;
  settlement: FamilyConsolidationSettlement | null;
  hasPostSettlementExpenses: boolean;
  onOpenSettlement: () => void;
  className?: string;
}

const MEMBER_COLORS = [
  "bg-primary",
  "bg-portfolio",
  "bg-warning",
  "bg-positive-strong",
];

function getSplitRuleLabel(rule: FamilySplitRule): string {
  switch (rule) {
    case "proportional":
      return "Divisão proporcional à renda";
    case "equal":
    default:
      return "Divisão igualitária (50% / 50%)";
  }
}

/**
 * Card de Equilíbrio das Contas do Mês e Compensação Familiar.
 * Compara a participação de cada participante nos gastos da casa com barra bicolor de contribuição
 * e ação direta para acertar as contas via Pix.
 */
export function HouseholdBalanceCard({
  members,
  splitRule,
  isSettled,
  settlement,
  hasPostSettlementExpenses,
  onOpenSettlement,
  className,
}: HouseholdBalanceCardProps) {
  const totalSpentCents = members.reduce((sum, m) => sum + m.spent_cents, 0);

  return (
    <Card
      data-tour="family-balance-card"
      className={cn("border-border/80 bg-surface shadow-xs rounded-2xl", className)}
    >
      <CardHeader className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Scale className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Equilíbrio do Mês</span>
        </CardTitle>

        <div>
          {isSettled && !hasPostSettlementExpenses ? (
            <Badge variant="positive" size="sm">
              Acerto realizado
            </Badge>
          ) : isSettled && hasPostSettlementExpenses ? (
            <Badge variant="warning" size="sm">
              Despesas pós-acerto
            </Badge>
          ) : (
            <Badge variant="muted" size="sm">
              Pendente de acerto
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{getSplitRuleLabel(splitRule)}</span>
          <span className="tabular-nums">
            Total da casa: <MoneyText cents={totalSpentCents} className="font-medium text-foreground" />
          </span>
        </div>

        {/* Barra Bicolor de Contribuição */}
        {totalSpentCents > 0 ? (
          <div className="space-y-2">
            <div
              className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/60 flex"
              role="img"
              aria-label="Proporção de gastos por participante"
            >
              {members.map((member, index) => {
                const colorClass = MEMBER_COLORS[index % MEMBER_COLORS.length] ?? "bg-primary";
                const widthPercent = member.percentage_of_total;
                if (widthPercent <= 0) return null;
                return (
                  <div
                    key={member.user_id}
                    className={cn("h-full transition-all duration-300", colorClass)}
                    style={{ width: `${widthPercent}%` }}
                    title={`${member.display_name}: ${widthPercent}%`}
                  />
                );
              })}
            </div>

            {/* Lista de Participantes e Fatias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {members.map((member, index) => {
                const dotColor = MEMBER_COLORS[index % MEMBER_COLORS.length] ?? "bg-primary";
                return (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-surface-muted/40 border border-border/60 text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn("size-2 rounded-full shrink-0", dotColor)} aria-hidden="true" />
                      <span className="font-medium text-foreground truncate">{member.display_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-right">
                      <MoneyText cents={member.spent_cents} className="font-semibold text-foreground" />
                      <span className="text-[11px] text-muted-foreground">({member.percentage_of_total}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            Nenhuma despesa familiar computada neste mês até o momento.
          </p>
        )}

        {/* Resumo de Liquidação / Aviso */}
        {settlement && !hasPostSettlementExpenses && (
          <div className="p-2.5 rounded-xl border border-positive/20 bg-positive/10 text-xs text-foreground">
            <p className="font-medium text-positive-strong">
              Acerto de contas realizado para esta competência.
            </p>
            <p className="text-muted-foreground mt-0.5">
              {settlement.payer_name} compensou {settlement.receiver_name} em{" "}
              <MoneyText cents={settlement.amount_cents} tone="positive" className="font-semibold" /> via Pix.
            </p>
          </div>
        )}

        {hasPostSettlementExpenses && (
          <div className="p-2.5 rounded-xl border border-warning/20 bg-warning/15 text-xs text-warning-strong">
            Novas despesas foram lançadas após o último acerto registrado. Um novo acerto de contas é recomendado.
          </div>
        )}

        {/* Botão de Ação CTA */}
        <div className="pt-2">
          <Button
            type="button"
            variant={isSettled && !hasPostSettlementExpenses ? "outline" : "default"}
            size="sm"
            onClick={onOpenSettlement}
            className="w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <ArrowRightLeft className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {isSettled && !hasPostSettlementExpenses
                ? "Ver Detalhes do Acerto"
                : "Acertar Contas (Pix)"}
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
