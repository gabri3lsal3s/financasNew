import { ArrowRight, ChevronRight, Target } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface BudgetSegment {
  id: string;
  label: string;
  spentCents: number;
  percent: number;
  color?: string | null;
}

export interface OverviewBudgetsSectionProps {
  hasBudgets: boolean;
  totalRemainingCents: number;
  totalLimitsCents: number;
  globalPercent: number;
  budgetSegments: BudgetSegment[];
  onNavigateBudgets: () => void;
  onSelectCategory: (categoryId: string) => void;
  onOpenOthersBudget: () => void;
}

export function OverviewBudgetsSection({
  hasBudgets,
  totalRemainingCents,
  totalLimitsCents,
  globalPercent,
  budgetSegments,
  onNavigateBudgets,
  onSelectCategory,
  onOpenOthersBudget,
}: OverviewBudgetsSectionProps) {
  return (
    <section
      aria-label="Orçamentos"
      className="flex flex-col gap-3.5 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all min-w-0 overflow-hidden"
    >
      {/* Header do Card: Título + Botão de Ação */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground truncate min-w-0">
            Orçamentos do mês
          </h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNavigateBudgets}
          aria-label="Ver todos os orçamentos"
          className="h-7 gap-1 px-2 sm:px-2.5 text-xs font-medium text-foreground hover:bg-surface-hover cursor-pointer border-border/80 shrink-0"
        >
          <span className="hidden sm:inline">Ver todos</span>
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </div>

      {!hasBudgets ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-surface-hover/20 p-3.5 text-xs text-muted-foreground">
          <span>Nenhum orçamento configurado para este mês.</span>
          <button
            type="button"
            onClick={() => {
              triggerSensory("action");
              onNavigateBudgets();
            }}
            className="inline-flex items-center gap-1 font-medium text-primary-strong hover:underline min-h-11 sm:min-h-0 px-2 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <span>Definir limites</span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:gap-3.5">
          {/* Bloco de Métricas: Saldo à esquerda e Badge de Consumo à direita */}
          <div className="flex items-end justify-between gap-2 pt-0.5">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[11px] font-medium text-muted-foreground">
                {totalRemainingCents >= 0 ? "Saldo disponível no teto" : "Orçamento ultrapassado em"}
              </span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <MoneyText
                  cents={Math.abs(totalRemainingCents)}
                  tone="default"
                  className={cn(
                    "font-bold tracking-tight whitespace-nowrap tabular-nums",
                    totalRemainingCents >= 0 ? "text-positive-strong" : "text-critical-strong",
                    Math.abs(totalRemainingCents) >= 100_000_000
                      ? "text-xl sm:text-2xl"
                      : "text-2xl sm:text-3xl",
                  )}
                />
                <span className="text-xs text-muted-foreground font-normal">
                  de{" "}
                  <MoneyText
                    cents={totalLimitsCents}
                    tone="default"
                    className="text-muted-foreground font-medium"
                  />{" "}
                  planejado
                </span>
              </div>
            </div>

            <Badge
              variant={globalPercent > 100 ? "critical" : globalPercent >= 85 ? "warning" : "positive"}
              size="xs"
              className="shrink-0 mb-1"
            >
              {Math.round(globalPercent)}% utilizado
            </Badge>
          </div>

          {/* Barra Segmentada Única (Estilo Apple / Linear) com clique para Raio-X */}
          <div className="w-full flex flex-col gap-2.5">
            <div
              className="flex w-full h-3 sm:h-3.5 rounded-full overflow-hidden bg-surface-hover/80 p-0.5 border border-border/80 gap-0.5"
              role="group"
              aria-label={`Uso do orçamento: ${Math.round(globalPercent)}%`}
            >
              {budgetSegments.map((seg) => (
                <button
                  type="button"
                  key={seg.id}
                  style={{
                    width: `${Math.max(1.5, seg.percent)}%`,
                    backgroundColor: seg.color ?? undefined,
                  }}
                  className="relative h-full rounded-full transition-all duration-300 first:rounded-l-full last:rounded-r-full shrink-0 outline-none cursor-pointer hover:brightness-110 active:scale-95 focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-y-4 max-sm:after:inset-x-0"
                  title={`${seg.label} - ver detalhes`}
                  aria-label={`${seg.label} - ver detalhes`}
                  onClick={() => {
                    triggerSensory("selection");
                    if (seg.id === "others") {
                      onOpenOthersBudget();
                    } else {
                      onSelectCategory(seg.id);
                    }
                  }}
                />
              ))}
            </div>

            {/* Legenda Estruturada: Micro-cards em 2 colunas no Mobile e Chips fluidos no Desktop */}
            {budgetSegments.length > 0 ? (
              <>
                {/* Mobile: Grid de 2 colunas com indicador de cor, valor e porcentagem */}
                <div className="grid grid-cols-2 gap-2 sm:hidden pt-0.5 min-w-0">
                  {budgetSegments.map((seg) => (
                    <button
                      type="button"
                      key={seg.id}
                      onClick={() => {
                        triggerSensory("selection");
                        if (seg.id === "others") {
                          onOpenOthersBudget();
                        } else {
                          onSelectCategory(seg.id);
                        }
                      }}
                      className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface-hover/30 hover:bg-surface-hover/70 p-2 transition-all cursor-pointer active:scale-[0.98] text-left min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      title={`${seg.label} - ver detalhes`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 w-full">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: seg.color ?? undefined }}
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-xs text-foreground truncate min-w-0 flex-1">
                          {seg.label}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground tabular-nums shrink-0">
                          ({Math.round(seg.percent)}%)
                        </span>
                      </div>
                      <div className="pl-3.5 min-w-0">
                        <MoneyText
                          cents={seg.spentCents}
                          tone="default"
                          className="privacy-mask text-xs font-semibold text-foreground/90 tabular-nums whitespace-nowrap"
                        />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Tablet / Desktop: Chips horizontais fluidos com dados completos */}
                <div className="hidden sm:flex sm:flex-wrap gap-2 pt-0.5 min-w-0">
                  {budgetSegments.map((seg) => (
                    <button
                      type="button"
                      key={seg.id}
                      onClick={() => {
                        triggerSensory("selection");
                        if (seg.id === "others") {
                          onOpenOthersBudget();
                        } else {
                          onSelectCategory(seg.id);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-hover/30 hover:bg-surface-hover hover:border-border/90 px-2.5 py-1 text-xs text-muted-foreground transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left"
                      title={`${seg.label} - ver detalhes`}
                    >
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color ?? undefined }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-foreground truncate max-w-[130px]">
                        {seg.label}
                      </span>
                      <span className="text-muted-foreground/50">•</span>
                      <MoneyText
                        cents={seg.spentCents}
                        tone="default"
                        className="privacy-mask text-foreground/90 font-medium tabular-nums"
                      />
                      <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                        ({Math.round(seg.percent)}%)
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
