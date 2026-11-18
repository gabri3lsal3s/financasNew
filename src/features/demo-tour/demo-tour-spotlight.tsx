import { useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { triggerSensory } from "@/services/sensory";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import {
  getBlockHandoffInfo,
  getTourHandoffDestination,
  getTourSteps,
  getTourTrackCategoryLabel,
  type AnyTourTrackId,
} from "@/domain/demo-simulation";
import {
  endDemo,
  goToNextStep,
  goToPrevStep,
  markTourCompleted,
  setStepIndex,
  startDemo,
  useDemoSession,
} from "@/state/demo-mode";
import { useSpotlightFocusKeyboard } from "./hooks/use-spotlight-focus-keyboard";
import { useSpotlightTargetRect } from "./hooks/use-spotlight-target-rect";
import { SpotlightStepCard } from "./spotlight-step-card";
import { SpotlightSvgMask } from "./spotlight-svg-mask";

export interface DemoTourSpotlightProps {
  /** Callback opcional acionado quando o usuário avança para o próximo passo. */
  onNextStep?: (newStepIndex: number) => void;
  /** Callback opcional acionado quando o usuário retrocede para o passo anterior. */
  onPrevStep?: (newStepIndex: number) => void;
  /** Callback opcional acionado quando o usuário encerra ou fecha o tour. */
  onClose?: () => void;
  /** Classes extras aplicadas ao contêiner raiz do card popover. */
  className?: string;
}

const INVASIVE_DEMO_QUERY_KEYS = [
  "novo",
  "modo",
  "passo",
  "step",
  "racha",
  "split",
  "pessoas",
  "participantes",
  "racha_modal",
  "link",
];

/**
 * Componente de Foco e Apresentação Guiada (DemoTourSpotlight).
 */
export function DemoTourSpotlight({
  onNextStep,
  onPrevStep,
  onClose,
  className,
}: DemoTourSpotlightProps) {
  const session = useDemoSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { motionLevel } = useVisualCustomization();

  const { isDemoActive, activeTrack, currentStepIndex } = session;
  const steps = useMemo(() => (activeTrack ? getTourSteps(activeTrack) : []), [activeTrack]);
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex] ?? steps[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = totalSteps > 0 && currentStepIndex >= totalSteps - 1;

  const cardRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const currentRoute = `${location.pathname}${location.search ?? ""}`;

  const restoreFocus = useCallback(() => {
    const prev = previousActiveElementRef.current;
    if (prev && typeof prev.focus === "function") {
      if (prev.isConnected) prev.focus();
      previousActiveElementRef.current = null;
    }
  }, []);

  const {
    rect,
    isMobile,
    isPulsing,
    isTargetLoading,
    isAnchorTopMobile,
    desktopPlacement,
    desktopCardStyle,
  } = useSpotlightTargetRect({
    isDemoActive,
    activeTrack,
    currentStepIndex,
    currentStep,
    currentRoute,
    motionLevel,
    cardRef,
  });

  const handleClose = useCallback(() => {
    restoreFocus();
    endDemo();
    const currentSearch = location?.search ?? "";
    if (currentSearch.includes("novo=") || currentSearch.includes("racha_modal=")) {
      const cleanParams = new URLSearchParams(currentSearch);
      INVASIVE_DEMO_QUERY_KEYS.forEach((key) => cleanParams.delete(key));
      const cleanSearch = cleanParams.toString();
      navigate(`${location?.pathname ?? "/"}${cleanSearch ? `?${cleanSearch}` : ""}`, {
        replace: true,
      });
    }
    onClose?.();
  }, [location.pathname, location.search, navigate, onClose, restoreFocus]);

  const handleStartRealAccount = useCallback(() => {
    restoreFocus();
    if (activeTrack) markTourCompleted(activeTrack);
    endDemo();
    if (onClose) {
      onClose();
      return;
    }
    const handoffInfo = isLastStep ? getBlockHandoffInfo(activeTrack) : null;
    const destination =
      handoffInfo?.actionDestination ??
      getTourHandoffDestination(activeTrack, `${location.pathname}${location.search ?? ""}`);
    navigate(destination);
  }, [activeTrack, isLastStep, location.pathname, location.search, navigate, onClose, restoreFocus]);

  const handleStartNextBlock = useCallback(
    (nextTrackId: AnyTourTrackId) => {
      if (activeTrack) markTourCompleted(activeTrack);
      const firstStep = getTourSteps(nextTrackId)[0];
      startDemo(nextTrackId);
      if (firstStep?.targetRoute) navigate(firstStep.targetRoute);
    },
    [activeTrack, navigate],
  );

  const navigateStep = useCallback(
    (targetStep: (typeof steps)[number] | undefined) => {
      if (!targetStep) return;
      if (targetStep.targetRoute !== currentStep?.targetRoute) {
        const container = document.getElementById("main-content");
        if (container && targetStep.targetSelector !== '[data-tour="settings-support-card"]') {
          container.scrollTop = 0;
        }
      }
      navigate(targetStep.targetRoute);
    },
    [currentStep?.targetRoute, navigate],
  );

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      const nextIndex = currentStepIndex + 1;
      goToNextStep();
      navigateStep(steps[nextIndex]);
      onNextStep?.(nextIndex);
    } else {
      handleStartRealAccount();
    }
  }, [currentStepIndex, handleStartRealAccount, isLastStep, navigateStep, onNextStep, steps]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      const prevIndex = Math.max(0, currentStepIndex - 1);
      goToPrevStep();
      navigateStep(steps[prevIndex]);
      onPrevStep?.(prevIndex);
    }
  }, [currentStepIndex, isFirstStep, navigateStep, onPrevStep, steps]);

  const handleGoToStep = useCallback(
    (index: number) => {
      if (index === currentStepIndex || index < 0 || index >= steps.length) return;
      triggerSensory("selection");
      setStepIndex(index);
      navigateStep(steps[index]);
      if (index > currentStepIndex) onNextStep?.(index);
      else onPrevStep?.(index);
    },
    [currentStepIndex, navigateStep, onNextStep, onPrevStep, steps],
  );

  useSpotlightFocusKeyboard({
    isDemoActive,
    stepId: currentStep?.id,
    cardRef,
    previousActiveElementRef,
    restoreFocus,
    onClose: handleClose,
    onNext: handleNext,
    onPrev: handlePrev,
  });

  if (!isDemoActive || !activeTrack || !currentStep) return null;

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 420;
  const effectiveCardWidth = isMobile ? viewportWidth - 24 : Math.min(420, viewportWidth - 32);

  return (
    <div role="dialog" aria-modal="true" aria-label="Tour guiado interativo" data-tour-spotlight-root="true" className="fixed inset-0 z-floating-tools overflow-hidden select-none">
      <SpotlightSvgMask rect={rect} isTargetLoading={isTargetLoading} isPulsing={isPulsing} motionLevel={motionLevel} />
      <SpotlightStepCard
        cardRef={cardRef}
        steps={steps}
        currentStep={currentStep}
        currentStepIndex={currentStepIndex}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        isMobile={isMobile}
        isAnchorTopMobile={isAnchorTopMobile}
        isNarrowCard={effectiveCardWidth < 400}
        desktopPlacement={desktopPlacement}
        desktopCardStyle={desktopCardStyle}
        trackLabel={getTourTrackCategoryLabel(activeTrack)}
        blockHandoff={isLastStep ? getBlockHandoffInfo(activeTrack) : null}
        motionLevel={motionLevel}
        className={className}
        onPrev={handlePrev}
        onNext={handleNext}
        onGoToStep={handleGoToStep}
        onClose={handleClose}
        onStartRealAccount={handleStartRealAccount}
        onStartNextBlock={handleStartNextBlock}
      />
    </div>
  );
}
