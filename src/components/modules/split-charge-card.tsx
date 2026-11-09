import { useState } from "react";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  CreditCard,
  QrCode,
  Receipt,
  Share2,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  MoneyText,
  QrCodeCanvas,
} from "@/components/ui";
import { formatCentsAsCurrency } from "@/services/masks";
import { formatDateBR, todayLocalIso } from "@/lib/date";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { calculateInstallmentsProgress } from "@/domain/finance/split-math";
import type { SplitParticipantInstallment } from "@/types";
import { cn } from "@/lib/utils";

export interface SplitParticipantView {
  name: string;
  is_host?: boolean;
  share_cents: number;
}

export interface SplitChargeCardProps {
  className?: string;
  cardTourId?: string;
  pixBoxTourId?: string;
  title: string;
  date?: string;
  hostName: string;
  peopleCount: number;
  totalCents: number;
  guestShareCents?: number;
  pixBrCode?: string;
  pixKey?: string;
  pixKeyType?: string;
  participants?: SplitParticipantView[];
  isDemo?: boolean;
  defaultShowQrCode?: boolean;
  onCopyPix?: () => void;
  onCopyPixKey?: () => void;
  onShareClick?: () => void;
  installmentsCount?: number;
  installments?: SplitParticipantInstallment[];
  selectedInstallmentId?: string | null;
  onSelectInstallmentId?: (id: string | null) => void;
  isPayAllRemaining?: boolean;
  onTogglePayAllRemaining?: () => void;
}

/**
 * SplitChargeCard — Card canônico de Cobrança Compartilhada (§Plano 11).
 *
 * Utilizado tanto na visualização pública acessada pelo link de compartilhamento
 * (/r/:token) quanto na visualização didática/demonstrativa dentro do sistema,
 * garantindo paridade visual absoluta e eliminação de duplicação de regras (DRY).
 */
