import { useMemo } from "react";
import { GitCompare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MoneyText } from "@/components/ui/money-text";
import { Progress } from "@/components/ui/progress";
import { reconcileHouseholdSpending } from "@/domain/family";
import { cn } from "@/lib/utils";
import type {
  FamilyConsolidationExpense,
  FamilyConsolidationMember,
  FamilySplitRule,
} from "@/types";

export interface HouseholdComparisonCardProps {
  members: FamilyConsolidationMember[];
  expenses: FamilyConsolidationExpense[];
  monthlyCeilingCents: number;
  splitRule: FamilySplitRule;
  month: string;
  className?: string;
}

const MEMBER_DOT_COLORS = [
  "bg-primary",
  "bg-portfolio",
  "bg-warning",
  "bg-positive-strong",
] as const;

const MEMBER_PROGRESS_TONES = [
  "positive",
  "portfolio",
  "warning",
  "positive",
] as const;

/**
 * Card de Gráfico Comparativo entre Participantes (/familia).
 * Apura o valor realizado de cada parceiro contra a cota devida calculada
 * pelo motor puro de reconciliação familiar, exibindo barras comparativas e saldos líquidos.
 */
export function HouseholdComparisonCard({
  members,
  expenses,
  monthlyCeilingCents,
  splitRule,
  month,
  className,
}: HouseholdComparisonCardProps) {
  const reconciliation = useMemo(() => {
    return reconcileHouseholdSpending({
      monthly_ceiling_cents: monthlyCeilingCents,
      members: members.map((m) => ({
        user_id: m.user_id,
        display_name: m.display_name,
        role: m.role,
        split_ratio: m.split_ratio,
        pix_key: m.pix_key,
        pix_key_type: m.pix_key_type,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        user_id: e.user_id,
        amount_cents: e.amount_cents,
        date: e.date,
        description: e.description,
        category_id: e.category_id,
        category_name: e.category_name,
        category_icon: e.category_icon,
        category_color: e.category_color,
        created_at: e.created_at,
        is_family: true,
      })),
      options: {
        month,
        splitRule,
      },
    });
  }, [members, expenses, monthlyCeilingCents, splitRule, month]);

  const totalSpentCents = reconciliation.total_spent_cents;

  return (
    <Card className={cn("border-border/80 bg-surface shadow-xs rounded-2xl", className)}>
      <CardHeader className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <GitCompare className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Gráfico Comparativo</span>
        </CardTitle>

        <div>
          <Badge variant="muted" size="sm">
            {splitRule === "proportional" ? "Meta Proporcional" : "Meta 50% / 50%"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {totalSpentCents === 0 ? (
          <EmptyState
            title="Nenhum gasto para comparar"
            description="Os comparativos de contribuição e cotas da casa aparecerão aqui conforme as despesas forem lançadas."
            tone="default"
            className="py-8"
          />
        ) : (
          <div
            className={cn(
              "grid gap-3.5",
              reconciliation.members.length >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
            )}
          >
            {reconciliation.members.map((member, index) => {
              const dotClass =
                MEMBER_DOT_COLORS[index % MEMBER_DOT_COLORS.length] ?? "bg-primary";
              const progressTone =
                MEMBER_PROGRESS_TONES[index % MEMBER_PROGRESS_TONES.length] ?? "positive";
              const clampedSpentPercent = Math.min(
                100,
                Math.max(0, member.percentage_of_spent),
              );

              return (
                <div
                  key={member.user_id}
                  className="p-3.5 rounded-xl bg-surface-raised space-y-3 min-w-0"
                >
                  {/* Cabeçalho do Participante */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn("size-2.5 rounded-full shrink-0", dotClass)}
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                        {member.display_name}
                      </span>
                      {member.is_top_spender && (
                        <Badge variant="muted" size="xs">
                          Maior gasto
                        </Badge>
                      )}
                    </div>

                    <div className="shrink-0">
                      {member.is_creditor ? (
                        <Badge variant="positive" size="xs">
                          Recebe{" "}
                          <MoneyText
                            cents={member.net_balance_cents}
                            tone="positive"
                            className="inline ml-1 text-[10px] font-semibold text-current"
                          />
                        </Badge>
                      ) : member.is_debtor ? (
                        <Badge variant="warning" size="xs">
                          Acerta{" "}
                          <MoneyText
                            cents={Math.abs(member.net_balance_cents)}
                            tone="default"
                            className="inline ml-1 text-[10px] font-semibold text-current"
                          />
                        </Badge>
                      ) : (
                        <Badge variant="muted" size="xs">
                          Equilibrado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Comparativo Realizado vs Cota Alvo */}
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-surface min-w-0">
                      <p className="text-[11px] text-muted-foreground">Pago no mês</p>
                      <MoneyText
                        cents={member.spent_cents}
                        tone="default"
                        className="font-bold mt-0.5 block"
                      />
                      <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                        {member.percentage_of_spent}% do total
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-surface min-w-0">
                      <p className="text-[11px] text-muted-foreground">Cota devida</p>
                      <MoneyText
                        cents={member.fair_share_cents}
                        tone="default"
                        className="font-semibold mt-0.5 block"
                      />
                      <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                        Meta: {member.target_percentage}%
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-surface col-span-2 xl:col-span-1 min-w-0">
                      <p className="text-[11px] text-muted-foreground">Ticket médio</p>
                      <MoneyText
                        cents={member.average_ticket_cents}
                        tone="default"
                        className="font-medium mt-0.5 block"
                      />
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {member.expenses_count}{" "}
                        {member.expenses_count === 1 ? "lançamento" : "lançamentos"}
                      </p>
                    </div>
                  </div>

                  {/* Barra Visual Comparativa */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="tabular-nums">
                        Participação efetiva: {member.percentage_of_spent}%
                      </span>
                      <span className="tabular-nums">Alvo: {member.target_percentage}%</span>
                    </div>

                    <Progress
                      value={clampedSpentPercent}
                      tone={progressTone}
                      size="md"
                      aria-label={`Participação de ${member.display_name}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
