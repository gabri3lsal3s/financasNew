import { Sparkles } from "lucide-react";
import { formatCentsAsBRL } from "@/services/masks";
import type { PredictionSuggestion } from "@/domain/predictions";

export interface PredictionSuggestionsProps {
  /** Sugestões derivadas do motor puro (já ordenadas por confiança). */
  suggestions: PredictionSuggestion[];
  /** Rótulos por forma de pagamento (ex.: { credit_card: "Cartão de crédito" }). */
  paymentLabels?: Record<string, string>;
  /** Rótulos por cartão (ex.: { card-nubank: "Nubank" }). */
  cardLabels?: Record<string, string>;
  /** Rótulos por tipo de recebimento (ex.: { pix: "Pix" }). */
  receiveLabels?: Record<string, string>;
  /** Aplica a sugestão ao formulário (1 toque). */
  onApply: (suggestion: PredictionSuggestion) => void;
}

/**
 * Sugestões preditivas de lançamento (F21) — autopreenchimento sutil e não
 * obstrutivo: lista compacta abaixo do campo de descrição, aceitação por
 * 1 toque (botão) ou teclado (Tab + Enter). Sem emojis; ícone lucide padrão.
 */
export function PredictionSuggestions({
  suggestions,
  paymentLabels,
  cardLabels,
  receiveLabels,
  onApply,
}: PredictionSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Sugestões preditivas de lançamento"
      className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface-raised p-2"
    >
      <p className="flex items-center gap-1.5 px-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Sparkles className="size-3" aria-hidden="true" />
        Sugestões
      </p>
      {suggestions.map((suggestion) => {
        const methodLabel = suggestion.paymentMethod ? paymentLabels?.[suggestion.paymentMethod] : undefined;
        const cardLabel = suggestion.cardId ? cardLabels?.[suggestion.cardId] : undefined;
        const receiveLabel = suggestion.receiveType ? receiveLabels?.[suggestion.receiveType] : undefined;
        const context =
          suggestion.paymentMethod && methodLabel
            ? cardLabel
              ? `${methodLabel} · ${cardLabel}`
              : methodLabel
            : suggestion.receiveType && receiveLabel
              ? receiveLabel
              : null;
        return (
          <button
            key={`${suggestion.categoryId}-${suggestion.paymentMethod ?? ""}-${suggestion.cardId ?? ""}-${suggestion.receiveType ?? ""}`}
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => onApply(suggestion)}
            className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-foreground">{suggestion.categoryName}</span>
              {context ? <span className="truncate text-[11px] text-muted-foreground">{context}</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {suggestion.value > 0 ? (
                <span className="num text-xs text-muted-foreground">{formatCentsAsBRL(Math.round(suggestion.value * 100))}</span>
              ) : null}
              <span className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground">Aplicar</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
