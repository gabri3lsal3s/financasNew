import { useNavigate } from "react-router";
import { Clock, ShieldCheck, Sparkles, TrendingUp, AlertCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTrialLifecycleMetadata } from "@/domain/subscription";

export interface TrialEndingBannerProps {
  daysRemaining: number;
  hasAutoRenew?: boolean;
  className?: string;
  onActivatePro?: () => void;
}

/**
 * Banner contextual para o carrossel de alertas da Home (DashboardAlertsCarousel).
 *
 * Apresenta o status adaptativo ao longo de todo o ciclo de vida do período de teste Pro (Trial):
 * - Welcome (21 a 30 dias): Acolhimento e superpoderes liberados.
 * - Awareness (8 a 20 dias): Consciência de valor e economia anual.
 * - Warning (3 a 7 dias): Aviso prévio e garantia de histórico salvo.
 * - Imminent (1 a 2 dias / 0 dias): Reta final e convite direto para assinatura.
 * - Expired (<= 0 dias): Modo somente-leitura ativo.
 * - Auto-Renew: Assinatura Pro garantida com cobrança automática no cartão.
 *
 * Regras: Regra 13 (Ícones Nível 2), Regra 19 (Carrossel altura integral), zero emojis (AGENTS.md).
 */
export function TrialEndingBanner({
  daysRemaining,
  hasAutoRenew,
  className,
  onActivatePro,
}: TrialEndingBannerProps) {
  const navigate = useNavigate();

  const handleActivate = () => {
    if (onActivatePro) {
      onActivatePro();
    } else if (hasAutoRenew) {
      navigate("/configuracoes?tab=assinatura");
    } else {
      navigate("/assinatura?plano=pro-anual");
    }
  };

  const meta = getTrialLifecycleMetadata(daysRemaining);

  // Se o usuário possui renovação/cobrança automática configurada no cartão
  const titleText = hasAutoRenew
    ? "Plano Pro Configurado"
    : daysRemaining === 0
      ? "Seu período de teste Pro encerra hoje"
      : daysRemaining === 1
        ? "Seu período de teste Pro encerra amanhã"
        : meta.title;

  const badgeText = hasAutoRenew
    ? "Cobrança Automática"
    : daysRemaining === 0
      ? "Último dia"
      : daysRemaining === 1
        ? "1d restantes"
        : meta.badgeLabel;

  const descriptionText = hasAutoRenew
    ? "Sua assinatura Pro está garantida com cobrança automática no cartão cadastrado."
    : meta.description;

  // Seleção semântica do container e ícone conforme o estágio
  let containerClasses = "border-primary/30 bg-primary/5";
  let iconContainerClasses = "bg-primary/10 border-primary/20 text-primary-strong";
  let IconComponent = Sparkles;

  if (hasAutoRenew) {
    containerClasses = "border-positive/30 bg-positive/5";
    iconContainerClasses = "bg-positive/10 border-positive/20 text-positive-strong";
    IconComponent = ShieldCheck;
  } else if (meta.stage === "awareness") {
    containerClasses = "border-portfolio/30 bg-portfolio/5";
    iconContainerClasses = "bg-portfolio/10 border-portfolio/20 text-portfolio";
    IconComponent = TrendingUp;
  } else if (meta.stage === "warning") {
    containerClasses = "border-warning/30 bg-warning/5";
    iconContainerClasses = "bg-warning/15 border-warning/20 text-warning-strong";
    IconComponent = Clock;
  } else if (meta.stage === "imminent") {
    containerClasses = "border-critical/30 bg-critical/5";
    iconContainerClasses = "bg-critical/10 border-critical/20 text-critical-strong";
    IconComponent = AlertCircle;
  } else if (meta.stage === "expired") {
    containerClasses = "border-warning/30 bg-warning/5";
    iconContainerClasses = "bg-warning/15 border-warning/20 text-warning-strong";
    IconComponent = BookOpen;
  }

  return (
    <div
      role="region"
      aria-label="Aviso do Período de Teste Pro"
      className={cn(
        "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-all",
        containerClasses,
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            iconContainerClasses,
          )}
        >
          <IconComponent className="size-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground truncate">{titleText}</h2>
            <Badge variant={hasAutoRenew ? "positive" : meta.badgeVariant} size="xs">
              {badgeText}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground leading-relaxed truncate">
            <ShieldCheck className="size-3.5 shrink-0 text-positive-strong" aria-hidden="true" />
            <span className="truncate">{descriptionText}</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          size="sm"
          onClick={handleActivate}
          className="w-full sm:w-auto gap-1.5 text-xs font-medium cursor-pointer"
        >
          {hasAutoRenew ? (
            <ShieldCheck className="size-3.5" aria-hidden="true" />
          ) : (
            <Sparkles className="size-3.5" aria-hidden="true" />
          )}
          {hasAutoRenew ? "Gerenciar Assinatura" : daysRemaining <= 7 ? "Ativar Plano Pro" : meta.ctaText}
        </Button>
      </div>
    </div>
  );
}

