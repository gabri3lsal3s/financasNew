import { Check, Copy, ExternalLink, RotateCw, ShieldCheck, Trash2, Users } from "lucide-react";
import { Button, Input, MoneyText } from "@/components/ui";

export interface FamilyBudgetShareActivePanelProps {
  shareUrl: string;
  copied: boolean;
  hasGroupFamily: boolean;
  groupMonthlyBudgetCents: number;
  onCopyLink: () => void;
  onRequestRegenerate: () => void;
  onRequestRevoke: () => void;
}

export function FamilyBudgetShareActivePanel({
  shareUrl,
  copied,
  hasGroupFamily,
  groupMonthlyBudgetCents,
  onCopyLink,
  onRequestRegenerate,
  onRequestRevoke,
}: FamilyBudgetShareActivePanelProps) {
  return (
    <div className="space-y-3.5">
      <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
            <span>Link Exclusivo de Leitura</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.open(shareUrl, "_blank", "noopener,noreferrer");
                }
              }}
              className="gap-1 border-border/80 bg-surface"
              title="Visualizar página pública"
            >
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Abrir</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent={false}
              onClick={onCopyLink}
              className="gap-1 border-border/80 bg-surface"
              title="Copiar link"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>Copiar Link</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <Input
          type="text"
          readOnly
          value={shareUrl}
          className="text-base sm:text-sm bg-surface font-mono select-all text-muted-foreground"
          aria-label="URL do orçamento familiar compartilhado"
        />

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Apenas despesas marcadas como &ldquo;Familiar&rdquo; são exibidas. Suas contas bancárias, cartões de crédito e lançamentos particulares permanecem estritamente privados.
        </p>

        {hasGroupFamily && groupMonthlyBudgetCents > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/80">
            <Users className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>Teto da casa vinculado:</span>
            <MoneyText cents={groupMonthlyBudgetCents} tone="default" variant="caption" className="font-semibold" />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRequestRegenerate}
          className="gap-1.5 text-xs font-semibold rounded-xl border-border/80 bg-surface"
        >
          <RotateCw className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>Regenerar Link</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRequestRevoke}
          className="gap-1.5 text-xs font-semibold rounded-xl text-critical-strong hover:bg-critical/10 hover:border-critical/30 border-border/80 bg-surface"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          <span>Revogar Acesso</span>
        </Button>
      </div>
    </div>
  );
}
