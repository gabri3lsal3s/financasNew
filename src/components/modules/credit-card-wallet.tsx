import { ChevronLeft, ChevronRight, Plus, WalletCards } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { CreditCard } from "@/types";
import { CreditCard3D } from "./credit-card-3d";
import { useCardCarousel } from "./credit-card/use-card-carousel";

export interface CardLimitUsageEntry {
  brutoCents: number;
  ponderadoCents: number;
}

export interface CreditCardWalletProps {
  cards: CreditCard[];
  selectedCardId: string | null;
  /** ID do cartão principal configurado pelo usuário. */
  primaryCardId?: string | null;
  onSelectCard: (id: string) => void;
  onEditCard?: (card: CreditCard) => void;
  onNewCard?: () => void;
  /** Mapeamento de limite utilizado em centavos ou objeto { brutoCents, ponderadoCents } por ID do cartão. */
  usedLimitMap?: Record<string, number | CardLimitUsageEntry>;
  /** Competência da fatura atual (YYYY-MM). */
  competenceMonth?: string;
  className?: string;
}

/**
 * Carteira / Carrossel 3D de Cartões de Crédito com navegação por swipe,
 * teclado, botões anterior/próximo externos e seleção rápida por chips.
 */
export function CreditCardWallet({
  cards,
  selectedCardId,
  primaryCardId,
  onSelectCard,
  onEditCard,
  onNewCard,
  usedLimitMap = {},
  competenceMonth,
  className,
}: CreditCardWalletProps) {
  const {
    containerRef,
    selectedIndex,
    currentCard,
    direction,
    handlePrev,
    handleNext,
    handleSelectChip,
    handleTouchStart,
    handleTouchEnd,
  } = useCardCarousel({ cards, selectedCardId, onSelectCard });

  if (cards.length === 0) {
    return null;
  }

  const limitEntry = currentCard ? usedLimitMap[currentCard.id] : undefined;
  const usedLimitCents = typeof limitEntry === "object" ? limitEntry.brutoCents : (limitEntry ?? 0);
  const usedLimitPonderadoCents = typeof limitEntry === "object" ? limitEntry.ponderadoCents : undefined;

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col items-center gap-3 w-full select-none", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header da Carteira */}
      <div className="flex items-center justify-between w-full max-w-[390px] sm:max-w-[420px] px-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <WalletCards className="size-4" aria-hidden="true" />
          <span className="text-xs font-medium text-foreground">Sua Carteira</span>
          <span className="text-[11px] text-muted-foreground/80 font-mono tabular-nums">
            ({selectedIndex + 1}/{cards.length})
          </span>
        </div>

        {onNewCard && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewCard}
            aria-label="Adicionar novo cartão"
            className="gap-1"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Novo</span>
          </Button>
        )}
      </div>

      {/* Palco 3D do Cartão com navegação externa em tablets/desktop */}
      <div className="flex items-center justify-center sm:gap-3 md:gap-4 w-full max-w-[540px]">
        {cards.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Cartão anterior"
            className="hidden sm:flex shrink-0 size-9 items-center justify-center rounded-full bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover shadow-xs transition-transform duration-150 hover:scale-105 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ChevronLeft className="size-4 sm:size-5" aria-hidden="true" />
          </button>
        )}

        {currentCard && (
          <div
            key={currentCard.id}
            className={cn(
              "w-full flex-1 min-w-0 max-w-[390px] sm:max-w-[420px] flex justify-center transition-all duration-300",
              direction === "next" && "animate-card-slide-left",
              direction === "prev" && "animate-card-slide-right",
            )}
          >
            <CreditCard3D
              card={currentCard}
              isPrimary={currentCard.id === primaryCardId}
              usedLimitCents={usedLimitCents}
              usedLimitPonderadoCents={usedLimitPonderadoCents}
              competenceMonth={competenceMonth}
              isSelected={true}
              isInteractive={true}
              onClick={() => {
                triggerSensory("action");
                if (onEditCard) {
                  onEditCard(currentCard);
                } else {
                  onSelectCard(currentCard.id);
                }
              }}
            />
          </div>
        )}

        {cards.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Próximo cartão"
            className="hidden sm:flex shrink-0 size-9 items-center justify-center rounded-full bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover shadow-xs transition-transform duration-150 hover:scale-105 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ChevronRight className="size-4 sm:size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Seletor rápido por chips */}
      {cards.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 w-full max-w-[390px] sm:max-w-[420px] px-1 pt-0.5">
          {cards.map((card) => {
            const isSelected = card.id === currentCard?.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleSelectChip(card.id)}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs font-medium border transition-colors duration-150 cursor-pointer",
                  "max-sm:after:absolute max-sm:after:-inset-1.5",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary/60 bg-primary/10 text-primary-strong font-semibold shadow-xs"
                    : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <span
                  className="size-1.5 rounded-full shadow-xs shrink-0"
                  style={{ backgroundColor: card.color || "hsl(var(--primary))" }}
                  aria-hidden="true"
                />
                <span className="truncate max-w-[130px]">{card.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
