import { ArrowRight, HandCoins, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import { MoneyText } from "@/components/ui/money-text";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";

export interface HouseholdAlertBannerProps {
  variant: "ceiling_exceeded" | "ceiling_warning" | "settlement_pending";
  month?: string;
  totalSpentCents?: number;
  ceilingCents?: number;
  spentPercentage?: number;
  settlementAmountCents?: number;
  settlementPayerName?: string;
  settlementReceiverName?: string;
  isCurrentUserPayer?: boolean;
  isCurrentUserReceiver?: boolean;
  daysRemaining?: number;
  onDismiss?: (days: 7 | 30) => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
  className?: string;
}

export function HouseholdAlertBanner({
  variant,
  month,
  totalSpentCents = 0,
  ceilingCents = 0,
  spentPercentage = 0,
  settlementAmountCents = 0,
  settlementPayerName,
  settlementReceiverName,
  isCurrentUserPayer,
  isCurrentUserReceiver,
  daysRemaining,
  onDismiss,
  onSelectPreset,
  className,
}: HouseholdAlertBannerProps) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    const query = month ? `?mes=${encodeURIComponent(month)}` : "";
    navigate(`/familia${query}`);
  };

  const isExceeded = variant === "ceiling_exceeded";
  const isWarning = variant === "ceiling_warning";
  const isSettlement = variant === "settlement_pending";
  const cardKey = isSettlement
    ? "household.settlement_pending"
    : "household.ceiling_exceeded";
  const policy = resolveCarouselCardPolicy(cardKey);

  const title = isSettlement
    ? "Acerto Familiar Pendente"
    : isExceeded
      ? "Teto Familiar Estourado"
      : "Atenção ao Teto Familiar";

  return (
    <AlertCarouselCard
      id={cardKey}
      tone={isExceeded ? "critical" : isWarning ? "warning" : "info"}
      role="region"
      ariaLabel={
        isSettlement ? "Alerta de Acerto Familiar" : "Alerta de Teto Familiar"
      }
      className={className}
      icon={
        isSettlement ? (
          <HandCoins className="size-4.5" />
        ) : (
          <Users className="size-4.5" />
        )
      }
      title={title}
      badge={{
        label: isSettlement ? "Pix" : `${spentPercentage}% do teto`,
        variant: isExceeded ? "critical" : isWarning ? "warning" : "default",
      }}
      description={
        isSettlement ? (
          isCurrentUserPayer ? (
            <>
              Você deve compensar{" "}
              <MoneyText
                cents={settlementAmountCents}
                tone="negative"
                className="font-semibold"
              />{" "}
              para {settlementReceiverName ?? "seu parceiro"}.
            </>
          ) : isCurrentUserReceiver ? (
            <>
              Você tem{" "}
              <MoneyText
                cents={settlementAmountCents}
                tone="positive"
                className="font-semibold"
              />{" "}
              a receber de {settlementPayerName ?? "seu parceiro"}.
            </>
          ) : (
            <>
              Compensação de{" "}
              <MoneyText cents={settlementAmountCents} className="font-semibold" />{" "}
              pendente no rateio da casa.
            </>
          )
        ) : (
          <>
            A casa gastou{" "}
            <MoneyText
              cents={totalSpentCents}
              tone={isExceeded ? "negative" : "default"}
              className="font-semibold"
            />{" "}
            de <MoneyText cents={ceilingCents} className="font-semibold" />
            {daysRemaining !== undefined && daysRemaining > 0
              ? ` (restam ${daysRemaining} dias).`
              : "."}
          </>
        )
      }
      primaryAction={{
        label: isSettlement ? "Fazer Acerto" : "Ver Família",
        onClick: handleNavigate,
        variant: "outline",
        icon: <ArrowRight className="size-3.5" aria-hidden="true" />,
      }}
      dismissPolicy={
        onSelectPreset || onDismiss
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) onSelectPreset(preset);
                else onDismiss?.(preset === "7d" ? 7 : 30);
              },
              label: isSettlement
                ? "Dispensar aviso de acerto familiar"
                : "Dispensar aviso de teto familiar",
            }
          : undefined
      }
    />
  );
}
