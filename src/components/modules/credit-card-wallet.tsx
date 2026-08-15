import { useState, useRef, useEffect, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, WalletCards } from "lucide-react";
import { Button } from "@/components/ui";
import { CreditCard3D } from "./credit-card-3d";
import { triggerHaptic } from "@/services/haptics";
import type { InvoiceStatus } from "@/domain/cards";
import { cn } from "@/lib/utils";
import type { CreditCard } from "@/types";

export interface CardLimitUsageEntry {
  brutoCents: number;
  ponderadoCents: number;
}

export interface CreditCardWalletProps {
  cards: CreditCard[];
  selectedCardId: string | null;
  onSelectCard: (id: string) => void;
  onEditCard?: (card: CreditCard) => void;
  onDeleteCard?: (card: CreditCard) => void;
  onNewCard?: () => void;
  /** Mapeamento de limite utilizado em centavos ou objeto { brutoCents, ponderadoCents } por ID do cartão. */
  usedLimitMap?: Record<string, number | CardLimitUsageEntry>;
  /** Competência da fatura atual (YYYY-MM). */
  competenceMonth?: string;
  /** Status da fatura ("closed" | "open" | "near_due" | "overdue"). */
  status?: InvoiceStatus;
  className?: string;
}

/**
 * Carteira / Carrossel 3D de Cartões de Crédito com navegação por swipe,
 * teclado, botões anterior/próximo externos e atalhos rápidos de edição/exclusão.
 */
export function CreditCardWallet({
  cards,
  selectedCardId,
  onSelectCard,
  onEditCard,
  onDeleteCard,
  onNewCard,
  usedLimitMap = {},
  competenceMonth,
  className,
}: CreditCardWalletProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const selectedIndex = Math.max(
    0,
    cards.findIndex((c) => c.id === selectedCardId),
  );
  const currentCard = cards[selectedIndex] ?? cards[0] ?? null;

  const handlePrev = () => {
    if (cards.length <= 1) return;
    const nextIdx = (selectedIndex - 1 + cards.length) % cards.length;
    const nextCard = cards[nextIdx];
    if (nextCard) {
      triggerHaptic("light");
      onSelectCard(nextCard.id);
    }
  };

  const handleNext = () => {
    if (cards.length <= 1) return;
    const nextIdx = (selectedIndex + 1) % cards.length;
    const nextCard = cards[nextIdx];
    if (nextCard) {
      triggerHaptic("light");
      onSelectCard(nextCard.id);
    }
  };

  // Suporte a gestos touch (swipe no mobile)
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) setTouchStartX(touch.clientX);
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const diff = touch.clientX - touchStartX;
    const threshold = 40; // 40px swipe threshold

    if (diff > threshold) {
      handlePrev();
    } else if (diff < -threshold) {
      handleNext();
    }
    setTouchStartX(null);
  };

  // Navegação por teclado quando o wallet está focado
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (cards.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col items-center gap-3 w-full select-none", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header da Carteira discreto e alinhado à largura do cartão */}
      <div className="flex items-center justify-between w-full max-w-[390px] sm:max-w-[420px] px-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <WalletCards className="size-4" aria-hidden="true" />
          <span className="text-xs font-medium text-foreground">Sua Carteira</span>
          <span className="text-[11px] text-muted-foreground/75 font-mono">
            ({selectedIndex + 1}/{cards.length})
          </span>
        </div>

        {/* Ações contextuais discretas */}
        <div className="flex items-center gap-1">
          {currentCard && onEditCard && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditCard(currentCard)}
              aria-label={`Editar cartão ${currentCard.name}`}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3" aria-hidden="true" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}

          {currentCard && onDeleteCard && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDeleteCard(currentCard)}
              aria-label={`Excluir cartão ${currentCard.name}`}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-critical"
            >
              <Trash2 className="size-3" aria-hidden="true" />
              <span className="hidden sm:inline">Excluir</span>
            </Button>
          )}

          {onNewCard && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNewCard}
              aria-label="Adicionar novo cartão"
              className="h-7 px-2 text-xs gap-1"
            >
              <Plus className="size-3" aria-hidden="true" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          )}
        </div>
      </div>

      {/* Palco 3D do Cartão com navegação externa nas laterais (sem sobreposição) */}
      <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-4 w-full max-w-[540px] px-1">
        {/* Botão Anterior externo */}
        {cards.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Cartão anterior"
            className="shrink-0 flex size-8 sm:size-9 items-center justify-center rounded-full bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover shadow-xs transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft className="size-4 sm:size-5" aria-hidden="true" />
          </button>
        )}

        {/* Cartão 3D renderizado em destaque */}
        {currentCard && (() => {
          const limitEntry = usedLimitMap[currentCard.id];
          const usedLimitCents = typeof limitEntry === "object" ? limitEntry.brutoCents : (limitEntry ?? 0);
          const usedLimitPonderadoCents = typeof limitEntry === "object" ? limitEntry.ponderadoCents : undefined;

          return (
            <div className="flex-1 min-w-0 max-w-[360px] sm:max-w-[420px] flex justify-center transform transition-all duration-300">
              <CreditCard3D
                card={currentCard}
                usedLimitCents={usedLimitCents}
                usedLimitPonderadoCents={usedLimitPonderadoCents}
                competenceMonth={competenceMonth}
                isSelected={true}
                isInteractive={true}
                onClick={() => onSelectCard(currentCard.id)}
              />
            </div>
          );
        })()}

        {/* Botão Próximo externo */}
        {cards.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Próximo cartão"
            className="shrink-0 flex size-8 sm:size-9 items-center justify-center rounded-full bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover shadow-xs transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronRight className="size-4 sm:size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Seletor rápido de cartões com chips e indicadores de paginação (Dots) */}
      {cards.length > 1 && (
        <div className="flex flex-col items-center gap-2 w-full max-w-[390px] sm:max-w-[420px]">
          {/* Indicadores em Dot */}
          <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Navegação entre cartões">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={card.id === currentCard?.id}
                aria-label={`Ir para cartão ${card.name}`}
                onClick={() => {
                  triggerHaptic("light");
                  onSelectCard(card.id);
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  card.id === currentCard?.id
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
              />
            ))}
          </div>

          {/* Chips horizontais dos cartões para seleção rápida por nome */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 px-2">
            {cards.map((card) => {
              const isSelected = card.id === currentCard?.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    onSelectCard(card.id);
                  }}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isSelected
                      ? "border-primary/60 bg-primary/10 text-primary-strong font-semibold shadow-xs"
                      : "border-border/60 bg-surface/80 text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  <span
                    className="size-1.5 rounded-full shadow-xs"
                    style={{ backgroundColor: card.color || "var(--primary)" }}
                    aria-hidden="true"
                  />
                  <span>{card.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
