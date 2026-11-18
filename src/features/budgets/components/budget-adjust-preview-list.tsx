import { ArrowRight } from "lucide-react";
import { CategoryIcon } from "@/components/modules";
import { MoneyText } from "@/components/ui";
import type { ProportionalCategoryOutput } from "@/domain/budgets";
import type { Category } from "@/types";

export interface BudgetAdjustPreviewListProps {
  items: ProportionalCategoryOutput[];
  categoryMap: Map<string, Category>;
}

export function BudgetAdjustPreviewList({ items, categoryMap }: BudgetAdjustPreviewListProps) {
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
        <span>Pré-visualização por Categoria ({items.length})</span>
        <span className="text-[11px] font-normal text-muted-foreground">
          Atual e Novo (Variação)
        </span>
      </div>

      {items.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground rounded-xl border border-border/80 bg-surface">
          Nenhuma categoria de despesa disponível para ajuste.
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface divide-y divide-border/60">
          {items.map((item) => {
            const cat = categoryMap.get(item.categoryId);
            return (
              <div
                key={item.categoryId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <CategoryIcon icon={cat?.icon} color={cat?.color} />
                    <span className="font-medium text-foreground truncate">
                      {item.name || cat?.name || "Categoria"}
                    </span>
                  </div>
                  {item.diffCents !== 0 ? (
                    <span
                      className={`sm:hidden text-[11px] font-medium shrink-0 inline-flex items-center ${
                        item.diffCents > 0 ? "text-positive-strong" : "text-negative-strong"
                      }`}
                    >
                      {item.diffCents > 0 ? "+" : "−"}
                      <MoneyText
                        cents={Math.abs(item.diffCents)}
                        tone="default"
                        className="text-[11px] font-medium"
                      />
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5 tabular-nums shrink-0 self-end sm:self-auto text-[11px] sm:text-xs">
                  {item.currentLimitCents === 0 && item.newLimitCents === 0 ? (
                    <span className="text-[11px] text-muted-foreground italic">
                      Livre (sem limite)
                    </span>
                  ) : (
                    <>
                      <MoneyText
                        cents={item.currentLimitCents}
                        tone="default"
                        className="text-[11px] sm:text-xs text-muted-foreground font-normal"
                      />
                      <ArrowRight
                        className="size-3 text-muted-foreground/70 shrink-0"
                        aria-hidden="true"
                      />
                      <MoneyText
                        cents={item.newLimitCents}
                        tone="default"
                        className="text-[11px] sm:text-xs font-semibold"
                      />
                      <span
                        className={`hidden sm:inline-flex items-center text-[11px] font-medium ${
                          item.diffCents > 0
                            ? "text-positive-strong"
                            : item.diffCents < 0
                              ? "text-negative-strong"
                              : "text-muted-foreground"
                        }`}
                      >
                        ({item.diffCents > 0 ? "+" : item.diffCents < 0 ? "−" : ""}
                        <MoneyText
                          cents={Math.abs(item.diffCents)}
                          tone="default"
                          className="text-[11px] font-medium"
                        />
                        )
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
