import { ArrowRight, Edit3, HelpCircle, Info, PiggyBank, Plus, SlidersHorizontal, Sparkles, Target, User, Users } from "lucide-react";
import { Badge, Button, EmptyState, Popover, PopoverContent, PopoverTrigger, Skeleton } from "@/components/ui";
import { CategoryIcon, MonthPicker } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { BudgetProgressBar } from "@/components/modules/budget-progress-bar";
import { HighlightRow } from "@/components/modules/highlight-row";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

export interface BudgetsLimitsRow {
  category: Category;
  spentCents: number;
  spentGrossCents: number;
  spentWeightedCents: number;
  limitCents: number;
  inherited: boolean;
  hasSplitDifference: boolean;
}

export interface BudgetsLimitsTabProps {
  month: string;
  onMonthChange: (month: string) => void;
  spendMetric: "personal" | "household";
  onSpendMetricChange: (metric: "personal" | "household") => void;
  totalExpensesGrossCents: number;
  totalExpensesWeightedCents: number;
  hasBudgetLimits: boolean;
  totalBudgetedExpensesCents: number;
  totalExpensesCents: number;
  hasPartialBudgets: boolean;
  totalLimitsCents: number;
  totalUnbudgetedExpensesCents: number;
  budgetedRowsCount: number;
  categoriesCount: number;
  onOpenAdjustBudget: () => void;
  suggestion: { amountCents: number; fromCategoryId: string; toCategoryId: string } | null;
  fromCategory: Category | undefined;
  toCategory: Category | undefined;
  onOpenReallocate: () => void;
  isLoading: boolean;
  rows: BudgetsLimitsRow[];
  unbudgetedRows: BudgetsLimitsRow[];
  effectiveHighlightId: string | null;
  onOpenLimit: (category: Category) => void;
  onEditCategory: (category: Category) => void;
  onOpenCreateCategory: () => void;
  showAllCategories: boolean;
  onToggleShowAllCategories: () => void;
}

