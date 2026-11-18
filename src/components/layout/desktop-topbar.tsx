import { Link } from "react-router";
import { BookOpen, ShieldCheck, Sparkles } from "lucide-react";
import type { ThemePreference } from "@/app/theme-provider";
import { CalculatorButton } from "@/components/layout/calculator-button";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { PrivacyToggle } from "@/components/layout/privacy-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import type { SubscriptionStatus } from "@/types";

export interface DesktopTopbarProps {
  subscription?: SubscriptionStatus | null;
  isDemoActive: boolean;
  onEndDemo: () => void;
  onOpenUpgrade: () => void;
  showCalc: boolean;
  hasNotifications: boolean;
  showTheme: boolean;
  showPrivacy: boolean;
  onThemeChange: (next: ThemePreference) => void;
}

export function DesktopTopbar({
  subscription,
  isDemoActive,
  onEndDemo,
  onOpenUpgrade,
  showCalc,
  hasNotifications,
  showTheme,
  showPrivacy,
  onThemeChange,
}: DesktopTopbarProps) {
  return (
    <>
      {subscription?.isTrial && subscription.trialDaysRemaining !== null && (
        subscription.hasAutoRenew ? (
          <Link
            to="/configuracoes?tab=subscription"
            onClick={() => triggerSensory("selection")}
            title="Plano Pro ativo com cobrança automática configurada no cartão."
            aria-label="Plano Pro ativo com cobrança automática"
            className="hidden sm:inline-flex items-center gap-1.5 shrink-0 rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 text-xs font-semibold text-positive-strong hover:bg-positive/15 transition-colors cursor-pointer select-none"
          >
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>Pro Ativo</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              triggerSensory("selection");
              onOpenUpgrade();
            }}
            title="Período de teste Pro ativo. Clique para conferir os benefícios."
            aria-label={`Teste Pro ativo: restam ${subscription.trialDaysRemaining} dias`}
            className="hidden sm:inline-flex items-center gap-1.5 shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-strong hover:bg-primary/15 transition-colors cursor-pointer select-none"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Teste Pro: {subscription.trialDaysRemaining}d</span>
          </button>
        )
      )}

      {subscription?.isReadOnly && (
        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            onOpenUpgrade();
          }}
          title="Modo somente-leitura ativo. Clique para ativar o Pro."
          aria-label="Modo somente-leitura ativo"
          className="hidden sm:inline-flex items-center gap-1.5 shrink-0 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning-strong hover:bg-warning/15 transition-colors cursor-pointer select-none"
        >
          <BookOpen className="size-3.5" aria-hidden="true" />
          <span>Modo Leitura</span>
        </button>
      )}

      {isDemoActive && (
        <div
          className="flex items-center gap-1.5 shrink-0 animate-fade-in rounded-full border border-primary/30 bg-primary/10 pl-2.5 pr-1 py-0.5 text-xs text-primary-strong shadow-xs"
          data-testid="header-demo-indicator"
        >
          <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-[11px] sm:text-xs">
            <span className="inline sm:hidden">Simulação</span>
            <span className="hidden sm:inline">Modo Simulação</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            sensoryIntent="selection"
            onClick={onEndDemo}
            aria-label="Encerrar demonstração"
            className="h-6 px-2 text-[11px] font-medium text-foreground hover:bg-surface hover:text-foreground cursor-pointer rounded-full"
          >
            Sair
          </Button>
        </div>
      )}

      {showCalc && <CalculatorButton />}
      {hasNotifications && <NotificationsButton />}

      <div data-tour="header-privacy-theme" className="flex items-center gap-1.5 shrink-0">
        {showTheme && <ThemeToggle onThemeChange={onThemeChange} />}
        {showPrivacy && <PrivacyToggle />}
      </div>
    </>
  );
}
