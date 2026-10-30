import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  endDemo,
  getDemoSessionState,
  goToNextStep,
  goToPrevStep,
  hasCompletedDemoTour,
  hasSeenWelcomeModal,
  hasSeenNativeOnboarding,
  markTourCompleted,
  markWelcomeModalSeen,
  markNativeOnboardingSeen,
  resetDemoSession,
  resetDemoTourStorage,
  setStepIndex,
  startDemo,
  useDemoSession,
} from "./index";

describe("demo-session-store — Máquina de Estados da Simulação & Storage (Fase 2)", () => {
  beforeEach(() => {
    resetDemoSession();
    resetDemoTourStorage();
  });

  describe("Operações síncronas do Store", () => {
    it("inicia com estado padrão inativo", () => {
      const state = getDemoSessionState();
      expect(state.isDemoActive).toBe(false);
      expect(state.activeTrack).toBeNull();
      expect(state.currentStepIndex).toBe(0);
    });

    it("startDemo ativa o modo de demonstração com a trilha escolhida no passo 0", () => {
      startDemo("finances");
      const state = getDemoSessionState();
      expect(state.isDemoActive).toBe(true);
      expect(state.activeTrack).toBe("finances");
      expect(state.currentStepIndex).toBe(0);
    });

    it("goToNextStep avança passos e trava no limite máximo da trilha", () => {
      startDemo("finances"); // 4 passos (índices 0, 1, 2, 3)

      goToNextStep();
      expect(getDemoSessionState().currentStepIndex).toBe(1);

      goToNextStep();
      expect(getDemoSessionState().currentStepIndex).toBe(2);

      goToNextStep();
      expect(getDemoSessionState().currentStepIndex).toBe(3);

      // Trava no último índice
      goToNextStep();
      expect(getDemoSessionState().currentStepIndex).toBe(3);
    });

    it("goToPrevStep retrocede passos e trava no índice 0", () => {
      startDemo("finances");
      goToNextStep();
      goToNextStep();
      expect(getDemoSessionState().currentStepIndex).toBe(2);

      goToPrevStep();
      expect(getDemoSessionState().currentStepIndex).toBe(1);

      goToPrevStep();
      expect(getDemoSessionState().currentStepIndex).toBe(0);

      // Trava no índice 0
      goToPrevStep();
      expect(getDemoSessionState().currentStepIndex).toBe(0);
    });

    it("setStepIndex posiciona em índice arbitrário com clamping seguro", () => {
      startDemo("investments"); // 3 passos (índices 0, 1, 2)

      setStepIndex(2);
      expect(getDemoSessionState().currentStepIndex).toBe(2);

      // Clamping superior
      setStepIndex(10);
      expect(getDemoSessionState().currentStepIndex).toBe(2);

      // Clamping inferior
      setStepIndex(-3);
      expect(getDemoSessionState().currentStepIndex).toBe(0);
    });

    it("endDemo encerra o modo demo e restaura o estado padrão", () => {
      startDemo("investments");
      goToNextStep();
      expect(getDemoSessionState().isDemoActive).toBe(true);

      endDemo();
      const state = getDemoSessionState();
      expect(state.isDemoActive).toBe(false);
      expect(state.activeTrack).toBeNull();
      expect(state.currentStepIndex).toBe(0);
    });
  });

  describe("Hook reativo useDemoSession", () => {
    it("reflete reativamente o ciclo de vida da simulação", () => {
      const { result } = renderHook(() => useDemoSession());

      expect(result.current.isDemoActive).toBe(false);
      expect(result.current.currentStep).toBeNull();
      expect(result.current.totalSteps).toBe(0);

      // Inicia trilha de investimentos (3 passos)
      act(() => {
        result.current.startDemo("investments");
      });

      expect(result.current.isDemoActive).toBe(true);
      expect(result.current.activeTrack).toBe("investments");
      expect(result.current.totalSteps).toBe(3);
      expect(result.current.isFirstStep).toBe(true);
      expect(result.current.isLastStep).toBe(false);
      expect(result.current.currentStep?.id).toBe("investments-overview");

      // Avança até o último passo
      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.currentStepIndex).toBe(1);
      expect(result.current.isFirstStep).toBe(false);
      expect(result.current.isLastStep).toBe(false);

      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.currentStepIndex).toBe(2);
      expect(result.current.isFirstStep).toBe(false);
      expect(result.current.isLastStep).toBe(true);

      // Encerra a simulação
      act(() => {
        result.current.endDemo();
      });
      expect(result.current.isDemoActive).toBe(false);
      expect(result.current.activeTrack).toBeNull();
    });
  });

  describe("Helpers de armazenamento localStorage", () => {
    it("gerencia o estado de conclusão de trilhas de tour", () => {
      expect(hasCompletedDemoTour()).toBe(false);
      expect(hasCompletedDemoTour("finances")).toBe(false);
      expect(hasCompletedDemoTour("investments")).toBe(false);

      markTourCompleted("finances");
      expect(hasCompletedDemoTour("finances")).toBe(true);
      expect(hasCompletedDemoTour("investments")).toBe(false);
      expect(hasCompletedDemoTour()).toBe(true);

      markTourCompleted("investments");
      expect(hasCompletedDemoTour("investments")).toBe(true);

      resetDemoTourStorage();
      expect(hasCompletedDemoTour()).toBe(false);
    });

    it("gerencia a exibição do modal de boas-vindas", () => {
      expect(hasSeenWelcomeModal()).toBe(false);

      markWelcomeModalSeen();
      expect(hasSeenWelcomeModal()).toBe(true);

      resetDemoTourStorage();
      expect(hasSeenWelcomeModal()).toBe(false);
    });

    it("gerencia a exibição do onboarding de recursos nativos do APK", () => {
      expect(hasSeenNativeOnboarding()).toBe(false);

      markNativeOnboardingSeen();
      expect(hasSeenNativeOnboarding()).toBe(true);

      resetDemoTourStorage();
      expect(hasSeenNativeOnboarding()).toBe(false);
    });
  });
});
