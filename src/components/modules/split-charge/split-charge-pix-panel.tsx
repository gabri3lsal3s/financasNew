import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Clock, Copy, QrCode } from "lucide-react";
import { Button, Input, MoneyText } from "@/components/ui";
import type { InstallmentsProgressSummary } from "@/domain/finance/split-math";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/services/export-actions";
import { formatCentsAsCurrency } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { SplitParticipantInstallment } from "@/types";
import { PixTroubleshootAccordion } from "../pix-troubleshoot-accordion";
import { SplitChargeQrBox } from "./split-charge-qr-box";

export interface SplitChargePixPanelProps {
  pixBoxTourId?: string;
  totalCents: number;
  effectiveChargeCents: number;
  pixBrCode?: string;
  pixKey?: string;
  pixKeyType?: string;
  defaultShowQrCode?: boolean;
  hasInstallments: boolean;
  installmentsProgress: InstallmentsProgressSummary | null;
  selectedInstallment: SplitParticipantInstallment | null;
  isPayAllRemaining: boolean;
  isCurrentSettled?: boolean;
  participantTotalShareCents?: number;
  participantSettledCents?: number;
  isHostViewing?: boolean;
  onCopyPix?: () => void;
  onCopyPixKey?: () => void;
  onSignalPayment?: () => void;
  isSignalingPayment?: boolean;
  hasSignaledCurrent?: boolean;
}

/**
 * Painel hero de pagamento Pix (valor exato restante, Copia e Cola resiliente, sinalização e QR SVG).
 */
