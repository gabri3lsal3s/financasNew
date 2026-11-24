import { ArrowRight, Sparkles } from "lucide-react";
import { Button, Card } from "@/components/ui";

export interface SplitConversionBannerProps {
  isSavingDirectly: boolean;
  onLearnMore: () => void;
  onSaveExpense: () => void;
}

/**
 * Cartão de conversão e salvamento direto exibido no rodapé da página pública de racha (/r/:token).
 */
export function SplitConversionBanner({
  isSavingDirectly,
  onLearnMore,
  onSaveExpense,
}: SplitConversionBannerProps) {
  return (
    <Card className="border-border/80 bg-surface shadow-xs rounded-2xl p-4 sm:p-5 space-y-3.5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
        <span className="text-xs font-bold text-foreground">
          Divida despesas com elegância
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Gostou da facilidade da divisão de contas? Organize suas finanças, cartões, metas e Safe-to-Spend em tempo real sem planilhas complicadas.
      </p>
      <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
        <Button
          type="button"
          size="default"
          className="w-full sm:flex-1 gap-2 font-semibold text-xs sm:text-sm shadow-xs"
          onClick={onLearnMore}
        >
          <ArrowRight className="size-4" aria-hidden="true" />
          <span>Conhecer o Axir</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="default"
          className="w-full sm:flex-1 gap-2 border-border/80 bg-surface hover:bg-surface-hover font-semibold text-xs sm:text-sm text-foreground"
          onClick={onSaveExpense}
          disabled={isSavingDirectly}
          sensoryIntent="action"
          aria-label="Salvar esta despesa no meu controle financeiro"
        >
          <Sparkles className="size-4 text-primary-strong" aria-hidden="true" />
          <span>{isSavingDirectly ? "Salvando despesa…" : "Salvar esta despesa"}</span>
        </Button>
      </div>
    </Card>
  );
}
