import { Zap, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
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

export function DashboardPixClipboardCard({
  detected,
  onLaunch,
  onDismiss,
}: DashboardPixClipboardCardProps) {
  const { candidate, identity } = detected;

  const handleLaunch = () => {
    triggerSensory("success");
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
  const amountFormatted = formatCentsAsBRL(candidate.valueCents);
  const isIncome = candidate.nature === "income";

  return (
    <div
      role="alert"
      className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs transition-all"
    >
      <div className="flex items-center gap-3 min-w-0 pr-6 sm:pr-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-portfolio/20 bg-portfolio/10 text-portfolio">
          <Zap className="size-4.5" aria-hidden="true" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {title}
            </span>
            <Badge variant="positive" size="xs">
              PIX DETECTADO
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {amountFormatted} • {identity.isLearned ? `Categoria: ${identity.categorySlug}` : "Toque para confirmar lançamento"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={handleLaunch}
          className="h-8 gap-1.5 px-3 text-xs flex-1 sm:flex-initial"
        >
          <Zap className="size-3.5" aria-hidden="true" />
          <span>{isIncome ? "Lançar Receita" : "Lançar Despesa"}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onDismiss}
          className="size-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Dispensar sugestão de Pix"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
