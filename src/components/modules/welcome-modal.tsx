import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Compass,
  CreditCard,
  HeartHandshake,
  Layers,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge, Button, ChoiceCard, Modal, ModalFooter } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import {
  hasSeenWelcomeModal,
  markNativeOnboardingSeen,
  markWelcomeModalSeen,
  setStoredInitialGoal,
} from "@/state/demo-mode";
import { useUpdateCustomSettings } from "@/state";

export type OnboardingGoalId = "cards" | "ocr" | "debts" | "family";

interface OnboardingGoalOption {
  id: OnboardingGoalId;
  title: string;
  description: string;
  route: string;
  icon: typeof CreditCard;
  badge: string;
}

const GOAL_OPTIONS: readonly OnboardingGoalOption[] = [
  {
    id: "cards",
    title: "Controlar cartões e faturas",
    description: "Evite surpresas no fechamento e veja seu melhor dia de compra em tempo real.",
    route: "/cartoes",
    icon: CreditCard,
    badge: "Essencial",
  },
  {
    id: "ocr",
    title: "Lançar sem digitação via OCR",
    description: "Capture cupons, comprovantes Pix e boletos instantaneamente pela câmera.",
    route: "/transacoes?novo=transacao",
    icon: Camera,
    badge: "Pro",
  },
  {
    id: "debts",
    title: "Equilibrar contas e quitar dívidas",
    description: "Planeje a quitação acelerada pelo método Bola de Neve ou Avalanche.",
    route: "/dividas",
    icon: TrendingDown,
    badge: "Estratégia",
  },
  {
    id: "family",
    title: "Finanças do casal ou família",
    description: "Espaço compartilhado, divisão justa de contas e cofrinhos colaborativos.",
    route: "/familia",
    icon: HeartHandshake,
    badge: "Espaço Família",
  },
];

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

/**
 * Diálogo de Boas-Vindas no Primeiro Acesso do Usuário (WelcomeModal).
 * Apresenta acolhimento em 3 etapas com foco em metas reais do usuário:
 * 1. Boas-vindas com 30 dias de Pro desbloqueados (sem cartão de crédito).
 * 2. Seleção de prioridade financeira inicial.
 * 3. Confirmação do ponto de partida com opção de tour rápido em 1 min.
 */
