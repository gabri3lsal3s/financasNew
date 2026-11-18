import { ArrowRight, CheckCircle2, Compass } from "lucide-react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  GOAL_OPTIONS,
  useInitialOnboarding,
  type OnboardingGoalId,
} from "./use-initial-onboarding";
import { WelcomeGoalStep } from "./welcome-goal-step";
import { WelcomeIntroStep } from "./welcome-intro-step";
import { WelcomeTourConfirmStep } from "./welcome-tour-confirm-step";

export type { OnboardingGoalId };

export interface WelcomeModalProps {
  /** Controle externo de visibilidade (opcional). Se omitido, deriva de hasSeenWelcomeModal(). */
  open?: boolean;
  /** Callback acionado ao alterar o estado de abertura do modal. */
  onOpenChange?: (open: boolean) => void;
  /** Callback acionado quando o usuário escolhe fazer o tour demonstrativo guiado. */
  onStartTour?: () => void;
  /** Callback acionado quando o usuário escolhe ir direto para a configuração da conta real. */
  onStartRealAccount?: () => void;
  /** Força a exibição ignorando a flag salva no localStorage. */
  forceShow?: boolean;
}

const STEP_COPY: Record<1 | 2 | 3, { title: string; description: string }> = {
  1: {
    title: "Boas-vindas ao seu novo centro financeiro",
    description:
      "Acesso Axir Pro desbloqueado por 30 dias completos. Sem cartão de crédito cadastrado.",
  },
  2: {
    title: "Qual é sua principal prioridade hoje?",
    description: "Personalizamos sua experiência inicial conforme o objetivo mais urgente.",
  },
  3: {
    title: "Tudo pronto para transformar suas finanças",
    description: "Comece agora diretamente pela sua prioridade ou faça um tour de 1 minuto.",
  },
};

/**
 * Diálogo de Boas-Vindas no Primeiro Acesso do Usuário (WelcomeModal).
 */
export function WelcomeModal({
  open,
  onOpenChange,
  onStartTour,
  onStartRealAccount,
  forceShow = false,
}: WelcomeModalProps) {
  const {
    currentStep,
    setCurrentStep,
    selectedGoal,
    setSelectedGoal,
    isVisible,
    handleClose,
    handleStartTour,
    handleStartGoal,
    handleOpenChange,
  } = useInitialOnboarding({
    open,
    forceShow,
    onOpenChange,
    onStartTour,
    onStartRealAccount,
  });

  if (!isVisible) return null;

  const activeGoal = GOAL_OPTIONS.find((g) => g.id === selectedGoal) ?? GOAL_OPTIONS[0]!;
  const copy = STEP_COPY[currentStep];

  const footerContent = (
    <ModalFooter borderless>
      {currentStep === 1 ? (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            Explorar Sozinho
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => setCurrentStep(2)}
            className="gap-2 font-semibold"
          >
            <span>Personalizar Meu Início</span>
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Button>
        </>
      ) : null}

      {currentStep === 2 ? (
        <>
          <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
            Voltar
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => setCurrentStep(3)}
            className="gap-2 font-semibold"
          >
            <span>Continuar</span>
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Button>
        </>
      ) : null}

      {currentStep === 3 ? (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={handleStartTour}
            className="gap-2"
          >
            <Compass className="size-4 shrink-0" aria-hidden="true" />
            <span>Fazer Tour Rápido (1 min)</span>
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => handleStartGoal(selectedGoal)}
            className="gap-2 font-semibold"
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <span>Começar Agora</span>
          </Button>
        </>
      ) : null}
    </ModalFooter>
  );

  return (
    <Modal
      open={isVisible}
      onOpenChange={handleOpenChange}
      title={copy.title}
      description={copy.description}
      size="lg"
      footer={footerContent}
    >
      <div className="flex items-center gap-1.5 py-1 mb-2" aria-label={`Passo ${currentStep} de 3`}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              step === currentStep
                ? "w-8 bg-primary"
                : step < currentStep
                  ? "w-3 bg-primary/40"
                  : "w-3 bg-border/80",
            )}
          />
        ))}
      </div>

      {currentStep === 1 ? <WelcomeIntroStep /> : null}
      {currentStep === 2 ? (
        <WelcomeGoalStep selectedGoal={selectedGoal} onSelectGoal={setSelectedGoal} />
      ) : null}
      {currentStep === 3 ? <WelcomeTourConfirmStep activeGoal={activeGoal} /> : null}
    </Modal>
  );
}
