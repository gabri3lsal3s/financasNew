import { QrCodeCanvas } from "@/components/ui/qr-code-canvas";
import { ArrowLeft, Check, Clock, Copy, CreditCard, Loader2, QrCode, Zap } from "lucide-react";
import { Button, MoneyText } from "@/components/ui";
import type { PixCheckoutResult } from "@/state";

export interface PixQrWaitingPanelProps {
  pixResult: PixCheckoutResult;
  priceCents: number;
  copiedPix: boolean;
  isVerifyingManual?: boolean;
  onCopyPix: () => void;
  onManualVerify?: () => void;
  onSimulateConfirmation: () => void;
  onSwitchToCard: () => void;
  onBackToPlans: () => void;
  onGoToDashboard: () => void;
}

export function PixQrWaitingPanel({
  pixResult,
  priceCents,
  copiedPix,
  isVerifyingManual = false,
  onCopyPix,
  onManualVerify,
  onSimulateConfirmation,
  onSwitchToCard,
  onBackToPlans,
  onGoToDashboard,
}: PixQrWaitingPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-surface-raised/60 p-5">
      <div className="rounded-xl bg-surface p-3 border border-border/80 shadow-xs flex flex-col items-center justify-center">
        {pixResult.qrCodeBase64 ? (
          <img
                width={176}
                height={176}
            src={`data:image/png;base64,${pixResult.qrCodeBase64}`}
            alt="QR Code PIX"
            className="size-44 object-contain rounded-lg"
          />
        ) : pixResult.copyPasteKey ? (
          <QrCodeCanvas
            text={pixResult.copyPasteKey}
            size={176}
            label="QR Code PIX"
          />
        ) : (
          <div className="size-44 flex flex-col items-center justify-center bg-muted/40 rounded-lg p-2 text-center gap-2">
            <QrCode className="size-20 text-primary" aria-hidden="true" />
            <span className="text-[11px] text-muted-foreground font-mono">PIX Demonstrativo</span>
          </div>
        )}
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-foreground">
          PIX de <MoneyText cents={priceCents} tone="default" className="font-extrabold" />
        </p>
        <p className="text-xs text-muted-foreground leading-snug max-w-xs">
          Escaneie o QR Code no app do seu banco ou copie a chave abaixo.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        sensoryIntent={false}
        onClick={onCopyPix}
        className="w-full gap-2 text-xs font-medium"
      >
        {copiedPix ? (
          <>
            <Check className="size-4 text-positive-strong" aria-hidden="true" />
            <span>Chave PIX Copiada!</span>
          </>
        ) : (
          <>
            <Copy className="size-4" aria-hidden="true" />
            <span>Copiar Código PIX</span>
          </>
        )}
      </Button>

      <div role="status" aria-live="polite" className="sr-only">
        {copiedPix ? "Chave PIX copiada para a área de transferência." : ""}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground text-center">
        <Clock className="size-3.5 shrink-0" aria-hidden="true" />
        <span>Aguardando pagamento... A ativação é automática.</span>
      </div>

      {onManualVerify ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          sensoryIntent={false}
          disabled={isVerifyingManual}
          onClick={onManualVerify}
          className="w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {isVerifyingManual ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              <span>Consultando compensação...</span>
            </>
          ) : (
            <span>Já realizei o pagamento — Verificar agora</span>
          )}
        </Button>
      ) : null}

      {import.meta.env.DEV ? (
        <Button
          type="button"
          variant="positive"
          size="sm"
          sensoryIntent="success"
          onClick={onSimulateConfirmation}
          className="w-full gap-1.5 font-semibold"
        >
          <Zap className="size-3.5" aria-hidden="true" />
          <span>Simular Confirmação PIX (Ambiente de Teste)</span>
        </Button>
      ) : null}

      <div className="flex flex-col w-full gap-2 pt-2 border-t border-border/80">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSwitchToCard}
          className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <CreditCard className="size-3.5" aria-hidden="true" />
          <span>Pagar com cartão de crédito em vez de PIX</span>
        </Button>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBackToPlans}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Voltar aos planos</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onGoToDashboard}
            className="text-muted-foreground hover:text-foreground"
          >
            Ir para o painel
          </Button>
        </div>
      </div>
    </div>
  );
}
