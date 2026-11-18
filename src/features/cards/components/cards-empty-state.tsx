import { Plus, Sparkles, WalletCards } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { startDemo } from "@/state";

export interface CardsEmptyStateProps {
  onAddFirstCard: () => void;
}

/** Estado vazio calmo quando não há cartões cadastrados. */
export function CardsEmptyState({ onAddFirstCard }: CardsEmptyStateProps) {
  return (
    <EmptyState
      icon={<WalletCards className="size-6" aria-hidden="true" />}
      title="Nenhum cartão cadastrado"
      description="Adicione seus cartões de crédito para acompanhar faturas, limites disponíveis, melhor data de compra e extrato."
      tone="default"
      className="py-12 sm:py-16 px-6"
      action={
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          <Button onClick={onAddFirstCard} className="gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Adicionar primeiro cartão
          </Button>
          <Button
            variant="outline"
            onClick={() => startDemo("finances_cards")}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="size-3.5 text-muted-foreground" aria-hidden="true" />
            Ver fatura na Simulação
          </Button>
        </div>
      }
    />
  );
}
