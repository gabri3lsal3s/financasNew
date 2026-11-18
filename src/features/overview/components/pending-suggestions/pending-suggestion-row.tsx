import { ArrowUpRight, Check, ChevronDown, TrendingUp, X, Zap } from "lucide-react";
import { CategoryIcon } from "@/components/modules/category-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ParsedBankTransaction } from "@/domain/notifications";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { Category } from "@/types";

export interface PendingSuggestionRowProps {
  suggestion: ParsedBankTransaction;
  availableCategories: Category[];
  resolvedCategory?: Category;
  isPopoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  onSelectCategory: (categoryId: string) => void;
  onDismiss: () => void;
  onReview: () => void;
  onQuickSave: () => void;
  onInvestmentRouting: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  credit_card: "Cartão",
  debit: "Débito",
  pix: "Pix",
  transfer: "TED/DOC",
};

/**
 * Linha individual de transação detectada com seletor rápido de categoria e ações de 1 clique.
 */
export function PendingSuggestionRow({
  suggestion: sug,
  availableCategories,
  resolvedCategory,
  isPopoverOpen,
  onPopoverOpenChange,
  onSelectCategory,
  onDismiss,
  onReview,
  onQuickSave,
  onInvestmentRouting,
}: PendingSuggestionRowProps) {
  return (
    <div className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150 ease-out">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {sug.isRefund ? (
            <Badge variant="warning" size="xs">Estorno</Badge>
          ) : sug.nature === "investment" ? (
            <Badge variant="portfolio" size="xs">
              {sug.investmentSubtype === "dividend" ? "Provento" : "Investimento"}
            </Badge>
          ) : (
            <Badge variant={sug.type === "income" ? "positive" : "muted"} size="xs">
              {sug.type === "income" ? "Renda" : "Despesa"}
            </Badge>
          )}

          <Badge variant="muted" size="xs">{sug.bankName}</Badge>
          {sug.assetTicker ? <Badge variant="muted" size="xs">{sug.assetTicker}</Badge> : null}

          <Popover open={isPopoverOpen} onOpenChange={onPopoverOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="relative inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[11px] font-medium border border-border/80 bg-surface hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground transition-colors cursor-pointer select-none max-sm:after:absolute max-sm:after:-inset-y-2.5 max-sm:after:inset-x-0"
                aria-label={`Trocar categoria da sugestão ${sug.description}`}
              >
                <CategoryIcon icon={resolvedCategory?.icon} color={resolvedCategory?.color} className="size-3" />
                <span>{resolvedCategory?.name || "Sem categoria"}</span>
                <ChevronDown className="size-2.5 text-muted-foreground" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              collisionPadding={{ top: 8, left: 8, right: 8, bottom: 80 }}
              className="w-60 p-2"
            >
              <div className="text-xs font-semibold text-foreground px-2 py-1 border-b border-border/80">
                Trocar categoria
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1">
                {availableCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      triggerSensory("toggle");
                      onSelectCategory(cat.id);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 min-h-10 sm:min-h-0 rounded-lg text-xs hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-left cursor-pointer",
                      resolvedCategory?.id === cat.id && "bg-primary/10 font-medium text-primary-strong",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <CategoryIcon icon={cat.icon} color={cat.color} className="size-3.5" />
                      <span>{cat.name}</span>
                    </span>
                    {resolvedCategory?.id === cat.id ? (
                      <Check className="size-3.5 text-primary-strong" aria-hidden="true" />
                    ) : null}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {sug.paymentMethod ? (
            <span className="text-[11px] text-muted-foreground uppercase">
              {PAYMENT_LABELS[sug.paymentMethod] ?? "Outro"}
            </span>
          ) : null}

          {sug.installments && sug.installments > 1 ? (
            <Badge variant="muted" size="xs">
              {sug.currentInstallment ? `${sug.currentInstallment}/${sug.installments}x` : `${sug.installments}x`}
            </Badge>
          ) : null}

          <span className="text-[11px] text-muted-foreground">{formatDateBR(sug.date)}</span>
        </div>

        <div className="flex items-baseline gap-2 justify-between sm:justify-start">
          <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[260px] sm:max-w-[340px]">
            {sug.description}
          </span>
          <MoneyText
            cents={sug.amountCents}
            tone={sug.nature === "investment" ? "portfolio" : sug.type === "income" ? "positive" : "default"}
            variant="value"
            className="shrink-0"
          />
        </div>
      </div>

      {sug.nature === "investment" ? (
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label={`Descartar sugestão de ${sug.description}`}
          >
            <X className="size-3.5 sm:mr-1 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Descartar</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            sensoryIntent={false}
            onClick={onQuickSave}
            className="h-8 gap-1 text-xs font-medium cursor-pointer"
            aria-label={`Salvar como despesa ou renda sugestão de ${sug.description}`}
          >
            <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
            <span>Salvar como Despesa/Renda</span>
          </Button>
          <Button
            type="button"
            variant="portfolio"
            size="sm"
            onClick={onInvestmentRouting}
            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            aria-label={`Registrar aporte ou provento da sugestão ${sug.description}`}
          >
            <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Registrar Aporte / Provento</span>
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label={`Descartar sugestão de ${sug.description}`}
          >
            <X className="size-3.5 sm:mr-1 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Descartar</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReview}
            className="h-8 gap-1 text-xs font-medium cursor-pointer"
            aria-label={`Revisar sugestão de ${sug.description}`}
          >
            <span>Revisar</span>
            <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            sensoryIntent={false}
            onClick={onQuickSave}
            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            aria-label={`Salvar rápido sugestão de ${sug.description}`}
          >
            <Zap className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Salvar Rápido</span>
          </Button>
        </div>
      )}
    </div>
  );
}
