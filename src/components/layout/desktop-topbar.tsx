import { BookOpen } from "lucide-react";
import type { ThemePreference } from "@/app/theme-provider";
import { CalculatorButton } from "@/components/layout/calculator-button";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { PrivacyToggle } from "@/components/layout/privacy-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  resolveVisibleHeaderSlots,
  type VisibleHeaderSlot,
} from "@/domain/preferences/visual-defaults";
import { triggerSensory } from "@/services/sensory";
import type { SubscriptionStatus } from "@/types";

export interface DesktopTopbarProps {
  subscription?: SubscriptionStatus | null;
  onOpenUpgrade: () => void;
  showCalc: boolean;
  hasNotifications?: boolean;
  showTheme: boolean;
  showPrivacy: boolean;
  visibleSlots?: VisibleHeaderSlot[];
  onThemeChange: (next: ThemePreference) => void;
}

export function DesktopTopbar({
  subscription,
  onOpenUpgrade,
  showCalc,
  hasNotifications = false,
  showTheme,
  showPrivacy,
  visibleSlots,
  onThemeChange,
}: DesktopTopbarProps) {
  const resolvedSlots =
    visibleSlots ??
    resolveVisibleHeaderSlots(
      {
        logo: true,
        calculatorButton: showCalc,
        themeToggle: showTheme,
        privacyToggle: showPrivacy,
      },
      hasNotifications,
    );
  return (
    <>
      {!subscription?.isLoading && subscription?.isReadOnly && (
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

      <div data-tour="header-privacy-theme" className="flex items-center gap-1.5 shrink-0">
        {resolvedSlots.map((slot) => {
          if (slot === "calculatorButton") {
            return <CalculatorButton key="calculatorButton" />;
          }
          if (slot === "themeToggle") {
            return <ThemeToggle key="themeToggle" onThemeChange={onThemeChange} />;
          }
          if (slot === "privacyToggle") {
            return <PrivacyToggle key="privacyToggle" />;
          }
          if (slot === "notifications") {
            return <NotificationsButton key="notifications" />;
          }
          return null;
        })}
      </div>
    </>
  );
}
