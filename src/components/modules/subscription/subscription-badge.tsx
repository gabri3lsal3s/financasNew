import { Sparkles, BookOpen, FlaskConical, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubscriptionStatus } from "@/types";

export interface SubscriptionBadgeProps {
  status: SubscriptionStatus;
  className?: string;
}

/**
 * Badge dinâmico de status de assinatura exibido no Header e Sidebar.
 *
 * - Vitalício VIP: variante `muted` com ícone Crown.
 * - Pro ativo: variante `positive` com ícone Sparkles.
 * - Trial ativo: variante `default` com ícone FlaskConical e contagem regressiva.
 * - Modo somente-leitura: variante `warning` com ícone BookOpen.
 *
 * Regra: zero emojis, apenas ícones lucide-react com aria-hidden (AGENTS.md §8).
 */
export function SubscriptionBadge({ status, className }: SubscriptionBadgeProps) {
  if (status.isLifetime) {
    return (
      <Badge variant="muted" size="sm" className={cn("gap-1 font-medium text-foreground", className)}>
        <Crown className="size-3 text-warning-strong" aria-hidden="true" />
        Vitalício
      </Badge>
    );
  }

  if (status.isPro) {
    return (
      <Badge variant="positive" size="sm" className={cn("gap-1", className)}>
        <Sparkles className="size-3" aria-hidden="true" />
        Plano Pro
      </Badge>
    );
  }

  if (status.isTrial && status.trialDaysRemaining !== null) {
    const days = status.trialDaysRemaining;
    return (
      <Badge variant="default" size="sm" className={cn("gap-1", className)}>
        <FlaskConical className="size-3" aria-hidden="true" />
        Teste Pro: {days}d
      </Badge>
    );
  }

  // read_only ou trial expirado
  return (
    <Badge variant="warning" size="sm" className={cn("gap-1", className)}>
      <BookOpen className="size-3" aria-hidden="true" />
      Modo Leitura
    </Badge>
  );
}
