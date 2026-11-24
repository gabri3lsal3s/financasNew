import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Receipt, ShieldCheck } from "lucide-react";
import { Card, EmptyState, Skeleton, buttonVariants } from "@/components/ui";
import { SplitChargeCard } from "@/components/modules";
import { sanitizeShareToken } from "@/domain/share/token";
import { cn } from "@/lib/utils";
import {
  PublicSplitIdentityBanner,
  SelectParticipantDialog,
  SelectSplitCategoryDialog,
  SharedLinkHeaderNav,
  SplitOnboardingModal,
} from "../components";
import { SplitConversionBanner } from "../components/split-conversion-banner";
import { usePublicSplitPage } from "../hooks/use-public-split-page";

export function SplitPublicPage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const token = sanitizeShareToken(rawToken);
  const navigate = useNavigate();
  const state = usePublicSplitPage(token, rawToken);

  const isPaused = Boolean(state.payload?.public_page_paused);
  const isUnavailable =
    Boolean(state.error) ||
    !state.share ||
    state.share.is_revoked ||
    state.share.kind !== "split" ||
    !state.payload ||
    Boolean(state.payload.is_completed) ||
    isPaused;

  const hasSignaledCurrent = Boolean(
    state.isPayAllRemaining
      ? state.participantInstallments
          .filter((i) => !i.is_settled)
          .some((i) => state.justSignaledInstallmentIds.has(i.id) || i.signal_status === "pending_confirmation")
      : (state.selectedInstallment?.id &&
          state.justSignaledInstallmentIds.has(state.selectedInstallment.id)) ||
          state.selectedInstallment?.signal_status === "pending_confirmation" ||
          (!state.participantInstallments.length &&
            state.currentParticipant?.has_payment_signal),
  );

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col justify-between pb-8">
      <SharedLinkHeaderNav
        badgeLabel="Racha de Conta"
        targetPath={`r/${token || ""}`}
        maxWidth="5xl"
      />

      <main className="w-full max-w-md md:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 flex-1 space-y-6">
        {state.isLoading ? (
          <Card className="border-border/80 bg-surface shadow-xs p-5 sm:p-6 space-y-4 rounded-2xl">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </Card>
        ) : isUnavailable || !state.payload ? (
          <EmptyState
            icon={<Receipt className="size-8 text-muted-foreground" aria-hidden="true" />}
            title="Racha não encontrado ou expirado"
            description="Este link de compartilhamento não está mais disponível, foi revogado pelo organizador ou o endereço acessado está incorreto."
            action={
              <Link
                to="/apresentacao"
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
              >
                <span>Conhecer o Axir</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          />
        ) : (
          <div className="space-y-5">
            <SplitChargeCard
              layout="split-desktop"
              title={state.payload.title || "Racha de Despesa"}
              date={state.payload.date}
              hostName={state.payload.host_name || "Anfitrião"}
              peopleCount={state.payload.people_count}
              totalCents={state.payload.total_cents}
              guestShareCents={state.effectiveChargeCents}
              pixBrCode={state.dynamicPixBrCode}
              pixKey={state.payload.pix_key}
              pixKeyType={state.payload.pix_key_type}
              participants={state.normalizedParticipants}
              customNote={state.payload.custom_note}
              showParticipantsList={state.payload.show_participants_list}
              isCurrentSettled={state.isCurrentParticipantSettled}
              participantTotalShareCents={state.participantTotalShareCents}
              participantSettledCents={state.participantSettledCents}
              isHostViewing={state.isHostViewing}
              activeParticipantId={state.currentParticipant?.id}
              identityBanner={
                <PublicSplitIdentityBanner
                  token={token || ""}
                  participants={state.normalizedParticipants}
                  hostName={state.payload.host_name || "Anfitrião"}
                  activeParticipantId={state.currentParticipant?.id}
                  onSelectParticipant={state.selectParticipantFromBanner}
                  isHostPreview={state.isHostViewing}
                />
              }
              installmentsCount={state.payload.installments_count}
              installments={state.participantInstallments}
              selectedInstallmentId={state.selectedInstallment?.id ?? null}
              onSelectInstallmentId={(id) => {
                state.setIsPayAllRemaining(false);
                state.setSelectedInstallmentId(id);
              }}
              isPayAllRemaining={state.isPayAllRemaining}
              onTogglePayAllRemaining={() => state.setIsPayAllRemaining((prev) => !prev)}
              onSignalPayment={state.handleSignalPixPayment}
              isSignalingPayment={state.isSignalingDirectly}
              hasSignaledCurrent={hasSignaledCurrent}
            />

            <div className="pt-2">
              <SplitConversionBanner
                isSavingDirectly={state.isSavingDirectly}
                onLearnMore={() => navigate("/")}
                onSaveExpense={state.handleSaveExpenseClick}
              />
            </div>

            <SplitOnboardingModal
              open={state.isOnboardingModalOpen}
              onOpenChange={state.setIsOnboardingModalOpen}
              guestShareCents={state.effectiveChargeCents}
              title={state.payload.title}
              date={state.payload.date}
              token={token || ""}
            />

            <SelectSplitCategoryDialog
              open={state.isSelectCategoryOpen}
              onOpenChange={state.setIsSelectCategoryOpen}
              title={state.payload.title}
              amountCents={state.effectiveChargeCents}
              sentCategoryName={state.payload.category_name}
              categories={state.categories}
              isPending={state.isSavingDirectly}
              onConfirm={state.handleConfirmCategorySave}
            />

            <SelectParticipantDialog
              open={state.isSelectParticipantOpen}
              onOpenChange={state.setIsSelectParticipantOpen}
              participants={state.normalizedParticipants.filter((p) => !p.is_host && !p.is_settled)}
              isPending={state.isSavingDirectly}
              onConfirm={state.handleConfirmParticipant}
            />
          </div>
        )}
      </main>

      <footer className="w-full max-w-md md:max-w-5xl mx-auto pt-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
          <span>Ambiente Seguro · Padrão BACEN EMV QRCPS</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Estruturado via{" "}
          <Link to="/apresentacao" className="text-primary-strong hover:underline font-medium">
            Axir
          </Link>{" "}
          · Gestão Financeira Pessoal &amp; Automação
        </p>
      </footer>
    </div>
  );
}
