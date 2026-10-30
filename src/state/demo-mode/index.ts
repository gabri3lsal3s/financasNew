export type { DemoSessionState } from "./demo-session-store";

export {
  getDemoSessionState,
  subscribeToDemoSession,
  startDemo,
  endDemo,
  goToNextStep,
  goToPrevStep,
  setStepIndex,
  resetDemoSession,
  useDemoSession,
} from "./demo-session-store";

export {
  hasCompletedDemoTour,
  markTourCompleted,
  hasSeenWelcomeModal,
  markWelcomeModalSeen,
  hasSeenNativeOnboarding,
  markNativeOnboardingSeen,
  resetDemoTourStorage,
} from "./demo-storage";
