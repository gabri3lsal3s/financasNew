import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { UpgradeDialog } from "@/components/modules/subscription/upgrade-dialog";
import { calculateGuaranteeResidual } from "@/domain/subscription";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import {
  useCancelScheduledPlanChangeMutation,
  useCancelSubscriptionMutation,
  useUpgradeToAnnualMutation,
  useUserSubscription,
} from "@/state";
import type { SubscriptionPlan } from "@/types";
import { CancelSubscriptionWizardModal } from "../subscription/cancel-subscription-wizard-modal";
import { CancellationCard } from "../subscription/cancellation-card";
import { CumulativeRenewalCard } from "../subscription/cumulative-renewal-card";
import { CurrentPlanHeroCard } from "../subscription/current-plan-hero-card";
import { InvoiceHistoryCard } from "../subscription/invoice-history-card";
import { PaymentMethodCard } from "../subscription/payment-method-card";
import { PlanComparisonCard } from "../subscription/plan-comparison-card";
import { UpdateCardModal } from "../subscription/update-card-modal";

export function SubscriptionTab() {
  const navigate = useNavigate();
  const subscription = useUserSubscription();

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("too_expensive");
  const [cancelStep, setCancelStep] = useState<"reason" | "confirm">("reason");
  const [updateCardOpen, setUpdateCardOpen] = useState(false);

  const { isWithinGuarantee, daysRemaining: guaranteeDaysRemaining } = useMemo(
    () =>
      calculateGuaranteeResidual({
        startsAt: subscription.billingStartAt || subscription.startsAt,
        isPro: subscription.isPro,
      }),
    [subscription.billingStartAt, subscription.startsAt, subscription.isPro],
  );

  const currentPeriodFormatted = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const cancelMutation = useCancelSubscriptionMutation();
  const upgradeMutation = useUpgradeToAnnualMutation();
  const cancelScheduledPlanMutation = useCancelScheduledPlanChangeMutation();

  const handleUpgradeToAnnual = async () => {
    try {
      await upgradeMutation.mutateAsync();
    } catch {
      // Erro tratado pela mutation
    }
  };

  const handleProceedToCheckout = (plan: SubscriptionPlan) => {
    setUpgradeOpen(false);
    navigate(buildCheckoutUrl({ plan }));
  };

  const handleCancelConfirm = async () => {
    try {
      await cancelMutation.mutateAsync();
      setCancelOpen(false);
      setCancelStep("reason");
    } catch {
      // Erro tratado pela mutation
    }
  };

  return (
    <div className="space-y-6">
      <CurrentPlanHeroCard
        subscription={subscription}
        onUpgrade={() => setUpgradeOpen(true)}
      />

      <PaymentMethodCard
        subscription={subscription}
        isCancelingPlanChange={cancelScheduledPlanMutation.isPending}
        onOpenUpdateCard={() => setUpdateCardOpen(true)}
        onCancelScheduledPlanChange={() => {
          void cancelScheduledPlanMutation.mutateAsync();
        }}
      />

      {subscription.isPro && subscription.plan === "monthly" && !subscription.pendingPlanId ? (
        <CumulativeRenewalCard
          currentPeriodEnd={subscription.currentPeriodEnd}
          onUpgradeToAnnual={() => {
            void handleUpgradeToAnnual();
          }}
        />
      ) : null}

      <InvoiceHistoryCard subscription={subscription} />

      <PlanComparisonCard
        isFullAccess={subscription.isFullAccess}
        showUpgradeCta={!subscription.isPro && !subscription.hasAutoRenew}
        onUpgrade={() => setUpgradeOpen(true)}
      />

      {(subscription.isPro || subscription.hasAutoRenew) ? (
        <CancellationCard
          cancelAtPeriodEnd={Boolean(subscription.cancelAtPeriodEnd)}
          isWithinGuarantee={isWithinGuarantee}
          guaranteeDaysRemaining={guaranteeDaysRemaining}
          currentPeriodFormatted={currentPeriodFormatted}
          isPending={cancelMutation.isPending}
          onOpenCancelWizard={() => setCancelOpen(true)}
        />
      ) : null}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onProceedToCheckout={handleProceedToCheckout}
      />

      <CancelSubscriptionWizardModal
        open={cancelOpen}
        step={cancelStep}
        reason={cancelReason}
        isWithinGuarantee={isWithinGuarantee}
        isTrialScheduled={subscription.billingPhase === "trial_scheduled" || (Boolean(subscription.isTrial) && Boolean(subscription.hasCardRegistered) && !subscription.billingStartAt)}
        trialEndsFormatted={subscription.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleDateString("pt-BR") : null}
        currentPeriodFormatted={currentPeriodFormatted}
        isPending={cancelMutation.isPending}
        onOpenChange={(open) => {
          setCancelOpen(open);
          if (!open) setCancelStep("reason");
        }}
        onStepChange={setCancelStep}
        onReasonChange={setCancelReason}
        onConfirm={() => {
          void handleCancelConfirm();
        }}
      />

      <UpdateCardModal open={updateCardOpen} onOpenChange={setUpdateCardOpen} />
    </div>
  );
}
