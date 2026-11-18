import { useState } from "react";
import { Check, Copy, MessageCircle, ShieldCheck } from "lucide-react";
import { Badge, Button, MoneyText, QrCodeCanvas } from "@/components/ui";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import {
  DEMO_PIX_KEY,
  DEMO_PIX_PAYLOAD,
  SPLIT_PARTICIPANTS,
} from "./split-mockup-data";

export interface SplitMockupPreviewProps {
  active: boolean;
}

export function SplitMockupPreview({ active }: SplitMockupPreviewProps) {
  const [copiedPix, setCopiedPix] = useState(false);
  const [whatsAppShared, setWhatsAppShared] = useState(false);

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard?.writeText?.(DEMO_PIX_PAYLOAD);
    } catch {
      // Ignora falhas de clipboard em ambientes sem permissão
    }
    setCopiedPix(true);
    pushToast({
      title: "Pix copia e cola pronto",
      description: `R$ 120,00 para ${DEMO_PIX_KEY}`,
      variant: "success",
      duration: 4000,
    });
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleShareWhatsApp = () => {
    setWhatsAppShared(true);
    pushToast({
      title: "Cobrança enviada",
      description: "Lembrete com o Pix foi enviado para os 2 participantes pendentes.",
      variant: "info",
      duration: 4000,
    });
    setTimeout(() => setWhatsAppShared(false), 2500);
  };

  return (
    <div
      role="region"
      aria-label="Racha de despesas com Pix"
      data-testid="card-racha"
      className={cn("space-y-3 sm:space-y-3.5", active ? "block" : "hidden")}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-2.5 sm:pb-3">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold text-foreground">
            Churrasco de Confraternização
          </div>
          <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            Racha entre 4 amigos · Cota de{" "}
            <MoneyText cents={12000} className="font-semibold text-foreground" />
          </div>
        </div>
        <Badge variant="positive" size="xs" className="font-mono shrink-0 self-start sm:self-auto">
          2 de 3 pagaram
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs font-mono">
        <div className="p-2.5 sm:p-3 rounded-xl bg-surface-raised/60 border border-border/80 min-w-0">
          <span className="text-muted-foreground block text-[11px] font-sans">
            Valor Total da Conta:
          </span>
          <MoneyText cents={48000} tone="default" className="font-bold text-sm sm:text-base" />
        </div>
        <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 border border-primary/30 min-w-0">
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-primary-strong font-sans font-semibold text-[11px]">
              Total a Receber:
            </span>
            <span className="text-[11px] text-positive-strong font-semibold">67% pago</span>
          </div>
          <MoneyText
            cents={36000}
            tone="default"
            className="font-bold text-primary-strong text-sm sm:text-base"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans">
          <span>Status dos Participantes</span>
          <span className="font-mono font-normal">4 pessoas</span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface-raised/40 divide-y divide-border/50 overflow-hidden text-xs">
          {SPLIT_PARTICIPANTS.map((p) => (
            <div
              key={p.initials}
              className="flex items-center justify-between gap-2 p-2.5 transition-colors hover:bg-surface-hover/50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold font-mono",
                    p.avatarClass,
                  )}
                >
                  {p.initials}
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-foreground truncate block">{p.name}</span>
                  <span className={cn("text-[11px] block truncate", p.detailClass)}>{p.detail}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <Badge variant={p.badgeVariant} size="xs">
                  {p.badgeText}
                </Badge>
                <MoneyText cents={p.amountCents} tone="default" className="font-bold text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-surface-raised/50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="shrink-0 self-start sm:self-center">
            <QrCodeCanvas
              text={DEMO_PIX_PAYLOAD}
              size={72}
              label={`QR Code Pix da chave ${DEMO_PIX_KEY}`}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary shrink-0" aria-hidden="true" />
              <span>Chave Pix Dinâmica (E-mail)</span>
            </div>
            <span className="font-mono font-semibold text-foreground text-xs break-all block leading-snug">
              {DEMO_PIX_KEY}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyPix}
                className="w-full justify-center gap-1.5 text-xs font-semibold rounded-lg"
              >
                {copiedPix ? (
                  <>
                    <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                    <span>Pix Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" aria-hidden="true" />
                    <span>Copiar Pix</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleShareWhatsApp}
                className="w-full justify-center gap-1.5 text-xs font-semibold rounded-lg shadow-xs"
              >
                {whatsAppShared ? (
                  <>
                    <Check className="size-3.5" aria-hidden="true" />
                    <span>Lembrete Enviado</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    <span>Cobrar no WhatsApp</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
