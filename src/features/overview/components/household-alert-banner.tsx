import { ArrowRight, HandCoins, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface HouseholdAlertBannerProps {
  variant: "ceiling_exceeded" | "ceiling_warning" | "settlement_pending";
  totalSpentCents?: number;
  ceilingCents?: number;
  spentPercentage?: number;
  settlementAmountCents?: number;
  settlementPayerName?: string;
  settlementReceiverName?: string;
  isCurrentUserPayer?: boolean;
  isCurrentUserReceiver?: boolean;
  daysRemaining?: number;
  className?: string;
}

export function HouseholdAlertBanner({
  variant,
  totalSpentCents = 0,
  ceilingCents = 0,
  spentPercentage = 0,
  settlementAmountCents = 0,
  settlementPayerName,
  settlementReceiverName,
  isCurrentUserPayer,
  isCurrentUserReceiver,
  daysRemaining,
  className,
}: HouseholdAlertBannerProps) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    triggerSensory("action");
    navigate("/familia");
  };

  const isExceeded = variant === "ceiling_exceeded";
  const isWarning = variant === "ceiling_warning";
  const isSettlement = variant === "settlement_pending";

  const containerBorderBg = isExceeded
    ? "border-critical/30 bg-critical/5 text-foreground"
    : isWarning
      ? "border-warning/30 bg-warning/5 text-foreground"
      : "border-primary/25 bg-primary/5 text-foreground";

  const iconContainerClass = isExceeded
    ? "bg-critical/10 border-critical/20 text-critical-strong"
    : isWarning
      ? "bg-warning/15 border-warning/20 text-warning-strong"
      : "bg-primary/10 border-primary/20 text-primary-strong";

  const badgeVariant = isExceeded ? "critical" : isWarning ? "warning" : "default";

  return (
    <div
      role="region"
      aria-label={isSettlement ? "Alerta de Acerto Familiar" : "Alerta de Teto Familiar"}
      className={cn(
        "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-all",
        containerBorderBg,
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <span
          className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl border", iconContainerClass)}
          aria-hidden="true"
        >
          {isSettlement ? <HandCoins className="size-4.5" /> : <Users className="size-4.5" />}
        </span>

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {isSettlement
                ? "Acerto Familiar Pendente"
                : isExceeded
                  ? "Teto Familiar Estourado"
                  : "Atenção ao Teto Familiar"}
            </h2>
            <Badge variant={badgeVariant} size="xs">
              {isSettlement ? "Pix" : `${spentPercentage}% do teto`}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed truncate">
            {isSettlement ? (
              isCurrentUserPayer ? (
                <>
                  Você deve compensar{" "}
                  <MoneyText cents={settlementAmountCents} tone="negative" className="font-semibold" /> para{" "}
                  {settlementReceiverName ?? "seu parceiro"}.
                </>
              ) : isCurrentUserReceiver ? (
                <>
                  Você tem{" "}
                  <MoneyText cents={settlementAmountCents} tone="positive" className="font-semibold" /> a receber de{" "}
                  {settlementPayerName ?? "seu parceiro"}.
                </>
              ) : (
                <>
                  Compensação de{" "}
                  <MoneyText cents={settlementAmountCents} className="font-semibold" /> pendente no rateio da casa.
                </>
              )
            ) : (
              <>
                A casa gastou{" "}
                <MoneyText cents={totalSpentCents} tone={isExceeded ? "negative" : "default"} className="font-semibold" /> de{" "}
                <MoneyText cents={ceilingCents} className="font-semibold" />
                {daysRemaining !== undefined && daysRemaining > 0 ? ` (restam ${daysRemaining} dias).` : "."}
              </>
            )}
          </p>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleNavigate}
        className={cn(
          "gap-1.5 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0 text-xs font-medium cursor-pointer",
          isExceeded
            ? "border-critical/30 hover:bg-critical/10 text-critical-strong"
            : isWarning
              ? "border-warning/30 hover:bg-warning/10 text-warning-strong"
              : "border-primary/30 hover:bg-primary/10 text-primary-strong",
        )}
      >
        <span>{isSettlement ? "Fazer Acerto" : "Ver Família"}</span>
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
