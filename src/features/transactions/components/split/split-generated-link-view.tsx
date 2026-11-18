import { Check, Copy } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import type { SplitExpenseSummary } from "@/domain/finance/split-math";

export interface SplitGeneratedLinkViewProps {
  generatedLink: string;
  copied: boolean;
  onCopyLinkAgain: () => void;
  totalCents: number;
  summary: SplitExpenseSummary;
}

/** Exibição do link gerado e resumo final do racha. */
export function SplitGeneratedLinkView({
  generatedLink,
  copied,
  onCopyLinkAgain,
  totalCents,
  summary,
}: SplitGeneratedLinkViewProps) {
  return (
    <div data-tour="split-link-actions" className="space-y-4">
      <div className="rounded-xl border border-positive/30 bg-positive/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-positive/10 flex items-center justify-center text-positive-strong shrink-0">
            <Check className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Link de Racha Gerado</h4>
            <p className="text-xs text-muted-foreground">O link foi copiado para a sua área de transferência.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={generatedLink}
            readOnly
            className="font-mono text-base sm:text-sm bg-surface select-all"
            aria-label="Link público do racha"
          />
          <Button type="button" variant="outline" size="sm" onClick={onCopyLinkAgain} className="shrink-0 gap-1.5">
            {copied ? (
              <>
                <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>Copiado</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden="true" />
                <span>Copiar</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-2 shadow-xs">
        <span className="text-xs font-semibold text-foreground">Resumo da Partilha</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="rounded-lg border border-border/80 bg-surface-raised/60 p-2.5">
            <span className="text-[11px] text-muted-foreground block">Total</span>
            <MoneyText cents={totalCents} variant="value" className="font-semibold" />
          </div>
          <div className="rounded-lg border border-border/80 bg-surface-raised/60 p-2.5">
            <span className="text-[11px] text-muted-foreground block">Cada Convidado ({summary.guestCount})</span>
            <MoneyText cents={summary.guestShareCents} tone="portfolio" variant="value" className="font-semibold" />
          </div>
          <div className="rounded-lg border border-border/80 bg-surface-raised/60 p-2.5">
            <span className="text-[11px] text-muted-foreground block">Sua Parte (Anfitrião)</span>
            <MoneyText cents={summary.hostShareCents} variant="value" className="font-semibold" />
          </div>
        </div>
      </div>
    </div>
  );
}
