import { useSyncExternalStore } from "react";
import { getTourSteps, type TourStep, type TourTrackId } from "@/domain/demo-simulation";

export interface DemoSessionState {
  isDemoActive: boolean;
  activeTrack: TourTrackId | null;
  currentStepIndex: number;
}

const INITIAL_STATE: DemoSessionState = {
  isDemoActive: false,
  activeTrack: null,
  currentStepIndex: 0,
};

let currentState: DemoSessionState = { ...INITIAL_STATE };
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Retorna o snapshot atual do estado da sessão de demonstração. */
export function getDemoSessionState(): DemoSessionState {
  return currentState;
}

/** Inscreve um ouvinte para alterações no estado da sessão. */
export function subscribeToDemoSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Inicia o modo de demonstração com a trilha especificada. */
export function startDemo(track: TourTrackId): void {
  currentState = {
    isDemoActive: true,
    activeTrack: track,
    currentStepIndex: 0,
  };
  notify();
}

/** Encerra o modo de demonstração e restaura o estado inicial. */
export function endDemo(): void {
  currentState = { ...INITIAL_STATE };
  notify();
}

/** Avança para o próximo passo da trilha ativa, respeitando o limite máximo de passos. */
export function goToNextStep(): void {
  if (!currentState.activeTrack) return;
  const steps = getTourSteps(currentState.activeTrack);
  const nextIndex = Math.min(currentState.currentStepIndex + 1, steps.length - 1);
  if (nextIndex !== currentState.currentStepIndex) {
    currentState = {
      ...currentState,
      currentStepIndex: nextIndex,
    };
    notify();
  }
}

/** Retorna para o passo anterior da trilha ativa, sem descer abaixo do índice 0. */
export function goToPrevStep(): void {
  if (!currentState.activeTrack) return;
  const prevIndex = Math.max(currentState.currentStepIndex - 1, 0);
  if (prevIndex !== currentState.currentStepIndex) {
    currentState = {
      ...currentState,
      currentStepIndex: prevIndex,
    };
    notify();
  }
}

/** Ajusta diretamente o índice do passo dentro dos limites válidos da trilha. */
export function setStepIndex(index: number): void {
  if (!currentState.activeTrack) return;
  const steps = getTourSteps(currentState.activeTrack);
  const clampedIndex = Math.min(Math.max(0, index), Math.max(0, steps.length - 1));
  if (clampedIndex !== currentState.currentStepIndex) {
    currentState = {
      ...currentState,
      currentStepIndex: clampedIndex,
    };
    notify();
  }
}

/** Reseta completamente o estado em memória da sessão de demonstração. */
export function resetDemoSession(): void {
  currentState = { ...INITIAL_STATE };
  notify();
}

const SERVER_SNAPSHOT: DemoSessionState = { ...INITIAL_STATE };

/**
 * Hook reativo para consumo e manipulação do Modo de Simulação & Tour Guiado.
 * Opera via useSyncExternalStore sem necessidade de providers contextuais redundantes.
 */
export function useDemoSession() {
  const state = useSyncExternalStore(
    subscribeToDemoSession,
    getDemoSessionState,
    () => SERVER_SNAPSHOT,
  );

  const steps: TourStep[] = state.activeTrack ? getTourSteps(state.activeTrack) : [];
  const totalSteps = steps.length;
  const currentStep: TourStep | null =
    totalSteps > 0 && state.currentStepIndex >= 0 && state.currentStepIndex < totalSteps
      ? (steps[state.currentStepIndex] ?? null)
      : null;

  const isFirstStep = state.currentStepIndex === 0;
  const isLastStep = totalSteps > 0 && state.currentStepIndex >= totalSteps - 1;

  return {
    isDemoActive: state.isDemoActive,
    activeTrack: state.activeTrack,
    currentStepIndex: state.currentStepIndex,
    currentStep,
    steps,
    totalSteps,
    isFirstStep,
    isLastStep,
    startDemo,
    endDemo,
    goToNextStep,
    goToPrevStep,
    setStepIndex,
    resetDemoSession,
  };
}
