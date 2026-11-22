import {
  BellRing,
  CheckCircle2,
  EyeOff,
  Fingerprint,
  Lock,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

const PREVENTIVE_ALERTS = [
  {
    title: "Alerta de Furo de Caixa",
    badge: "Projeção D+12",
    badgeVariant: "warning" as const,
    description:
      "Detecta dias em que faturas e boletos programados superariam o saldo em conta antes do susto.",
    icon: TrendingDown,
    iconTone: "text-warning-strong",
  },
  {
    title: "Radar Semanal de Vencimentos",
    badge: "Sem atraso",
    badgeVariant: "default" as const,
    description:
      "Consolida contas, faturas e dívidas da semana em uma lista objetiva para quitar sem juros.",
    icon: BellRing,
    iconTone: "text-primary-strong",
  },
  {
    title: "Detector de Aumento de Preço",
    badge: "Assinaturas",
    badgeVariant: "warning" as const,
    description:
      "Avisa automaticamente quando internet, streaming ou contas fixas sobem silenciosamente no mês.",
    icon: TrendingUp,
    iconTone: "text-warning-strong",
  },
  {
    title: "Reserva de Emergência Integrada",
    badge: "Liquidez real",
    badgeVariant: "positive" as const,
    description:
      "Vincula seus ativos líquidos da carteira aos meses reais de custo fixo para medir segurança.",
    icon: PiggyBank,
    iconTone: "text-positive-strong",
  },
  {
    title: "Assistente Inteligente com Memória",
    badge: "Contexto",
    badgeVariant: "portfolio" as const,
    description:
      "Registra regras e preferências que você já decidiu para manter recomendações coerentes ao longo do tempo.",
    icon: Sparkles,
    iconTone: "text-portfolio",
  },
] as const;

const SECURITY_ITEMS = [
  {
    title: "Zero Senhas Bancárias",
    badge: "Sem Open Finance",
    badgeVariant: "positive" as const,
    detail:
      "Nunca pedimos login ou senha do seu banco. Você registra ou importa comprovantes com autonomia total.",
    icon: ShieldCheck,
    iconTone: "text-positive-strong",
  },
  {
    title: "Autenticação 2FA (MFA) & Sessões Ativas",
    badge: "Blindagem",
    badgeVariant: "default" as const,
    detail:
      "Segundo fator opcional nativo e painel para ver onde sua conta está aberta e encerrar acessos remotos em 1 toque.",
    icon: Lock,
    iconTone: "text-primary-strong",
  },
  {
    title: "Bloqueio por PIN & Biometria",
    badge: "Acesso local",
    badgeVariant: "default" as const,
    detail:
      "Trave a abertura do aplicativo no celular por digital, reconhecimento facial ou PIN mesmo com o aparelho desbloqueado.",
    icon: Fingerprint,
    iconTone: "text-primary-strong",
  },
  {
    title: "Escudo de Privacidade Instantâneo",
    badge: "1 clique",
    badgeVariant: "muted" as const,
    detail:
      "Desfoque saldos, faturas e patrimônio na tela imediatamente quando estiver em locais públicos.",
    icon: EyeOff,
    iconTone: "text-muted-foreground",
  },
  {
    title: "Isolamento RLS & Soberania LGPD",
    badge: "Dados seus",
    badgeVariant: "positive" as const,
    detail:
      "Dados criptografados e isolados por usuário (Row Level Security), com exportação completa em Excel ou exclusão a qualquer hora.",
    icon: CheckCircle2,
    iconTone: "text-positive-strong",
  },
] as const;

export function SecurityAndRadarPreview() {
  return (
    <div
      data-testid="deep-dive-security"
      className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch"
    >
      {/* Left: Inteligência Preventiva & Radar */}
      <Card className="lg:col-span-6 border-border/80 bg-surface shadow-xs p-4 sm:p-6 space-y-4 rounded-2xl h-full">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BellRing className="size-4 text-warning-strong shrink-0" aria-hidden="true" />
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Inteligência Preventiva & Radar Diário
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Menos surpresas no fim do mês com leitura automática do seu fluxo.
            </p>
          </div>
          <Badge variant="default" size="xs">
            Proativo
          </Badge>
        </div>

        <div className="space-y-3">
          {PREVENTIVE_ALERTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-border/80 bg-surface-raised/50 p-3.5 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("size-4 shrink-0", item.iconTone)} aria-hidden="true" />
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                  </div>
                  <Badge variant={item.badgeVariant} size="xs">
                    {item.badge}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Right: Segurança, Privacidade & Controle dos Dados */}
      <Card className="lg:col-span-6 border-border/80 bg-surface shadow-xs p-4 sm:p-6 space-y-4 rounded-2xl h-full">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Segurança, Privacidade & Controle dos Dados
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Proteção em múltiplas camadas sem abrir mão da autonomia sobre suas informações.
            </p>
          </div>
          <Badge variant="positive" size="xs">
            RLS & LGPD
          </Badge>
        </div>

        <div className="space-y-3">
          {SECURITY_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-border/80 bg-surface-raised/50 p-3.5 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("size-4 shrink-0", item.iconTone)} aria-hidden="true" />
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                  </div>
                  <Badge variant={item.badgeVariant} size="xs">
                    {item.badge}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
