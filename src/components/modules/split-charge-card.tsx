import { MessageSquareText, QrCode, Share2, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { calculateInstallmentsProgress } from "@/domain/finance/split-math";
import { todayLocalIso } from "@/lib/date";
import { cn } from "@/lib/utils";
import { SplitChargeHeader } from "./split-charge/split-charge-header";
import { SplitChargeInstallments } from "./split-charge/split-charge-installments";
import { SplitChargeParticipants } from "./split-charge/split-charge-participants";
import { SplitChargePixPanel } from "./split-charge/split-charge-pix-panel";
import type { SplitChargeCardProps, SplitParticipantView } from "./split-charge/split-charge-types";

export type { SplitChargeCardProps, SplitParticipantView };

/**
 * SplitChargeCard — Card canônico de Cobrança Compartilhada.
 *
 * Utilizado tanto no link público (/r/:token) quanto na visualização demonstrativa,
 * garantindo paridade visual absoluta e layout responsivo em 1 ou 2 colunas (`split-desktop`).
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
  customNote,
  showParticipantsList = true,
  isCurrentSettled = false,
  participantTotalShareCents,
  participantSettledCents = 0,
  isHostViewing = false,
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
  onSignalPayment,
  isSignalingPayment = false,
  hasSignaledCurrent = false,
  activeParticipantId,
  identityBanner,
  layout = "single-column",
  desktopExtraContent,
}: SplitChargeCardProps) {
  const effectiveGuestShareCents =
    guestShareCents ?? (peopleCount > 0 ? Math.round(totalCents / peopleCount) : totalCents);

  const hasInstallments = Boolean(installments && installments.length > 1);
  const installmentsProgress =
    hasInstallments && installments ? calculateInstallmentsProgress(installments) : null;
  const selectedInstallment =
    hasInstallments && installments
      ? installments.find((i) => i.id === selectedInstallmentId) ||
        installmentsProgress?.nextPendingInstallment ||
        installments[0] ||
        null
      : null;

  const effectiveChargeCents =
    hasInstallments && installmentsProgress
      ? isPayAllRemaining
        ? installmentsProgress.remainingCents
        : selectedInstallment?.amount_cents ?? effectiveGuestShareCents
      : effectiveGuestShareCents;

  const pixPanel = (
    <SplitChargePixPanel
      pixBoxTourId={pixBoxTourId}
      totalCents={totalCents}
      effectiveChargeCents={effectiveChargeCents}
      pixBrCode={pixBrCode}
      pixKey={pixKey}
      pixKeyType={pixKeyType}
      defaultShowQrCode={defaultShowQrCode}
      hasInstallments={hasInstallments}
      installmentsProgress={installmentsProgress}
      selectedInstallment={selectedInstallment}
      isPayAllRemaining={isPayAllRemaining}
      isCurrentSettled={isCurrentSettled}
      participantTotalShareCents={participantTotalShareCents}
      participantSettledCents={participantSettledCents}
      isHostViewing={isHostViewing}
      onCopyPix={onCopyPix}
      onCopyPixKey={onCopyPixKey}
      onSignalPayment={onSignalPayment}
      isSignalingPayment={isSignalingPayment}
      hasSignaledCurrent={hasSignaledCurrent}
    />
  );

  const noteBlock = customNote?.trim() ? (
    <div className="rounded-xl border border-border/80 bg-surface-raised/60 p-3 flex items-start gap-2.5 text-xs">
      <MessageSquareText className="size-4 text-portfolio shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-foreground leading-relaxed">{customNote.trim()}</p>
    </div>
  ) : null;

  const participantsBlock =
    showParticipantsList !== false ? (
      <SplitChargeParticipants
        participants={participants}
        hostName={hostName}
        activeParticipantId={activeParticipantId}
      />
    ) : null;

  const installmentsBlock =
    hasInstallments && installments && installmentsProgress ? (
      <SplitChargeInstallments
        installments={installments}
        progress={installmentsProgress}
        selectedInstallment={selectedInstallment}
        isPayAllRemaining={isPayAllRemaining}
        onSelectInstallmentId={onSelectInstallmentId}
        onTogglePayAllRemaining={onTogglePayAllRemaining}
      />
    ) : null;

  const shareBlock = onShareClick ? (
    <div className="pt-2 border-t border-border/80">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onShareClick}
        className="w-full gap-2 font-semibold text-xs"
      >
        <Share2 className="size-3.5 text-portfolio" aria-hidden="true" />
        <span>Compartilhar Link do Racha</span>
      </Button>
    </div>
  ) : null;

  if (layout === "split-desktop") {
    return (
      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-12 md:gap-6 items-start w-full space-y-4 md:space-y-0",
          className,
        )}
      >
        <div className="md:col-span-7 space-y-4">
          {identityBanner}

          <Card data-tour={cardTourId} className="border-border/80 bg-surface shadow-xs rounded-2xl">
            <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
              <SplitChargeHeader
                title={title}
                date={date}
                hostName={hostName}
                peopleCount={peopleCount}
                isDemo={isDemo}
              />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-5">
              {noteBlock}
              {participantsBlock}
              {installmentsBlock}
              {shareBlock}
            </CardContent>
          </Card>

          {desktopExtraContent && <div className="hidden md:block">{desktopExtraContent}</div>}
        </div>

        <div className="md:col-span-5 md:sticky md:top-20 space-y-4">
          <Card className="border-border/80 bg-surface shadow-xs rounded-2xl">
            <CardHeader className="p-4 sm:p-6 pb-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="default" size="xs" className="gap-1">
                  <QrCode className="size-3 text-muted-foreground" aria-hidden="true" />
                  <span>Pagamento Pix</span>
                </Badge>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
                  <span>BACEN EMV</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">{pixPanel}</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {identityBanner}
      <Card
        data-tour={cardTourId}
        className={cn("border-border/80 bg-surface shadow-xs rounded-2xl", className)}
      >
        <CardHeader className="p-4 sm:p-6 pb-4">
          <SplitChargeHeader
            title={title}
            date={date}
            hostName={hostName}
            peopleCount={peopleCount}
            isDemo={isDemo}
          />
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-5">
          {noteBlock}
          {pixPanel}
          {installmentsBlock}
          {participantsBlock}
          {shareBlock}
        </CardContent>
      </Card>
    </div>
  );
}
