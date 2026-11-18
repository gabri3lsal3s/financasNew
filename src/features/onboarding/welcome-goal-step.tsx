import { ChoiceCard } from "@/components/ui";
import { GOAL_OPTIONS, type OnboardingGoalId } from "./use-initial-onboarding";

export interface WelcomeGoalStepProps {
  selectedGoal: OnboardingGoalId;
  onSelectGoal: (goalId: OnboardingGoalId) => void;
}

/**
 * Passo 2 do WelcomeModal: escolha da prioridade inicial do usuário.
 */
export function WelcomeGoalStep({ selectedGoal, onSelectGoal }: WelcomeGoalStepProps) {
  return (
    <div className="space-y-3 py-1">
      <p className="text-xs text-muted-foreground">
        Escolha por onde prefere começar. Você poderá navegar e alterar o foco a qualquer momento:
      </p>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
        role="radiogroup"
        aria-label="Prioridade inicial"
      >
        {GOAL_OPTIONS.map((goal) => {
          const Icon = goal.icon;
          const isSelected = selectedGoal === goal.id;
          return (
            <ChoiceCard
              key={goal.id}
              title={goal.title}
              description={goal.description}
              badge={goal.badge}
              badgeVariant={isSelected ? "default" : "muted"}
              selected={isSelected}
              icon={<Icon className="size-4" aria-hidden="true" />}
              onClick={() => onSelectGoal(goal.id)}
              aria-label={goal.title}
            />
          );
        })}
      </div>
    </div>
  );
}
