import { X, Zap } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import type { DetectedPixTransaction } from "@/hooks";

export interface DashboardPixClipboardCardProps {
  detected: DetectedPixTransaction;
  onLaunch: (params: {
    valorCents?: number;
    desc?: string;
    categoria?: string;
    tipo?: "expense" | "income";
    forma?: "pix";
    pixKey?: string;
  }) => void;
  onDismiss: () => void;
}

/**
 * Cartão contextual de sugestão para Pix copiado na área de transferência.
 */
export function DashboardPixClipboardCard({
  detected,
  onLaunch,
  onDismiss,
}: DashboardPixClipboardCardProps) {
  const { candidate, identity } = detected;

  const handleLaunch = () => {
    onLaunch({
      valorCents: candidate.valueCents,
      desc: identity.friendlyName || candidate.description,
      categoria: identity.categorySlug,
      tipo: identity.defaultNature || candidate.nature,
      forma: "pix",
      pixKey: candidate.pixKey,
    });
  };

  const title = identity.friendlyName || candidate.recipientName || "Pix Detectado";
  const isIncome = candidate.nature === "income";

  return (
    <div
      role="region"
      aria-label="Sugestão de Pix detectado"
      className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full min-h-[72px] p-3.5 sm:p-4 rounded-2xl border border-positive/30 bg-surface shadow-xs transition-all ring-1 ring-positive/10"
    >
      <div className="flex items-center gap-3 min-w-0 pr-6 sm:pr-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-positive/20 bg-positive/10 text-positive-strong">
          <Zap className="size-4.5" aria-hidden="true" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">{title}</span>
            <Badge variant="positive" size="xs">
              PIX DETECTADO
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-1 break-words">
            <MoneyText cents={candidate.valueCents} tone="default" className="font-semibold" /> ·{" "}
            {identity.isLearned ? `Categoria: ${identity.categorySlug}` : "Toque para confirmar lançamento"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          size="sm"
          variant="default"
          sensoryIntent="success"
          onClick={handleLaunch}
          className="h-8 gap-1.5 px-3 text-xs flex-1 sm:flex-initial"
        >
          <Zap className="size-3.5" aria-hidden="true" />
          <span>{isIncome ? "Lançar Receita" : "Lançar Despesa"}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="relative size-7 sm:size-8 p-0 text-muted-foreground hover:text-foreground shrink-0 max-sm:after:absolute max-sm:after:-inset-2"
          aria-label="Dispensar sugestão de Pix"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
