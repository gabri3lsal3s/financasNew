import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  CreditCard,
  FlaskConical,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import type { SubscriptionStatus } from "@/types";

interface InfoRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface-raised/60 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function formatLongDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export interface CurrentPlanHeroCardProps {
  subscription: SubscriptionStatus;
  onUpgrade: () => void;
}

export function CurrentPlanHeroCard({ subscription, onUpgrade }: CurrentPlanHeroCardProps) {
  const { isTrial, isPro, trialDaysRemaining, trialEndsAt, currentPeriodEnd, plan, hasAutoRenew } =
    subscription;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Plano Atual</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {subscription.isLifetime ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">
                Plano Pro Vitalício
              </span>
              <Badge variant="positive" size="sm">
                Membro Fundador VIP
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow
                icon={Calendar}
                label="Validade do Acesso"
                value="Vitalício / Sem expiração"
              />
              <InfoRow icon={ShieldCheck} label="Status" value="Acesso completo garantido" />
              <InfoRow
                icon={Sparkles}
                label="Cobrança"
                value="Isento de mensalidades"
              />
              <InfoRow
                icon={RefreshCw}
                label="Recursos"
                value="Todas as ferramentas Pro liberadas"
              />
            </div>
          </div>
        ) : hasAutoRenew ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">
                Plano {plan === "annual" ? "Pro Anual" : "Pro Mensal"}
              </span>
              <Badge variant="positive" size="sm">
                Cobrança Automática Ativa
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow
                icon={Calendar}
                label={isTrial ? "Primeira cobrança" : "Próxima renovação"}
                value={formatLongDateBR(trialEndsAt || currentPeriodEnd)}
              />
              <InfoRow
                icon={ShieldCheck}
                label="Status"
                value={
                  isTrial && trialDaysRemaining !== null
                    ? `Degustação ativa (${trialDaysRemaining}d restantes)`
                    : "Assinatura ativa"
                }
              />
              <InfoRow
                icon={CreditCard}
                label="Método"
                value="Cartão de Crédito recorrente"
              />
              <InfoRow
                icon={RefreshCw}
                label="Cancelamento"
                value="A qualquer momento em 1 clique"
              />
            </div>
          </div>
        ) : isTrial && trialDaysRemaining !== null ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FlaskConical className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Teste Pro Ativo</span>
              </div>
              <Badge variant="default" size="sm">
                {trialDaysRemaining}d restantes
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Dia 1</span>
                {trialEndsAt ? <span>Encerra em {formatLongDateBR(trialEndsAt)}</span> : null}
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${Math.round(((30 - trialDaysRemaining) / 30) * 100)}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(((30 - trialDaysRemaining) / 30) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${30 - trialDaysRemaining} de 30 dias utilizados`}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {30 - trialDaysRemaining} de 30 dias utilizados — acesso total a todos os recursos.
              </p>
            </div>

            <Button type="button" variant="default" className="w-full gap-2 shadow-xs" onClick={onUpgrade}>
              <Sparkles className="size-4" aria-hidden="true" />
              <span>Assinar Plano Pro e manter tudo ativo</span>
            </Button>
          </div>
        ) : isPro ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">
                Plano {plan === "annual" ? "Pro Anual" : "Pro Mensal"}
              </span>
              <Badge variant="default" size="sm">
                Ativo
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow
                icon={Calendar}
                label="Próxima renovação"
                value={formatLongDateBR(currentPeriodEnd)}
              />
              <InfoRow icon={ShieldCheck} label="Status" value="Assinatura ativa" />
              <InfoRow
                icon={RefreshCw}
                label="Cancelamento"
                value="A qualquer momento em 1 clique"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <BookOpen className="size-5 text-warning-strong shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">Modo Somente-Leitura</span>
              <Badge variant="warning" size="sm">
                Trial encerrado
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Seu período de teste encerrou. Todos os seus dados e relatórios estão preservados e você pode consultar seu histórico a qualquer momento. Para lançar novos registros e orçamentos, ative o Plano Pro.
            </p>

            <Button type="button" variant="default" className="w-full gap-2 shadow-xs" onClick={onUpgrade}>
              <Sparkles className="size-4" aria-hidden="true" />
              <span>Ativar Plano Pro</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
