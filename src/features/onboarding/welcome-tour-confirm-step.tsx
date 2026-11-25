import { ShieldCheck } from "lucide-react";
import type { OnboardingGoalOption } from "./use-initial-onboarding";

export interface WelcomeTourConfirmStepProps {
  activeGoal: OnboardingGoalOption;
}

/**
 * Passo 3 do WelcomeModal: confirmação da prioridade escolhida e oferta do tour guiado.
 */
export function WelcomeTourConfirmStep({ activeGoal }: WelcomeTourConfirmStepProps) {
  const Icon = activeGoal.icon;

  return (
    <div className="space-y-3.5 py-1">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
        <Icon className="size-5 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-medium text-primary-strong uppercase tracking-wider">
            Foco Escolhido
          </span>
          <h4 className="text-sm font-bold text-foreground tracking-tight">{activeGoal.title}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{activeGoal.description}</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-muted/50 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-positive-strong mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          Você pode fazer o tour interativo de 1 minuto (incluindo Finanças, Modo Negócio,
          Micro-IA e Investimentos) com dados simulados, ou entrar direto na sua conta.
        </p>
      </div>
    </div>
  );
}
