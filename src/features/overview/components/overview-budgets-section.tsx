import { ChevronRight, Target } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";

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
      className="flex flex-col gap-3.5 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden"
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
            onClick={onNavigateBudgets}
            className="font-medium text-primary hover:underline cursor-pointer"
          >
            Definir limites →
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
              className="flex w-full h-2.5 sm:h-3 rounded-full overflow-hidden bg-surface-hover/70 p-0.5 border border-border/40 gap-0.5"
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
                  className="h-full rounded-full transition-all duration-300 first:rounded-l-full last:rounded-r-full shrink-0 outline-none cursor-pointer hover:brightness-110 active:scale-95 focus-visible:ring-1 focus-visible:ring-ring"
                  title={`${seg.label}: ${(seg.spentCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — clique para ver detalhes`}
                  onClick={() => {
                    if (seg.id === "others") {
                      onOpenOthersBudget();
                    } else {
                      onSelectCategory(seg.id);
                    }
                  }}
                />
              ))}
            </div>

            {/* Legenda Estruturada em 2 Colunas Simétricas no Mobile e Flex no Desktop */}
            {budgetSegments.length > 0 ? (
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-3 sm:gap-x-4 gap-y-2 text-xs pt-0.5 min-w-0">
                {budgetSegments.map((seg) => (
                  <button
                    type="button"
                    key={seg.id}
                    onClick={() => {
                      if (seg.id === "others") {
                        onOpenOthersBudget();
                      } else {
                        onSelectCategory(seg.id);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 min-w-0 text-muted-foreground transition-all duration-150 rounded-lg p-1 -m-1 cursor-pointer hover:bg-surface-hover hover:text-foreground active:scale-95 text-left"
                  >
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color ?? undefined }}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-foreground truncate min-w-0">{seg.label}</span>
                    <span className="hidden sm:inline font-medium text-foreground">:</span>
                    <MoneyText
                      cents={seg.spentCents}
                      tone="default"
                      className="hidden sm:inline-block text-muted-foreground shrink-0 tabular-nums font-medium"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