export function WelcomeModal({
  open,
  onOpenChange,
  onStartTour,
  onStartRealAccount,
  forceShow = false,
}: WelcomeModalProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedGoal, setSelectedGoal] = useState<OnboardingGoalId>("cards");
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (forceShow) return true;
    if (open !== undefined) return open;
    return !hasSeenWelcomeModal();
  });

  const isVisible = open !== undefined ? open : internalOpen;

  const handleClose = useCallback(() => {
    markWelcomeModalSeen();
    markNativeOnboardingSeen();
    setStoredInitialGoal(selectedGoal);
    try {
      updateCustomSettingsMutation.mutate({ initialGoal: selectedGoal });
    } catch {
      // Ignora falha assíncrona se desconectado
    }
    setInternalOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange, selectedGoal, updateCustomSettingsMutation]);

  const handleStartTour = useCallback(() => {
    triggerSensory("action");
    handleClose();
    onStartTour?.();
  }, [handleClose, onStartTour]);

  const handleStartGoal = useCallback(
    (goalId: OnboardingGoalId) => {
      triggerSensory("action");
      setStoredInitialGoal(goalId);
      try {
        updateCustomSettingsMutation.mutate({ initialGoal: goalId });
      } catch {
        // Ignora falha assíncrona
      }
      handleClose();
      onStartRealAccount?.();
      const goal = GOAL_OPTIONS.find((g) => g.id === goalId);
      if (goal) {
        navigate(goal.route);
      }
    },
    [handleClose, navigate, onStartRealAccount, updateCustomSettingsMutation],
  );

  if (!isVisible) return null;

  const activeGoal = GOAL_OPTIONS.find((g) => g.id === selectedGoal) ?? GOAL_OPTIONS[0]!;

  return (
    <Modal
      open={isVisible}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        } else {
          setInternalOpen(true);
          onOpenChange?.(true);
        }
      }}
      title={
        currentStep === 1
          ? "Boas-vindas ao seu novo centro financeiro"
          : currentStep === 2
            ? "Qual é sua principal prioridade hoje?"
            : "Tudo pronto para transformar suas finanças"
      }
      description={
        currentStep === 1
          ? "Acesso Axir Pro desbloqueado por 30 dias completos. Sem cartão de crédito cadastrado."
          : currentStep === 2
            ? "Personalizamos sua experiência inicial conforme o objetivo mais urgente."
            : "Comece agora diretamente pela sua prioridade ou faça um tour de 1 minuto."
      }
      size="lg"
    >
      {/* Indicador de passos */}
      <div className="flex items-center gap-1.5 py-1 mb-2" aria-label={`Passo ${currentStep} de 3`}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              step === currentStep
                ? "w-8 bg-primary"
                : step < currentStep
                  ? "w-3 bg-primary/40"
                  : "w-3 bg-border/80",
            )}
          />
        ))}
      </div>

      {/* Passo 1: Apresentação do Período de Teste e Pilares */}
      {currentStep === 1 && (
        <div className="space-y-3.5 py-1">
          {/* Card destaque Pro liberado */}
          <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
            <Sparkles className="size-5 shrink-0 text-primary-strong mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">30 Dias de Acesso Pro Total</span>
                <Badge variant="positive" size="xs">
                  Sem Cartão
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                Você tem acesso irrestrito a OCR com inteligência semântica, controle multi-cartões em até 60x,
                Espaço Família compartilhado e simuladores de dívidas.
              </p>
            </div>
          </div>

          {/* 3 Pilares com ícones sóbrios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-lg border border-border/80 bg-surface p-3">
              <CreditCard className="size-4 text-muted-foreground mb-1.5" aria-hidden="true" />
              <h4 className="text-xs font-semibold text-foreground">Fluxo & Cartões</h4>
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                Faturas automáticas, melhor dia de compra e saldo Safe-to-Spend diário.
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-surface p-3">
              <Camera className="size-4 text-muted-foreground mb-1.5" aria-hidden="true" />
              <h4 className="text-xs font-semibold text-foreground">Captura Inteligente</h4>
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                Leitura de cupons e comprovantes sem digitação com privacidade total.
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-surface p-3">
              <TrendingUp className="size-4 text-portfolio mb-1.5" aria-hidden="true" />
              <h4 className="text-xs font-semibold text-foreground">Patrimônio & Metas</h4>
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                Rebalanceamento matemático de carteira e planejamento de aposentadoria.
              </p>
            </div>
          </div>

          {/* 11 categorias essenciais prontas */}
          <div className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-surface/60 p-2.5 text-xs text-muted-foreground">
            <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="leading-relaxed">
              Sua conta já inclui as 11 categorias essenciais organizadas (Alimentação, Moradia, Transporte, etc.) para você começar imediatamente.
            </p>
          </div>
        </div>
      )}

      {/* Passo 2: Seleção de Prioridade / Meta */}
      {currentStep === 2 && (
        <div className="space-y-3 py-1">
          <p className="text-xs text-muted-foreground">
            Escolha por onde prefere começar. Você poderá navegar e alterar o foco a qualquer momento:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Prioridade inicial">
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
                  onClick={() => setSelectedGoal(goal.id)}
                  aria-label={goal.title}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Passo 3: Confirmação & Partida */}
      {currentStep === 3 && (
        <div className="space-y-3.5 py-1">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center sm:text-left flex flex-col sm:flex-row items-center gap-3.5">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <activeGoal.icon className="size-5 text-primary-strong" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-primary-strong uppercase tracking-wider">
                Foco Escolhido
              </span>
              <h4 className="text-sm font-bold text-foreground tracking-tight">
                {activeGoal.title}
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {activeGoal.description}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-surface/60 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-positive-strong mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              Você pode fazer o tour interativo de 1 minuto para conhecer o fluxo completo com dados simulados, ou entrar direto na sua conta.
            </p>
          </div>
        </div>
      )}

      {/* Rodapé Dinâmico */}
      <ModalFooter>
        {currentStep === 1 && (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Explorar Sozinho
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                triggerSensory("action");
                setCurrentStep(2);
              }}
              className="gap-2 font-semibold cursor-pointer"
            >
              <span>Personalizar Meu Início</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          </>
        )}

        {currentStep === 2 && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="cursor-pointer"
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                triggerSensory("action");
                setCurrentStep(3);
              }}
              className="gap-2 font-semibold cursor-pointer"
            >
              <span>Continuar</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          </>
        )}

        {currentStep === 3 && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleStartTour}
              className="gap-2 cursor-pointer"
            >
              <Compass className="size-4 shrink-0" aria-hidden="true" />
              <span>Fazer Tour Rápido (1 min)</span>
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => handleStartGoal(selectedGoal)}
              className="gap-2 font-semibold cursor-pointer"
            >
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              <span>Começar Agora</span>
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}

