export type DividendReviewModalTab = "review" | "manual";

export interface OpenDividendReviewModalOptions {
  initialTab?: DividendReviewModalTab;
}

type Listener = (options: OpenDividendReviewModalOptions) => void;

const listeners = new Set<Listener>();

/**
 * Abre o modal global único de conferência e provisionamento manual de proventos.
 */
export function openDividendReviewModal(options: OpenDividendReviewModalOptions = {}): void {
  for (const listener of listeners) {
    listener(options);
  }
}

/**
 * Inscreve o host global único para abertura controlada do modal de proventos.
 */
export function subscribeDividendReviewModal(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
