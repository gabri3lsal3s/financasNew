import { QrCode, Copy, Share2, Users, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface SplitPreviewMockupCardProps {
  className?: string;
  totalCents?: number;
  peopleCount?: number;
  description?: string;
  pixKey?: string;
  merchantName?: string;
  onCopyClick?: () => void;
  onShareClick?: () => void;
}

/**
 * SplitPreviewMockupCard — Componente ilustrado de apresentação didática de Racha Pix (§Plano 11).
 *
 * Exibe a visualização completa e elegante de uma cobrança compartilhada dividida
 * de forma puramente estática e pedagógica para Tours Guiados, prevenindo concorrência
 * de foco, mutações indesejadas no banco de dados e vazamento de PII.
 */
export function SplitPreviewMockupCard({
  className,
  totalCents = 48000,
  peopleCount = 4,
  description = "Churrasco de Confraternização",
  pixKey = "pix.demo@exemplo.com",
  merchantName = "Gabriel (Demonstração)",
  onCopyClick,
  onShareClick,
}: SplitPreviewMockupCardProps) {
  const shareCents = Math.round(totalCents / Math.max(1, peopleCount));

  return (
    <div
      data-tour="split-mockup-card"
      className={cn(
        "rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col gap-4 text-left transition-all",
        className,
      )}
    >
      {/* Cabeçalho do Card com Badge didático */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio shrink-0">
              <Users className="size-3.5" aria-hidden="true" />
            </span>
            <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
              {description}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Cobrança organizada por <strong className="font-semibold text-foreground">{merchantName}</strong>
          </p>
        </div>

        <Badge variant="muted" size="xs" className="gap-1 bg-surface-hover/40 border border-border/70 text-muted-foreground shrink-0">
          <Sparkles className="size-3 text-portfolio" aria-hidden="true" />
          <span>Exemplo Demonstrativo</span>
        </Badge>
      </div>

      {/* Grade de valores: Total vs Por Pessoa */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-hover/30 border border-border/60">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">Valor Total</span>
          <MoneyText cents={totalCents} tone="default" className="text-base sm:text-lg font-bold" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Cada um paga ({peopleCount} pessoas)
          </span>
          <MoneyText cents={shareCents} tone="positive" className="text-base sm:text-lg font-bold" />
        </div>
      </div>

      {/* Caixa didática de Chave Pix & QR Code Pedagógico */}
      <div
        data-tour="split-mockup-pix-box"
        className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-xl border border-dashed border-border/80 bg-surface/60"
      >
        <div className="flex size-20 sm:size-24 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background/80 shadow-2xs">
          <QrCode className="size-14 sm:size-16 text-foreground/80" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-1.5 w-full min-w-0 text-center sm:text-left">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Chave Pix para Pagamento
          </span>
          <div className="flex items-center justify-center sm:justify-start gap-1.5 font-mono text-xs font-medium text-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg border border-border/50 truncate">
            <span className="truncate">{pixKey}</span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
            <span>Dados protegidos e sem cobrança de taxas</span>
          </div>
        </div>
      </div>

      {/* Ações ilustradas (Copiar e Compartilhar) */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopyClick}
          className="flex-1 gap-1.5 text-xs font-semibold"
        >
          <Copy className="size-3.5" aria-hidden="true" />
          <span>Copiar Chave Pix</span>
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onShareClick}
          className="flex-1 gap-1.5 text-xs font-semibold bg-portfolio hover:bg-portfolio/90 text-portfolio-foreground"
        >
          <Share2 className="size-3.5" aria-hidden="true" />
          <span>Compartilhar Link</span>
        </Button>
      </div>
    </div>
  );
}
