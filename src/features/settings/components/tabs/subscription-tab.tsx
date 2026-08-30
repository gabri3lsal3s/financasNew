import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  BookOpen,
  FlaskConical,
  ArrowUpRight,
  Calendar,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  ConfirmDialog,
} from "@/components/ui";
import { UpgradeDialog } from "@/components/modules/subscription/upgrade-dialog";
import { CheckoutSheet } from "@/components/modules/subscription/checkout-sheet";
import { useUserSubscription } from "@/state";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types";

/**
 * Aba "Plano e Assinatura" em Configurações.
 *
 * Exibe o status atual do plano, datas e ações disponíveis:
 * - Trial: barra de progresso com dias restantes + CTA de upgrade.
 * - Pro: data de renovação, método de pagamento e cancelamento em 1 clique.
 * - Somente-leitura: CTA para reativar o Pro.
 *
 * Regras: zero emojis, zero controles nativos, cards com trinca canônica (AGENTS.md).
 */
export function SubscriptionTab() {
  const subscription = useUserSubscription();

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const handleProceedToCheckout = (plan: SubscriptionPlan) => {
    setUpgradeOpen(false);
    setCheckoutPlan(plan);
  };

  const handleCheckoutSuccess = () => {
    pushToast({ title: "Plano Pro ativado!", description: "Bem-vindo ao Plano Pro.", variant: "default" });
  };

  const handleCancelConfirm = () => {
    // TODO: integrar com endpoint de cancelamento do gateway
    triggerSensory("destructive");
    pushToast({
      title: "Cancelamento registrado",
      description: "Seu plano permanece ativo até o fim do período pago.",
      variant: "default",
    });
    setCancelOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Card de status atual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Plano Atual</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <StatusBlock subscription={subscription} onUpgrade={() => setUpgradeOpen(true)} />
        </CardContent>
      </Card>

      {/* Tabela comparativa de planos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Comparativo de Planos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PlanComparisonTable isFullAccess={subscription.isFullAccess} />

          {!subscription.isPro && (
            <div className="mt-5">
              <Button
                type="button"
                className="w-full gap-2"
                onClick={() => setUpgradeOpen(true)}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Ativar Plano Pro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancelamento — apenas para assinantes ativos */}
      {subscription.isPro && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Cancelamento</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ao cancelar, seu acesso Pro permanece ativo até o fim do período já pago. Todos
              os seus dados são preservados para sempre — você poderá reativar o Pro a qualquer
              momento.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setCancelOpen(true)}
              className="gap-2"
            >
              <XCircle className="size-4" aria-hidden="true" />
              Cancelar Assinatura
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onProceedToCheckout={handleProceedToCheckout}
      />

      {checkoutPlan !== null && (
        <CheckoutSheet
          open={true}
          onOpenChange={(o) => { if (!o) setCheckoutPlan(null); }}
          plan={checkoutPlan}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar assinatura Pro?"
        description="Seu plano fica ativo até o fim do período pago. Nenhum dado será excluído e você pode reativar a qualquer momento."
        confirmLabel="Cancelar Assinatura"
        variant="destructive"
        onConfirm={handleCancelConfirm}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes internos
// ---------------------------------------------------------------------------

interface StatusBlockProps {
  subscription: ReturnType<typeof useUserSubscription>;
  onUpgrade: () => void;
}

function StatusBlock({ subscription, onUpgrade }: StatusBlockProps) {
  const { isTrial, isPro, trialDaysRemaining, trialEndsAt, currentPeriodEnd, plan } =
    subscription;

  if (isTrial && trialDaysRemaining !== null) {
    const progress = Math.round(((30 - trialDaysRemaining) / 30) * 100);
    const endsLabel = trialEndsAt
      ? new Date(trialEndsAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-5 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">Teste Pro Ativo</span>
          </div>
          <Badge variant="default" size="sm">
            {trialDaysRemaining}d restantes
          </Badge>
        </div>

        {/* Barra de progresso dos dias de trial */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Dia 1</span>
            {endsLabel && <span>Encerra em {endsLabel}</span>}
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${30 - trialDaysRemaining} de 30 dias utilizados`}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {30 - trialDaysRemaining} de 30 dias utilizados — acesso total a todos os recursos.
          </p>
        </div>

        <Button type="button" className="w-full gap-2" onClick={onUpgrade}>
          <Sparkles className="size-4" aria-hidden="true" />
          Assinar Plano Pro e manter tudo ativo
        </Button>
      </div>
    );
  }

  if (isPro) {
    const planLabel = plan === "annual" ? "Pro Anual" : "Pro Mensal";
    const renewLabel = currentPeriodEnd
      ? new Date(currentPeriodEnd).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "–";

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-positive-strong" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">Plano {planLabel}</span>
          <Badge variant="positive" size="sm">
            Ativo
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow icon={Calendar} label="Próxima renovação" value={renewLabel} />
          <InfoRow icon={ShieldCheck} label="Status" value="Assinatura ativa" />
          <InfoRow
            icon={RefreshCw}
            label="Cancelamento"
            value="A qualquer momento, sem taxas"
          />
        </div>
      </div>
    );
  }

  // Somente-leitura
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="size-5 text-warning-strong" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Modo Somente-Leitura</span>
        <Badge variant="warning" size="sm">
          Trial encerrado
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Seu período de teste encerrou. Todos os seus dados estão preservados e você pode
        consultar seu histórico a qualquer momento. Para lançar novos registros, ative o
        Plano Pro.
      </p>

      <Button type="button" className="w-full gap-2" onClick={onUpgrade}>
        <Sparkles className="size-4" aria-hidden="true" />
        Ativar Plano Pro
      </Button>
    </div>
  );
}

interface InfoRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border/80 bg-muted/20 p-3",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

const COMPARISON_ROWS = [
  { feature: "Consulta de histórico e saldos", readOnly: true, pro: true },
  { feature: "Novos lançamentos (despesas/receitas)", readOnly: false, pro: true },
  { feature: "Gestão de cartões de crédito", readOnly: false, pro: true },
  { feature: "Parcelamentos em até 60x", readOnly: false, pro: true },
  { feature: "Rebalanceamento de investimentos", readOnly: false, pro: true },
  { feature: "Radar Fiscal IR e DARF", readOnly: false, pro: true },
  { feature: "Exportação Excel (.xlsx)", readOnly: false, pro: true },
  { feature: "Simulador FIRE e Projeção", readOnly: false, pro: true },
] as const;

function PlanComparisonTable({ isFullAccess }: { isFullAccess: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/80 bg-muted/30">
            <th className="py-2.5 pl-4 pr-2 text-left font-semibold text-muted-foreground">
              Recurso
            </th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground w-24">
              Leitura
            </th>
            <th className="px-3 py-2.5 text-center font-semibold text-primary w-24">
              Pro
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row, i) => (
            <tr
              key={row.feature}
              className={cn(
                "border-b border-border/60 last:border-b-0",
                i % 2 === 0 ? "bg-surface" : "bg-muted/10",
              )}
            >
              <td className="py-2.5 pl-4 pr-2 text-foreground">{row.feature}</td>
              <td className="px-3 py-2.5 text-center">
                {row.readOnly ? (
                  <CheckCircle2
                    className="mx-auto size-4 text-positive-strong"
                    aria-label="Disponível"
                  />
                ) : (
                  <XCircle
                    className="mx-auto size-4 text-negative-strong/60"
                    aria-label="Indisponível"
                  />
                )}
              </td>
              <td className="px-3 py-2.5 text-center">
                <CheckCircle2
                  className={cn(
                    "mx-auto size-4",
                    isFullAccess ? "text-positive-strong" : "text-muted-foreground/40",
                  )}
                  aria-label="Disponível no Pro"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
