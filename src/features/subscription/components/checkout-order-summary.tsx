import { CheckCircle2, Lock, ShieldCheck, type LucideIcon } from "lucide-react";
import { MoneyText } from "@/components/ui";
import type { BillingScheduleResult } from "@/domain/subscription";

export interface CheckoutOrderSummaryProps {
  planTitle: string;
  priceCents: number;
  billingSchedule: BillingScheduleResult;
}

export function CheckoutOrderSummary({
  planTitle,
  priceCents,
  billingSchedule,
}: CheckoutOrderSummaryProps) {
  const isDeferred = billingSchedule.isDelayedByTrial || Boolean(billingSchedule.isDelayedByActivePeriod);
  const firstBillingFormatted = billingSchedule.firstBillingDate.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  return (
    <>
      <div className="rounded-xl border border-border/80 bg-surface-raised/60 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{planTitle}</span>
          <MoneyText
            cents={priceCents}
            variant="value"
            tone="default"
            deemphasizeCents={false}
            className="text-sm font-semibold"
          />
        </div>
        <div className="border-t border-border/80 pt-2 flex justify-between text-sm font-bold">
          <span>
            {isDeferred ? "Total cobrado hoje" : "Total a pagar"}
          </span>
          <MoneyText
            cents={isDeferred ? 0 : priceCents}
            variant="value"
            tone="default"
            deemphasizeCents={false}
            className="text-sm font-bold"
          />
        </div>
        {billingSchedule.isDelayedByActivePeriod ? (
          <p className="text-[11px] text-muted-foreground pt-1">
            Cobrança de{" "}
            <MoneyText
              cents={priceCents}
              variant="caption"
              tone="default"
              deemphasizeCents={false}
            />{" "}
            agendada para {firstBillingFormatted} (após o término do seu período atual).
          </p>
        ) : billingSchedule.isDelayedByTrial ? (
          <p className="text-[11px] text-muted-foreground pt-1">
            Primeira fatura de{" "}
            <MoneyText
              cents={priceCents}
              variant="caption"
              tone="default"
              deemphasizeCents={false}
            />{" "}
            agendada para{" "}
            {firstBillingFormatted}
            .
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <SecuritySeal icon={Lock} label="SSL 256-bit" />
        <SecuritySeal icon={ShieldCheck} label="Dados protegidos" />
        <SecuritySeal
          icon={CheckCircle2}
          label="Garantia 7 dias com estorno integral (CDC Art. 49)"
        />
      </div>
    </>
  );
}

function SecuritySeal({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </div>
  );
}