export function SplitChargePixPanel({
  pixBoxTourId,
  totalCents,
  effectiveChargeCents,
  pixBrCode,
  pixKey,
  pixKeyType = "E-mail",
  defaultShowQrCode = false,
  hasInstallments,
  installmentsProgress,
  selectedInstallment,
  isPayAllRemaining,
  isCurrentSettled = false,
  participantTotalShareCents,
  participantSettledCents = 0,
  isHostViewing = false,
  onCopyPix,
  onCopyPixKey,
  onSignalPayment,
  isSignalingPayment = false,
  hasSignaledCurrent = false,
}: SplitChargePixPanelProps) {
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showQrCode, setShowQrCode] = useState(defaultShowQrCode);
  const [manualCopyCode, setManualCopyCode] = useState<string | null>(null);
  const pixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pixTimerRef.current) clearTimeout(pixTimerRef.current);
      if (keyTimerRef.current) clearTimeout(keyTimerRef.current);
    };
  }, []);

  if (isCurrentSettled) {
    return (
      <div className="rounded-xl border border-positive/30 bg-positive/10 p-5 text-center space-y-2.5">
        <div className="flex justify-center">
          <CheckCircle2 className="size-8 text-positive-strong" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          Sua parte já foi confirmada pelo anfitrião
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Não há saldo pendente para pagamento neste racha.
        </p>
        {participantTotalShareCents !== undefined && participantTotalShareCents > 0 ? (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-positive/20 bg-surface px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">Valor quitado:</span>
            <MoneyText cents={participantSettledCents || participantTotalShareCents} tone="positive" variant="caption" className="font-semibold" />
          </div>
        ) : null}
      </div>
    );
  }

  const handleCopyPix = async () => {
    if (onCopyPix) {
      triggerSensory("action");
      onCopyPix();
      return;
    }
    const codeToCopy = (pixBrCode || pixKey)?.trim();
    if (!codeToCopy) return;
    const copied = await copyTextToClipboard(codeToCopy);
    if (copied) {
      setManualCopyCode(null);
      setCopiedPix(true);
      triggerSensory("success");
      pushToast({
        title: "Código Pix copiado!",
        description: "Abra o aplicativo do seu banco para colar e pagar.",
        variant: "success",
      });
      if (pixTimerRef.current) clearTimeout(pixTimerRef.current);
      pixTimerRef.current = setTimeout(() => setCopiedPix(false), 3000);
    } else {
      setManualCopyCode(codeToCopy);
      triggerSensory("destructive");
      pushToast({
        title: "Copie o código abaixo manualmente.",
        description: "Este navegador restringiu a cópia automática. Toque no campo abaixo para selecionar.",
        variant: "destructive",
      });
    }
  };

  const handleCopyPixKey = async () => {
    if (onCopyPixKey) {
      triggerSensory("action");
      onCopyPixKey();
      return;
    }
    const cleanKey = pixKey?.trim();
    if (!cleanKey) return;
    const copied = await copyTextToClipboard(cleanKey);
    if (copied) {
      setManualCopyCode(null);
      setCopiedKey(true);
      triggerSensory("success");
      pushToast({
        title: "Chave Pix copiada!",
        description: "Chave direta copiada para a área de transferência.",
        variant: "default",
      });
      if (keyTimerRef.current) clearTimeout(keyTimerRef.current);
      keyTimerRef.current = setTimeout(() => setCopiedKey(false), 3000);
    } else {
      setManualCopyCode(cleanKey);
      triggerSensory("destructive");
      pushToast({ title: "Não foi possível copiar a chave automaticamente.", variant: "destructive" });
    }
  };

  const showPartialBreakdown =
    !hasInstallments &&
    participantSettledCents > 0 &&
    participantTotalShareCents !== undefined &&
    participantTotalShareCents > participantSettledCents;

  const heroSubtitle =
    hasInstallments && selectedInstallment && !isPayAllRemaining
      ? `Vencimento da fatura: ${formatDateBR(selectedInstallment.due_date)} · Total do racha: ${formatCentsAsCurrency(totalCents)}`
      : `Valor total da conta: ${formatCentsAsCurrency(totalCents)}`;

  const hasValidCopyTarget = Boolean(pixBrCode || pixKey);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-center space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
          {hasInstallments && selectedInstallment
            ? isPayAllRemaining
              ? `Total Restante (${installmentsProgress?.pendingCount} parcelas)`
              : `Sua parte a pagar — Parcela ${selectedInstallment.installment_number} de ${selectedInstallment.total_installments}`
            : showPartialBreakdown
              ? "Saldo restante a pagar"
              : "Sua parte a pagar"}
        </span>
        <div className="tabular-nums font-bold text-foreground tracking-tight whitespace-nowrap">
          <MoneyText
            cents={effectiveChargeCents}
            variant="hero"
            tone="default"
            className="text-3xl sm:text-4xl font-bold"
          />
        </div>
        <span className="num text-xs text-muted-foreground block">{heroSubtitle}</span>
        {showPartialBreakdown && participantTotalShareCents !== undefined ? (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1.5 text-[11px] text-muted-foreground">
            <span>
              Total da cota: <strong className="text-foreground">{formatCentsAsCurrency(participantTotalShareCents)}</strong>
            </span>
            <span>
              Já pago: <strong className="text-positive-strong">{formatCentsAsCurrency(participantSettledCents)}</strong>
            </span>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          variant="default"
          size="lg"
          sensoryIntent={false}
          disabled={!hasValidCopyTarget}
          className="w-full gap-2 text-base font-semibold shadow-sm"
          onClick={handleCopyPix}
          aria-label={`Copiar código Pix no valor de ${formatCentsAsCurrency(effectiveChargeCents)}`}
        >
          {copiedPix ? (
            <>
              <Check className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
              <span>Código Pix Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="size-5 shrink-0" aria-hidden="true" />
              <span className="num whitespace-nowrap">
                Copiar Pix — {formatCentsAsCurrency(effectiveChargeCents)}
              </span>
            </>
          )}
        </Button>

        {manualCopyCode ? (
          <div className="rounded-lg border border-border/80 bg-surface p-2.5 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Toque no código abaixo para selecionar e copiar manualmente:
            </span>
            <Input
              readOnly
              value={manualCopyCode}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Código Pix para cópia manual"
              className="font-mono text-xs"
            />
          </div>
        ) : null}

        {onSignalPayment && !isHostViewing ? (
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={isSignalingPayment || hasSignaledCurrent}
            onClick={onSignalPayment}
            className={cn(
              "w-full gap-2 font-semibold text-xs sm:text-sm transition-colors",
              hasSignaledCurrent
                ? "bg-warning/10 border-warning/30 text-warning-strong hover:bg-warning/15"
                : "text-foreground",
            )}
            sensoryIntent="action"
            aria-label="Avisar ao anfitrião que você já realizou o pagamento via Pix"
          >
            {hasSignaledCurrent ? (
              <>
                <Clock className="size-4 text-warning-strong shrink-0" aria-hidden="true" />
                <span>Aviso enviado ao anfitrião (em conferência)</span>
              </>
            ) : (
              <>
                <Check className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
                <span>
                  {isSignalingPayment
                    ? "Enviando aviso..."
                    : isPayAllRemaining
                      ? "Já fiz o Pix de todas as pendentes"
                      : hasInstallments && selectedInstallment
                        ? `Já fiz o Pix da Parcela ${selectedInstallment.installment_number}`
                        : "Já fiz o Pix"}
                </span>
              </>
            )}
          </Button>
        ) : isHostViewing ? (
          <p className="text-[11px] text-center text-muted-foreground">
            Prévia do anfitrião: botão de aviso habilitado apenas para convidados.
          </p>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          sensoryIntent="selection"
          onClick={() => setShowQrCode((prev) => !prev)}
          className="w-full gap-2"
          aria-expanded={showQrCode}
          aria-label={showQrCode ? "Ocultar QR Code" : "Exibir QR Code Pix"}
        >
          <QrCode className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{showQrCode ? "Ocultar QR Code" : "Exibir QR Code Pix"}</span>
        </Button>

        {showQrCode && (
          <SplitChargeQrBox
            pixBoxTourId={pixBoxTourId}
            pixBrCode={pixBrCode}
            pixKey={pixKey}
            pixKeyType={pixKeyType}
            copiedKey={copiedKey}
            onCopyPixKey={handleCopyPixKey}
          />
        )}

        {hasValidCopyTarget ? (
          <PixTroubleshootAccordion
            pixBrCode={pixBrCode}
            pixKey={pixKey}
            pixKeyType={pixKeyType}
            onCopyPixKey={pixKey ? () => void handleCopyPixKey() : undefined}
          />
        ) : null}
      </div>
    </div>
  );
}
