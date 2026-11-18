import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, MoneyText } from "@/components/ui";
import { PLAN_CONFIGS, type BillingScheduleResult } from "@/domain/subscription";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types";

const BENEFITS = [
  "Lançamentos e escritas 100% ilimitados",
  "Leitor OCR de cupons NFC-e, notas fiscais e boletos",
  "Multi-Cartões + Parcelamentos em até 60x",
  "Gestão de Dívidas (Snowball / Avalanche) e Juros",
  "Safe-to-Spend diário e Radar de Vencimentos",
  "Espaço Família colaborativo e Racha Pix",
  "Motor determinístico de Rebalanceamento",
  "Radar Fiscal de IR e DARF automático",
  "Dossiê Executivo Contábil em Excel (.xlsx)",
] as const;

export interface CheckoutPlanSummarySidebarProps {
  plan: SubscriptionPlan;
  billingSchedule: BillingScheduleResult;
  onSelectPlan: (plan: SubscriptionPlan) => void;
}

export function CheckoutPlanSummarySidebar({
  plan,
  billingSchedule,
  onSelectPlan,
}: CheckoutPlanSummarySidebarProps) {
  const planConfig = PLAN_CONFIGS[plan];

  return (
    <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-5 text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary-strong">
            Plano Pro
          </span>
          {planConfig.badge ? (
            <Badge variant="positive" size="xs">
              {planConfig.badge}
            </Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl border border-border/80 mb-4">
          <button
            type="button"
            aria-pressed={plan === "annual"}
            onClick={() => onSelectPlan("annual")}
            className={cn(
              "flex flex-col items-center justify-center min-h-11 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              plan === "annual"
                ? "bg-surface text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>Anual ({PLAN_CONFIGS.annual.badge})</span>
            <span className="text-[10px] text-positive-strong font-normal">
              <MoneyText
                cents={PLAN_CONFIGS.annual.monthlyEquivalentCents}
                variant="caption"
                tone="positive"
                className="text-[10px] font-normal"
              />
              /mês
            </span>
          </button>

          <button
            type="button"
            aria-pressed={plan === "monthly"}
            onClick={() => onSelectPlan("monthly")}
            className={cn(
              "flex flex-col items-center justify-center min-h-11 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              plan === "monthly"
                ? "bg-surface text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>Mensal</span>
            <span className="text-[10px] text-muted-foreground font-normal">
              <MoneyText
                cents={PLAN_CONFIGS.monthly.monthlyEquivalentCents}
                variant="caption"
                tone="default"
                className="text-[10px] font-normal text-muted-foreground"
              />
              /mês
            </span>
          </button>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {planConfig.title}
        </h1>
        <div className="mt-3 flex items-end gap-2 flex-wrap">
          <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground whitespace-nowrap">
            <MoneyText
              cents={billingSchedule.isDelayedByTrial ? 0 : planConfig.monthlyEquivalentCents}
              variant="hero"
              tone="default"
              deemphasizeCents={false}
              className="text-3xl sm:text-4xl font-extrabold"
            />
            {!billingSchedule.isDelayedByTrial ? <span>/mês</span> : null}
          </span>
          {billingSchedule.isDelayedByTrial ? (
            <span className="text-sm font-semibold text-positive-strong mb-1">
              hoje ({billingSchedule.daysUntilFirstCharge} dias de teste)
            </span>
          ) : null}
        </div>

        {billingSchedule.isDelayedByTrial ? (
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Primeira cobrança de{" "}
            <strong className="text-foreground">
              <MoneyText cents={planConfig.priceCents} variant="caption" tone="default" className="font-bold" />
            </strong>{" "}
            em{" "}
            <strong className="text-foreground">
              {billingSchedule.firstBillingDate.toLocaleDateString("pt-BR")}
            </strong>
            . Cancele antes dessa data com 1 clique para não ser cobrado.
          </p>
        ) : (
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <MoneyText cents={planConfig.priceCents} variant="caption" tone="default" deemphasizeCents={false} className="font-semibold" />{" "}
            cobrados no ato da confirmação. {planConfig.description}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border/80 bg-surface p-5 space-y-3 shadow-xs">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          O que você recebe
        </p>
        <ul className="space-y-2.5">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5">
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-positive-strong"
                aria-hidden="true"
              />
              <span className="text-sm text-foreground">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-surface-raised/60 px-4 py-3 border border-border/80">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground">
            Garantia incondicional de 7 dias com estorno integral (CDC Art. 49)
          </p>
          <p>
            {billingSchedule.isDelayedByTrial
              ? "Cancele a qualquer momento durante o período de teste sem nenhum custo. Após a efetivação da primeira cobrança, você tem 7 dias de garantia incondicional de reembolso com estorno integral (CDC Art. 49)."
              : "Experimente com tranquilidade: garantia incondicional de 7 dias com estorno integral após o pagamento (CDC Art. 49). Seus dados nunca são excluídos mesmo se cancelar."}
          </p>
        </div>
      </div>
    </aside>
  );
}
