import { useState } from "react";
import { Receipt, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMerchantCategoryMapping, usePendingSuggestions } from "@/services/native";
import { useCategories } from "@/state";
import { PendingSuggestionRow } from "./pending-suggestion-row";
import { resolveCategoryForSuggestion } from "./resolve-suggestion-category";
import { usePendingSuggestionsActions } from "./use-pending-suggestions-actions";

export interface PendingSuggestionsCardProps {
  className?: string;
  onSuggestionHandled?: (id: string) => void;
}

/**
 * Painel de transações detectadas em notificações/comprovantes aguardando confirmação em 1 toque.
 */
export function PendingSuggestionsCard({
  className,
  onSuggestionHandled,
}: PendingSuggestionsCardProps) {
  const suggestions = usePendingSuggestions();
  const expenseCategoriesQuery = useCategories("expense");
  const incomeCategoriesQuery = useCategories("income");
  const merchantMemory = useMerchantCategoryMapping();
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const actions = usePendingSuggestionsActions(onSuggestionHandled);

  if (suggestions.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Sugestões de transações detectadas"
      className={cn(
        "rounded-2xl border border-border/80 bg-surface shadow-xs p-4 sm:p-5 flex flex-col gap-3.5 transition-all animate-in fade-in slide-in-from-top-2 duration-200",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Transações Detectadas
          </h2>
          <Badge variant="muted" size="xs">
            {suggestions.length === 1 ? "1 pendente" : `${suggestions.length} pendentes`}
          </Badge>
        </div>

        {suggestions.length >= 2 ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={actions.handleDismissAll}
              className="relative text-xs text-muted-foreground hover:text-negative-strong hover:bg-surface-hover self-start sm:self-auto cursor-pointer max-sm:after:absolute max-sm:after:-inset-2"
              aria-label="Descartar todas as sugestões"
            >
              <Trash2 className="size-3.5 mr-1" aria-hidden="true" />
              <span>Descartar todas</span>
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5 divide-y divide-border/80">
        {suggestions.map((sug) => {
          const availableCategories =
            sug.type === "income"
              ? (incomeCategoriesQuery.data ?? [])
              : (expenseCategoriesQuery.data ?? []);
          const resolvedCategory = resolveCategoryForSuggestion(
            sug,
            availableCategories,
            selectedCategories[sug.id],
            merchantMemory,
          );

          return (
            <PendingSuggestionRow
              key={sug.id}
              suggestion={sug}
              availableCategories={availableCategories}
              resolvedCategory={resolvedCategory}
              isPopoverOpen={openPopoverId === sug.id}
              onPopoverOpenChange={(open) => setOpenPopoverId(open ? sug.id : null)}
              onSelectCategory={(catId) => {
                setSelectedCategories((prev) => ({ ...prev, [sug.id]: catId }));
                setOpenPopoverId(null);
              }}
              onDismiss={() => actions.handleDismiss(sug.id)}
              onReview={() => actions.handleReview(sug, resolvedCategory?.id)}
              onQuickSave={() => void actions.handleQuickSave(sug, resolvedCategory)}
              onInvestmentRouting={() => actions.handleInvestmentRouting(sug)}
            />
          );
        })}
      </div>
    </div>
  );
}