export function SplitChargeCard({
  className,
  cardTourId,
  pixBoxTourId,
  title,
  date = todayLocalIso(),
  hostName,
  peopleCount,
  totalCents,
  guestShareCents,
  pixBrCode,
  pixKey,
  pixKeyType = "E-mail",
  participants,
  isDemo = false,
  defaultShowQrCode = false,
  installments,
  selectedInstallmentId,
  onSelectInstallmentId,
  isPayAllRemaining = false,
  onTogglePayAllRemaining,
  onCopyPix,
  onCopyPixKey,
  onShareClick,
}: SplitChargeCardProps) {
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showQrCode, setShowQrCode] = useState(defaultShowQrCode);

  const effectiveGuestShareCents =
    guestShareCents ??
    (peopleCount > 0 ? Math.round(totalCents / peopleCount) : totalCents);

  const hasInstallments = Boolean(installments && installments.length > 1);
  const installmentsProgress = hasInstallments && installments ? calculateInstallmentsProgress(installments) : null;
  const selectedInstallment =
    hasInstallments && installments
      ? installments.find((i) => i.id === selectedInstallmentId) || installmentsProgress?.nextPendingInstallment || installments[0]
      : null;

  const effectiveChargeCents = hasInstallments && installmentsProgress
    ? isPayAllRemaining
      ? installmentsProgress.remainingCents
      : selectedInstallment?.amount_cents ?? effectiveGuestShareCents
    : effectiveGuestShareCents;

  const handleCopyPix = async () => {
    if (onCopyPix) {
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
        setTimeout(() => setCopiedPix(false), 3000);
      }
    } catch {
      pushToast({
        title: "Não foi possível copiar automaticamente.",
        description: "Selecione e copie o código Pix manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleCopyPixKey = async () => {
    if (onCopyPixKey) {
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
        setTimeout(() => setCopiedKey(false), 3000);
      }
    } catch {
      pushToast({
        title: "Não foi possível copiar a chave.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card
      data-tour={cardTourId}
      className={cn("border-border/80 bg-surface shadow-xs", className)}
    >
      <CardHeader className="p-5 sm:p-6 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="default" size="xs" className="gap-1">
              <Receipt className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Despesa Compartilhada</span>
            </Badge>
            {isDemo && (
              <Badge
                variant="muted"
                size="xs"
                className="gap-1 bg-surface-hover/40 border border-border/70 text-muted-foreground shrink-0"
              >
                <Sparkles className="size-3 text-portfolio" aria-hidden="true" />
                <span>Exemplo Demonstrativo</span>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>{formatDateBR(date)}</span>
          </div>
        </div>

        <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-2">
          {title || "Racha de Despesa"}
        </CardTitle>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
          <div className="flex items-center gap-1.5">
            <User className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>
              Por: <strong className="font-semibold text-foreground">{hostName || "Anfitrião"}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>{peopleCount} participantes</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
        {/* Bloco Hero: Sua Parte a Pagar */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-center space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            {hasInstallments && selectedInstallment
              ? isPayAllRemaining
                ? `Total Restante (${installmentsProgress?.pendingCount} parcelas)`
                : `Sua parte a pagar — Parcela ${selectedInstallment.installment_number} de ${selectedInstallment.total_installments}`
              : "Sua parte a pagar"}
          </span>
          <div className="tabular-nums font-bold text-foreground text-3xl sm:text-4xl tracking-tight whitespace-nowrap">
            <MoneyText cents={effectiveChargeCents} variant="hero" />
          </div>
          <span className="text-xs text-muted-foreground block">
            {hasInstallments && selectedInstallment && !isPayAllRemaining
              ? `Vencimento da fatura: ${formatDateBR(selectedInstallment.due_date)} • Total do racha: ${formatCentsAsCurrency(totalCents)}`
              : `Valor total da conta: ${formatCentsAsCurrency(totalCents)}`}
          </span>
        </div>

        {/* Grade de Seleção de Parcelas (Quando Despesa for Parcelada) */}
        {hasInstallments && installments && installmentsProgress && (
          <div className="space-y-2 pt-1 border-t border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs font-semibold text-foreground">
                  Parcelas ({installmentsProgress.settledCount}/{installmentsProgress.totalCount} pagas)
                </span>
              </div>
              {installmentsProgress.pendingCount > 1 && onTogglePayAllRemaining && (
                <button
                  type="button"
                  onClick={onTogglePayAllRemaining}
                  className={cn(
                    "text-[11px] font-medium transition-colors hover:underline cursor-pointer",
                    isPayAllRemaining ? "text-primary font-semibold" : "text-muted-foreground"
                  )}
                >
                  {isPayAllRemaining ? "Pagar uma a uma" : "Quitar todas pendentes"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {installments.map((inst) => {
                const isSelected = !isPayAllRemaining && selectedInstallment?.id === inst.id;
                const isSettled = inst.is_settled;
                const isSignaled = inst.signal_status === "pending_confirmation";

                return (
                  <button
                    key={inst.id}
                    type="button"
                    disabled={isSettled}
                    onClick={() => {
                      if (!isSettled && onSelectInstallmentId) {
                        onSelectInstallmentId(inst.id);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border text-left transition-all",
                      isSettled
                        ? "bg-surface-hover/30 border-border/40 opacity-70 cursor-default"
                        : isSelected
                          ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30 cursor-pointer shadow-xs"
                          : "bg-surface border-border/70 hover:border-border hover:bg-surface-hover/50 cursor-pointer"
                    )}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          Parcela {inst.installment_number}/{inst.total_installments}
                        </span>
                        {isSettled ? (
                          <Badge variant="positive" size="xs" className="gap-1">
                            <Check className="size-2.5" aria-hidden="true" />
                            <span>Paga</span>
                          </Badge>
                        ) : isSignaled ? (
                          <Badge variant="warning" size="xs" className="gap-1">
                            <Clock className="size-2.5" aria-hidden="true" />
                            <span>Em conferência</span>
                          </Badge>
                        ) : isSelected ? (
                          <Badge variant="default" size="xs">
                            Selecionada
                          </Badge>
                        ) : (
                          <Badge variant="muted" size="xs">
                            Pendente
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Vencimento: {formatDateBR(inst.due_date)}
                      </span>
                    </div>

                    <div className="text-right tabular-nums">
                      <span className="text-xs font-bold text-foreground">
                        {formatCentsAsCurrency(inst.amount_cents)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Botão de Um Toque: Copiar Pix com Valor Embutido */}
        <Button
          type="button"
          variant="default"
          size="lg"
          className="w-full gap-2 text-base font-semibold shadow-sm cursor-pointer"
          onClick={handleCopyPix}
          sensoryIntent="success"
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
              <span>Copiar Pix — {formatCentsAsCurrency(effectiveChargeCents)}</span>
            </>
          )}
        </Button>

        {/* Toggle Opcional: QR Code Pix Canvas Client-Side */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowQrCode((prev) => !prev)}
          className="w-full gap-2 border-border/80 bg-surface cursor-pointer"
          aria-expanded={showQrCode}
          aria-label={showQrCode ? "Ocultar QR Code" : "Exibir QR Code Pix"}
        >
          <QrCode className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{showQrCode ? "Ocultar QR Code" : "Exibir QR Code Pix"}</span>
        </Button>

        {/* Bloco Condicional de QR Code em Canvas */}
        {showQrCode && (
          <div
            data-tour={pixBoxTourId}
            className="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col items-center gap-3 text-center"
          >
            <p className="text-xs text-muted-foreground">
              Abra o app do seu banco, escolha <strong>Pagar com QR Code</strong> e aponte para a tela:
            </p>
            {pixBrCode ? (
              <QrCodeCanvas
                text={pixBrCode}
                size={180}
                label="Código QR Pix oficial"
              />
            ) : (
              <div className="flex size-36 sm:size-44 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background/80 shadow-2xs">
                <QrCode className="size-24 sm:size-28 text-foreground/80" aria-hidden="true" />
              </div>
            )}
            <div className="w-full pt-2 border-t border-border/60 flex flex-col items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">
                Chave Pix ({pixKeyType || "cadastrada"}):
              </span>
              <div className="flex items-center gap-2 max-w-full">
                <code className="text-xs font-mono bg-surface px-2 py-1 rounded border border-border/60 text-foreground truncate max-w-[160px] sm:max-w-[240px]">
                  {pixKey}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleCopyPixKey}
                  className="gap-1 border-border/80 bg-surface cursor-pointer shrink-0"
                  aria-label="Copiar chave Pix diretamente"
                >
                  {copiedKey ? (
                    <Check className="size-3 text-positive-strong" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span>{copiedKey ? "Copiada" : "Copiar"}</span>
                </Button>
              </div>
              <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <ShieldCheck className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
                <span>Dados protegidos e sem cobrança de taxas</span>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Participantes (se discriminados) */}
        {participants && participants.length > 0 && (
          <div className="pt-2 border-t border-border/60 space-y-2">
            <span className="text-xs font-semibold text-muted-foreground block">
              Divisão entre os participantes
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
              {participants.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-background/40 border border-border/40"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-foreground truncate font-medium">
                      {item.name}
                    </span>
                    {item.is_host && (
                      <Badge variant="muted" size="xs">
                        Anfitrião
                      </Badge>
                    )}
                  </div>
                  <span className="tabular-nums font-semibold text-foreground shrink-0 ml-2">
                    {formatCentsAsCurrency(item.share_cents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ação opcional de compartilhamento de link */}
        {onShareClick && (
          <div className="pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onShareClick}
              className="w-full gap-2 border-border/80 bg-surface font-semibold text-xs cursor-pointer"
            >
              <Share2 className="size-3.5 text-portfolio" aria-hidden="true" />
              <span>Compartilhar Link do Racha</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
