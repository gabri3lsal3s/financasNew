import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { triggerSensory } from "@/services/sensory";
import type { CreditCard } from "@/types";

export interface UseCardCarouselOptions {
  cards: CreditCard[];
  selectedCardId: string | null;
  onSelectCard: (id: string) => void;
}

/**
 * Gerencia seleção, direção de transição, swipe touch e navegação por teclado
 * da carteira de cartões de crédito.
 */
export function useCardCarousel({
  cards,
  selectedCardId,
  onSelectCard,
}: UseCardCarouselOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [direction, setDirection] = useState<"next" | "prev" | null>(null);
  const prevCardIdRef = useRef<string | null>(selectedCardId);

  const selectedIndex = Math.max(
    0,
    cards.findIndex((c) => c.id === selectedCardId),
  );
  const currentCard = cards[selectedIndex] ?? cards[0] ?? null;

  useEffect(() => {
    if (selectedCardId && prevCardIdRef.current && selectedCardId !== prevCardIdRef.current) {
      const prevIdx = cards.findIndex((c) => c.id === prevCardIdRef.current);
      const currIdx = cards.findIndex((c) => c.id === selectedCardId);
      if (prevIdx !== -1 && currIdx !== -1) {
        setDirection(currIdx > prevIdx ? "next" : "prev");
      }
    }
    prevCardIdRef.current = selectedCardId;
  }, [selectedCardId, cards]);

  const handlePrev = useCallback(() => {
    if (cards.length <= 1) return;
    const nextIdx = (selectedIndex - 1 + cards.length) % cards.length;
    const nextCard = cards[nextIdx];
    if (nextCard) {
      setDirection("prev");
      triggerSensory("selection");
      onSelectCard(nextCard.id);
    }
  }, [cards, selectedIndex, onSelectCard]);

  const handleNext = useCallback(() => {
    if (cards.length <= 1) return;
    const nextIdx = (selectedIndex + 1) % cards.length;
    const nextCard = cards[nextIdx];
    if (nextCard) {
      setDirection("next");
      triggerSensory("selection");
      onSelectCard(nextCard.id);
    }
  }, [cards, selectedIndex, onSelectCard]);

  const handleSelectChip = useCallback(
    (cardId: string) => {
      const targetIndex = cards.findIndex((c) => c.id === cardId);
      if (targetIndex !== selectedIndex) {
        setDirection(targetIndex > selectedIndex ? "next" : "prev");
        triggerSensory("selection");
        onSelectCard(cardId);
      }
    },
    [cards, selectedIndex, onSelectCard],
  );

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) setTouchStartX(touch.clientX);
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const touch = e.changedTouches[0];
    setTouchStartX(null);
    if (!touch) return;
    const diff = touch.clientX - touchStartX;
    const threshold = 40;

    if (diff > threshold) {
      handlePrev();
    } else if (diff < -threshold) {
      handleNext();
    }
  };

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
  }, [handlePrev, handleNext]);

  return {
    containerRef,
    selectedIndex,
    currentCard,
    direction,
    handlePrev,
    handleNext,
    handleSelectChip,
    handleTouchStart,
    handleTouchEnd,
  };
}
