import { useEffect, useRef, useState } from "react";
import { Check, Clock, Copy, QrCode } from "lucide-react";
import { Button, MoneyText } from "@/components/ui";
import type { InstallmentsProgressSummary } from "@/domain/finance/split-math";
import { formatCentsAsCurrency } from "@/services/masks";
import { formatDateBR } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import type { SplitParticipantInstallment } from "@/types";
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
  onCopyPix?: () => void;
  onCopyPixKey?: () => void;
  onSignalPayment?: () => void;
  isSignalingPayment?: boolean;
  hasSignaledCurrent?: boolean;
}

/**
 * Painel hero de pagamento Pix (valor da cota, botão Copia e Cola, sinalização e toggle QR).
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
  onCopyPix,
  onCopyPixKey,
  onSignalPayment,
  isSignalingPayment = false,
  hasSignaledCurrent = false,
}: SplitChargePixPanelProps) {
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showQrCode, setShowQrCode] = useState(defaultShowQrCode);
  const pixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pixTimerRef.current) clearTimeout(pixTimerRef.current);
      if (keyTimerRef.current) clearTimeout(keyTimerRef.current);
    };
  }, []);

  const handleCopyPix = async () => {
    if (onCopyPix) {
      triggerSensory("action");
      onCopyPix();
      return;
    }
    const codeToCopy = pixBrCode || pixKey;
    if (!codeToCopy) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codeToCopy);
        setCopiedPix(true);
        triggerSensory("success");
        pushToast({
          title: "Código Pix copiado!",
          description: "Abra o aplicativo do seu banco para colar e pagar.",
          variant: "success",
        });
        if (pixTimerRef.current) clearTimeout(pixTimerRef.current);
        pixTimerRef.current = setTimeout(() => setCopiedPix(false), 3000);
      }
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível copiar automaticamente.",
        description: "Selecione e copie o código Pix manualmente.",
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
    if (!pixKey) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pixKey);
        setCopiedKey(true);
        triggerSensory("success");
        pushToast({
          title: "Chave Pix copiada!",
          description: "Chave direta copiada para a área de transferência.",
          variant: "default",
        });
        if (keyTimerRef.current) clearTimeout(keyTimerRef.current);
        keyTimerRef.current = setTimeout(() => setCopiedKey(false), 3000);
      }
    } catch {
      triggerSensory("destructive");
      pushToast({ title: "Não foi possível copiar a chave.", variant: "destructive" });
    }
  };

  const heroSubtitle =
    hasInstallments && selectedInstallment && !isPayAllRemaining
      ? `Vencimento da fatura: ${formatDateBR(selectedInstallment.due_date)} · Total do racha: ${formatCentsAsCurrency(totalCents)}`
      : `Valor total da conta: ${formatCentsAsCurrency(totalCents)}`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-center space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
          {hasInstallments && selectedInstallment
            ? isPayAllRemaining
              ? `Total Restante (${installmentsProgress?.pendingCount} parcelas)`
              : `Sua parte a pagar — Parcela ${selectedInstallment.installment_number} de ${selectedInstallment.total_installments}`
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
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          variant="default"
          size="lg"
          sensoryIntent={false}
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

        {onSignalPayment && (
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
                    ? "Enviando aviso…"
                    : hasInstallments && selectedInstallment && !isPayAllRemaining
                      ? `Já fiz o Pix da Parcela ${selectedInstallment.installment_number}`
                      : "Já fiz o Pix"}
                </span>
              </>
            )}
          </Button>
        )}

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
      </div>
    </div>
  );
}
