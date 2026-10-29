import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Check, Shuffle, Sparkles } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getTourHandoffDestination, getTourSteps } from "@/domain/demo-simulation";
import {
  endDemo,
  goToNextStep,
  goToPrevStep,
  markTourCompleted,
  useDemoSession,
} from "@/state/demo-mode";
import { DemoTrackSelectModal } from "./demo-track-select-modal";

/**
 * @deprecated Substituído por `DemoTourSpotlight` (apresentação contextual orientada a spotlight).
 * Mantido apenas para compatibilidade de testes unitários e histórico do projeto.
 */
export interface DemoTourBarProps {
  /** Callback opcional acionado quando o usuário avança para o próximo passo. */
  onNextStep?: (newStepIndex: number) => void;
  /** Callback opcional acionado quando o usuário retrocede para o passo anterior. */
  onPrevStep?: (newStepIndex: number) => void;
  /** Callback opcional acionado quando o usuário solicita trocar de trilha. Se omitido, abre o seletor modal nativo. */
  onChangeTrack?: () => void;
  /** Callback opcional acionado quando o usuário conclui ou escolhe começar sua conta real. */
  onStartRealAccount?: () => void;
  /** Classes extras aplicadas ao contêiner raiz da barra. */
  className?: string;
}

/**
 * Barra Guiada Superior do Tour Interativo (DemoTourBar).
 * Fixada na parte superior da viewport enquanto a simulação em memória está ativa,
 * exibindo o progresso do tour, didática de cada tela e controles de navegação contextual.
 *
 * @deprecated Substituído por `DemoTourSpotlight`. O layout de página agora utiliza exclusivamente
 * `DemoTourSpotlight` em conjunto com o badge minimalista no header em `PageShell`, eliminando a
 * compressão vertical da tela e a duplicação de controles de navegação.
 */
export function DemoTourBar({
  onNextStep,
  onPrevStep,
  onChangeTrack,
  onStartRealAccount,
  className,
}: DemoTourBarProps) {
  const session = useDemoSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [trackSelectOpen, setTrackSelectOpen] = useState(false);

  const { isDemoActive, activeTrack, currentStepIndex } = session;

  const steps = useMemo(
    () => (activeTrack ? getTourSteps(activeTrack) : []),
    [activeTrack],
  );
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex] ?? steps[0];
  const currentStepNumber = currentStepIndex + 1;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = totalSteps > 0 && currentStepIndex >= totalSteps - 1;

  const handleStartRealAccount = useCallback(() => {
    if (activeTrack) {
      markTourCompleted(activeTrack);
    }
    endDemo();
    if (onStartRealAccount) {
      onStartRealAccount();
    } else {
      const destination = getTourHandoffDestination(activeTrack, location.pathname);
      navigate(destination);
    }
  }, [activeTrack, location.pathname, navigate, onStartRealAccount]);

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      const nextIndex = currentStepIndex + 1;
      goToNextStep();
      const nextStep = steps[nextIndex];
      if (nextStep) {
        navigate(nextStep.targetRoute);
      }
      onNextStep?.(nextIndex);
    } else {
      handleStartRealAccount();
    }
  }, [currentStepIndex, handleStartRealAccount, isLastStep, navigate, onNextStep, steps]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      const prevIndex = Math.max(0, currentStepIndex - 1);
      goToPrevStep();
      const prevStep = steps[prevIndex];
      if (prevStep) {
        navigate(prevStep.targetRoute);
      }
      onPrevStep?.(prevIndex);
    }
  }, [currentStepIndex, isFirstStep, navigate, onPrevStep, steps]);

  const handleChangeTrack = useCallback(() => {
    if (onChangeTrack) {
      onChangeTrack();
    } else {
      setTrackSelectOpen(true);
    }
  }, [onChangeTrack]);

  if (!isDemoActive || !activeTrack || !currentStep) {
    return null;
  }

  const trackLabel =
    activeTrack === "finances" ? "Finanças Diárias" : "Investimentos";

  return (
    <>
      <aside
        role="region"
        aria-label="Barra guiada do modo de demonstração"
        className={cn(
          "sticky top-0 z-sticky w-full border-b border-border/80 bg-surface/95 backdrop-blur-md shadow-xs transition-all duration-200",
          className,
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-3 py-2 sm:px-6 sm:py-2.5 md:flex-row md:items-center md:justify-between lg:px-8">
          {/* Lado Esquerdo: Identificação de Passo e Didática */}
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              <Badge variant="default" size="xs" className="gap-1 font-semibold">
                <Sparkles className="size-3" aria-hidden="true" />
                <span>
                  Passo {currentStepNumber} de {totalSteps}
                </span>
              </Badge>
              <Badge
                variant="muted"
                size="xs"
                className="hidden sm:inline-flex text-muted-foreground"
              >
                {trackLabel}
              </Badge>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">
                {currentStep.title}
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 sm:line-clamp-2 leading-tight sm:leading-normal">
                {currentStep.description}
              </p>
            </div>
          </div>

          {/* Lado Direito: Ações de Navegação e Hand-off */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 flex-wrap">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleChangeTrack}
              title="Trocar de trilha"
              className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
            >
              <Shuffle className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Trocar Trilha</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={isFirstStep}
              title="Passo anterior"
              className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs cursor-pointer gap-1"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span className="hidden xs:inline sm:inline">Anterior</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNext}
              title={isLastStep ? "Concluir tour" : "Próximo passo"}
              className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs cursor-pointer gap-1 font-medium"
            >
              <span>{isLastStep ? "Concluir Tour" : "Próximo"}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>

            <div
              className="hidden sm:block h-4 w-px bg-border/80 mx-0.5"
              aria-hidden="true"
            />

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleStartRealAccount}
              className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs font-semibold cursor-pointer gap-1.5"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>Começar Minha Conta Real</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Modal interno para troca de trilha sob demanda */}
      <DemoTrackSelectModal
        open={trackSelectOpen}
        onOpenChange={setTrackSelectOpen}
      />
    </>
  );
}
