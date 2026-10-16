import { useNavigate } from "react-router";
import { ArrowUpRight, Check, Receipt, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { formatDateBR } from "@/lib/date";
import {
  clearPendingSuggestions,
  dismissPendingSuggestion,
  usePendingSuggestions,
} from "@/services/native";
import { cn } from "@/lib/utils";
import { inferCategoryKeyword } from "@/domain/notifications";

export interface PendingSuggestionsCardProps {
  className?: string;
  onSuggestionHandled?: (id: string) => void;
}

export function PendingSuggestionsCard({
  className,
  onSuggestionHandled,
}: PendingSuggestionsCardProps) {
  const navigate = useNavigate();
  const suggestions = usePendingSuggestions();

  if (suggestions.length === 0) {
    return null;
  }

  const handleConfirm = (
    id: string,
    type: string,
    cents: number,
    desc: string,
    date: string,
    method?: string,
    installments?: number,
    categorySlug?: string,
  ) => {
    onSuggestionHandled?.(id);
    const inferredSlug = categorySlug || inferCategoryKeyword(desc);
    const params = new URLSearchParams({
      novo: type,
      valor: String(cents),
      descricao: desc,
      data: date,
      forma: method || "pix",
      sug_id: id,
    });
    if (inferredSlug) {
      params.set("categoria", inferredSlug);
    }
    if (installments && installments > 1) {
      params.set("parcelas", String(installments));
    }
    navigate(`/?${params.toString()}`);
  };

  const handleDismiss = (id: string) => {
    onSuggestionHandled?.(id);
    dismissPendingSuggestion(id);
  };

  const handleDismissAll = () => {
    clearPendingSuggestions();
  };

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

        {suggestions.length >= 2 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleDismissAll}
            className="text-xs text-muted-foreground hover:text-negative-strong hover:bg-surface-hover self-start sm:self-auto cursor-pointer"
            aria-label="Descartar todas as sugestões"
          >
            <Trash2 className="size-3.5 mr-1" aria-hidden="true" />
            <span>Descartar todas</span>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2.5 divide-y divide-border/40">
        {suggestions.map((sug) => (
          <div
            key={sug.id}
            className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150 ease-out"
          >
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="muted" size="xs">
                  {sug.bankName}
                </Badge>
                {sug.paymentMethod && (
                  <span className="text-[11px] text-muted-foreground uppercase">
                    {sug.paymentMethod === "credit_card"
                      ? "Cartão"
                      : sug.paymentMethod === "debit"
                        ? "Débito"
                        : sug.paymentMethod === "pix"
                          ? "Pix"
                          : sug.paymentMethod === "transfer"
                            ? "TED/DOC"
                            : "Outro"}
                  </span>
                )}
                {sug.installments && sug.installments > 1 && (
                  <Badge variant="muted" size="xs">
                    {sug.currentInstallment
                      ? `${sug.currentInstallment}/${sug.installments}x`
                      : `${sug.installments}x`}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {formatDateBR(sug.date)}
                </span>
              </div>

              <div className="flex items-baseline gap-2 justify-between sm:justify-start">
                <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[260px] sm:max-w-[340px]">
                  {sug.description}
                </span>
                <MoneyText
                  cents={sug.amountCents}
                  tone={sug.type === "income" ? "positive" : "default"}
                  variant="value"
                  className="shrink-0"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(sug.id)}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label={`Descartar sugestão de ${sug.description}`}
              >
                <X className="size-4 sm:mr-1 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Descartar</span>
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() =>
                  handleConfirm(
                    sug.id,
                    sug.type,
                    sug.amountCents,
                    sug.description,
                    sug.date,
                    sug.paymentMethod,
                    sug.installments,
                    sug.categorySlug,
                  )
                }
                className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                aria-label={`Conferir e salvar sugestão de ${sug.description}`}
              >
                <Check className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Conferir e Salvar</span>
                <ArrowUpRight className="size-3 hidden sm:inline shrink-0" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
