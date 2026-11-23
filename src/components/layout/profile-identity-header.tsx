import { ShieldCheck, Sparkles, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui";
import { SubscriptionBadge } from "@/components/modules/subscription/subscription-badge";
import type { SubscriptionStatus } from "@/types";

export interface ProfileIdentityHeaderProps {
  initials: string;
  displayName: string;
  email?: string;
  subscription: SubscriptionStatus;
  onUpgrade: () => void;
}

export function ProfileIdentityHeader({
  initials,
  displayName,
  email,
  subscription,
  onUpgrade,
}: ProfileIdentityHeaderProps) {
  return (
    <>
      {/* Card de Identidade do Usuário */}
      <div className="flex items-center gap-3.5 sm:gap-4 rounded-xl border border-border/80 bg-muted/50 p-3.5 sm:p-4">
        <div className="relative shrink-0">
          <div className="flex size-12 sm:size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-display text-base sm:text-lg font-bold text-primary-foreground shadow-xs select-none">
            {initials}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex size-4 sm:size-4.5 items-center justify-center rounded-full bg-surface border border-surface">
            <ShieldCheck className="size-2.5 sm:size-3 text-positive-strong" aria-hidden="true" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display text-sm sm:text-base font-bold text-foreground leading-snug truncate">
            {displayName}
          </p>
          {email && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate leading-tight mt-0.5">
              {email}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-2.5">
            <SubscriptionBadge status={subscription} />
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-positive-strong">
              <span className="size-2 rounded-full bg-positive shrink-0" aria-hidden="true" />
              <span>Sessão Segura</span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Upgrade para usuários que não têm o Plano Pro ou Vitalício */}
      {!subscription.isPro && !subscription.isLifetime && (
        <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-accent/5 p-3.5 sm:p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm text-foreground">
                <Sparkles className="size-3.5 sm:size-4 text-primary-strong shrink-0" aria-hidden="true" />
                <span>Desbloqueie o Plano Pro</span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                Aportes automáticos, múltiplos cartões e relatórios fiscais ilimitados.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              sensoryIntent="selection"
              className="gap-1.5 text-xs shrink-0 font-medium self-stretch sm:self-center"
              onClick={onUpgrade}
            >
              <span>Assinar</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