export function BudgetsLimitsTab({
  month,
  onMonthChange,
  spendMetric,
  onSpendMetricChange,
  totalExpensesGrossCents,
  totalExpensesWeightedCents,
  hasBudgetLimits,
  totalBudgetedExpensesCents,
  totalExpensesCents,
  hasPartialBudgets,
  totalLimitsCents,
  totalUnbudgetedExpensesCents,
  budgetedRowsCount,
  categoriesCount,
  onOpenAdjustBudget,
  suggestion,
  fromCategory,
  toCategory,
  onOpenReallocate,
  isLoading,
  rows,
  unbudgetedRows,
  effectiveHighlightId,
  onOpenLimit,
  onEditCategory,
  onOpenCreateCategory,
  showAllCategories,
  onToggleShowAllCategories,
}: BudgetsLimitsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Linha do seletor de mês — full-width, padrão das outras páginas */}
      <MonthPicker value={month} onValueChange={onMonthChange} />

      {/* Linha de controles: descrição + alternador de métrica */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
          Acompanhe os gastos por categoria e defina o teto mensal.
        </p>

        {/* Alternância de Métrica estilo pills (padrão Insights) */}
        <div role="group" aria-label="Modo de cálculo dos gastos" className="flex items-center gap-1.5 self-start sm:self-auto">
          <Button
            type="button"
            size="sm"
            variant={spendMetric === "personal" ? "default" : "outline"}
            onClick={() => onSpendMetricChange("personal")}
            className={cn(
              "shrink-0 gap-1.5 text-xs h-8 px-3 rounded-xl transition-all",
              spendMetric === "personal" ? "shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={spendMetric === "personal"}
            title="Considera apenas a sua participação pessoal efetiva nas compras (com rateios e reembolsos)"
            sensoryIntent="selection"
          >
            <User className="size-3.5" aria-hidden="true" />
            <span>Minha Parte</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant={spendMetric === "household" ? "default" : "outline"}
            onClick={() => onSpendMetricChange("household")}
            className={cn(
              "shrink-0 gap-1.5 text-xs h-8 px-3 rounded-xl transition-all",
              spendMetric === "household" ? "shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={spendMetric === "household"}
            title="Considera o valor bruto total nominal das compras (100% de cada despesa, sem rateios)"
            sensoryIntent="selection"
          >
            <Users className="size-3.5" aria-hidden="true" />
            <span>Total Bruto</span>
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                aria-label="Informações sobre os modos de visualização"
                title="Informações sobre os modos de visualização"
              >
                <HelpCircle className="size-3.5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 text-xs">
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-foreground">Modos de Visualização do Orçamento</p>
                <div className="flex flex-col gap-1.5 text-muted-foreground text-[11px] leading-relaxed">
                  <p>
                    <strong className="text-foreground font-medium">Minha Parte (Ponderado):</strong> Considera exclusivamente a sua cota ou responsabilidade pessoal nos gastos compartilhados (despesas com taxa de rateio menor que 100% ou reembolsos). Ideal para o controle do seu consumo individual.
                  </p>
                  <p>
                    <strong className="text-foreground font-medium">Total Bruto (Nominal):</strong> Considera 100% do valor nominal de cada compra, mesmo quando rateada com terceiros. Ideal para o controle do orçamento global de todas as despesas.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Resumo do Orçamento Geral (§3.5.2) — Régua de 3 Métricas */}
      <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border" data-tour="budgets-content">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">Total Gasto</p>
              <Badge variant="muted" size="xs">
                {spendMetric === "personal" ? "Minha Parte" : "Total Bruto"}
              </Badge>
              {totalExpensesGrossCents !== totalExpensesWeightedCents && (
                <span
                  className="text-muted-foreground/80 hover:text-foreground cursor-help"
                  title={
                    spendMetric === "personal"
                      ? `Total nominal bruto das despesas: ${formatCentsAsBRL(totalExpensesGrossCents)}`
                      : `Sua parte proporcional líquida: ${formatCentsAsBRL(totalExpensesWeightedCents)}`
                  }
                >
                  <Info className="size-3 inline" aria-hidden="true" />
                </span>
              )}
            </div>
            <MoneyText
              cents={hasBudgetLimits ? totalBudgetedExpensesCents : totalExpensesCents}
              tone="default"
              animated
              className="text-base sm:text-lg font-bold text-foreground whitespace-nowrap tabular-nums block mt-0.5"
            />
            {hasPartialBudgets && (
              <span className="text-[10px] text-muted-foreground truncate block">
                de {formatCentsAsBRL(totalExpensesCents)} gastos no total do mês
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">Teto Planejado</p>
              {!hasBudgetLimits && (
                <Badge variant="muted" size="xs">
                  Sem limites
                </Badge>
              )}
            </div>
            {hasBudgetLimits ? (
              <MoneyText
                cents={totalLimitsCents}
                tone="default"
                animated
                className="text-base sm:text-lg font-semibold text-muted-foreground whitespace-nowrap tabular-nums block mt-0.5"
              />
            ) : (
              <span className="text-base sm:text-lg font-semibold text-muted-foreground tabular-nums block mt-0.5">
                —
              </span>
            )}
            {!hasBudgetLimits && (
              <span className="text-[10px] text-muted-foreground truncate block">
                Nenhum limite ativo no mês
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
              {hasBudgetLimits
                ? totalLimitsCents >= totalBudgetedExpensesCents
                  ? "Disponível no Teto"
                  : "Excedido no Teto"
                : "Status do Mês"}
            </p>
            {hasBudgetLimits ? (
              <MoneyText
                cents={Math.abs(totalLimitsCents - totalBudgetedExpensesCents)}
                tone={totalLimitsCents >= totalBudgetedExpensesCents ? "positive" : "negative"}
                animated
                className="text-base sm:text-lg font-bold whitespace-nowrap tabular-nums block mt-0.5"
              />
            ) : (
              <span className="text-base sm:text-lg font-semibold text-muted-foreground whitespace-nowrap block mt-0.5">
                Livre de teto
              </span>
            )}
            {hasBudgetLimits && hasPartialBudgets && (
              <span className="text-[10px] text-muted-foreground truncate block">
                {budgetedRowsCount} de {categoriesCount} categorias orçadas
              </span>
            )}
          </div>
        </div>

        {hasBudgetLimits ? (
          <div className="mt-3.5 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Consumo do Teto ({spendMetric === "personal" ? "Minha Parte" : "Total Bruto"})</span>
              <span className="font-semibold text-foreground tabular-nums">
                {Math.round((totalBudgetedExpensesCents / totalLimitsCents) * 100)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
              <div
                className={
                  totalBudgetedExpensesCents > totalLimitsCents
                    ? "h-full rounded-full transition-all duration-300 bg-critical"
                    : totalBudgetedExpensesCents / totalLimitsCents >= 0.85
                      ? "h-full rounded-full transition-all duration-300 bg-warning"
                      : "h-full rounded-full transition-all duration-300 bg-primary"
                }
                style={{ width: `${Math.min(100, (totalBudgetedExpensesCents / totalLimitsCents) * 100)}%` }}
              />
            </div>
            {hasPartialBudgets && (
              <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                Despesas em categorias livres (sem teto): <MoneyText cents={totalUnbudgetedExpensesCents} tone="default" className="font-medium text-foreground" />
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3.5 pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-muted-foreground">
            <span>Você não possui tetos de gastos configurados para este mês. Todas as suas categorias estão livres de limites.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenAdjustBudget}
              className="text-xs shrink-0 self-start sm:self-auto h-8 gap-1.5"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              <span>Definir limites</span>
            </Button>
          </div>
        )}
      </div>

      {/* Recomendação de realocação inteligente (§3.5.2) */}
      {suggestion && fromCategory && toCategory ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-xs">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong">
              <Sparkles className="size-4.5" aria-hidden="true" />
            </span>
            <div className="text-sm min-w-0">
              <p className="font-semibold text-foreground">Sugestão de Realocação de Limite</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                <span className="font-medium text-positive-strong">{fromCategory.name}</span> possui folga.
                Transfira <MoneyText cents={suggestion.amountCents} tone="default" className="font-semibold text-foreground" /> de
                limite para cobrir os gastos de <span className="font-medium text-critical">{toCategory.name}</span>.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenReallocate}
            className="shrink-0 self-start sm:self-auto gap-1.5 border-primary/30 hover:bg-primary/10"
          >
            <span>Aplicar realocação</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="size-6" aria-hidden="true" />}
          title="Nenhum orçamento configurado"
          description={
            categoriesCount > 0
              ? "Você já possui categorias criadas. Ative a visualização de categorias para definir o teto mensal de cada uma."
              : "Defina um limite mensal por categoria de despesa para acompanhar os gastos ou crie uma nova categoria."
          }
          action={
            categoriesCount > 0 ? (
              <Button
                size="sm"
                onClick={onToggleShowAllCategories}
                className="gap-1.5 cursor-pointer"
              >
                <Target className="size-4" aria-hidden="true" />
                Definir limites por categoria
              </Button>
            ) : (
              <Button size="sm" onClick={onOpenCreateCategory} className="gap-1.5 cursor-pointer">
                <Plus className="size-4" aria-hidden="true" />
                Nova categoria
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            return (
              <HighlightRow
                key={row.category.id}
                highlightId={effectiveHighlightId}
                id={row.category.id}
                className="rounded-xl"
              >
                <div
                  className="group flex flex-col gap-2.5 rounded-xl border border-border/70 bg-surface/70 p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border hover:bg-surface min-w-0"
                >
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Editar limite de ${row.category.name}`}
                      onClick={() => {
                        triggerSensory("action");
                        onOpenLimit(row.category);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          triggerSensory("action");
                          onOpenLimit(row.category);
                        }
                      }}
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-0.5"
                    >
                      <CategoryIcon icon={row.category.icon} color={row.category.color} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {row.category.name}
                          </p>
                          {row.inherited ? (
                            <Badge variant="muted" size="xs">
                              herdado
                            </Badge>
                          ) : null}
                          {row.hasSplitDifference ? (
                            <Badge
                              variant="muted"
                              size="xs"
                              className="text-muted-foreground font-normal"
                              title={
                                spendMetric === "personal"
                                  ? `Total bruto das despesas: ${formatCentsAsBRL(row.spentGrossCents)}`
                                  : `Sua parte proporcional: ${formatCentsAsBRL(row.spentWeightedCents)}`
                              }
                            >
                              {spendMetric === "personal" ? (
                                <span>Total bruto: <MoneyText cents={row.spentGrossCents} tone="default" /></span>
                              ) : (
                                <span>Sua parte: <MoneyText cents={row.spentWeightedCents} tone="default" /></span>
                              )}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        aria-label={`Editar cadastro de ${row.category.name}`}
                        title={`Editar cadastro de ${row.category.name}`}
                        onClick={() => onEditCategory(row.category)}
                      >
                        <Edit3 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Editar limite de ${row.category.name}`}
                    onClick={() => {
                      triggerSensory("action");
                      onOpenLimit(row.category);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        triggerSensory("action");
                        onOpenLimit(row.category);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <BudgetProgressBar spentCents={row.spentCents} limitCents={row.limitCents} />
                  </div>
                </div>
              </HighlightRow>
            );
          })}

          {unbudgetedRows.length > 0 && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onToggleShowAllCategories}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showAllCategories
                  ? "Ocultar categorias sem limite ou gasto no mês"
                  : `Ver outras ${unbudgetedRows.length} categorias cadastradas`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
