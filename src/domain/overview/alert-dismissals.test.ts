import { describe, expect, it } from "vitest";
import {
  createGoalDismissalCheckpoint,
  createPaceDismissalCheckpoint,
  createSurplusDismissalCheckpoint,
  createZeroGuiltDismissalCheckpoint,
  shouldShowGoalAlert,
  shouldShowPaceAlert,
  shouldShowSurplusAlert,
  shouldShowZeroGuiltAlert,
  type GoalAlertEvaluation,
} from "./alert-dismissals";

describe("alert-dismissals (Motor Puro de Elegibilidade e Descarte de Alertas)", () => {
  describe("shouldShowGoalAlert", () => {
    const baseGoal: GoalAlertEvaluation = {
      goalId: "goal-1",
      currentCents: 100000,
      targetCents: 100000,
      percentage: 100,
      stage: "completed",
      status: "in_progress",
    };

    it("retorna true quando a meta nunca foi dispensada (sem checkpoint)", () => {
      expect(shouldShowGoalAlert(null, baseGoal)).toBe(true);
      expect(shouldShowGoalAlert(undefined, baseGoal)).toBe(true);
    });

    it("mantém dispensada meta 100% batida quando nada relevante mudou", () => {
      const checkpoint = createGoalDismissalCheckpoint(baseGoal);
      expect(shouldShowGoalAlert(checkpoint, baseGoal)).toBe(false);
    });

    it("reativa o alerta quando o saldo acumulado muda (novo aporte ou resgate)", () => {
      const checkpoint = createGoalDismissalCheckpoint(baseGoal);

      // Usuário aportou mais R$ 50
      const afterDeposit: GoalAlertEvaluation = {
        ...baseGoal,
        currentCents: 105000,
      };
      expect(shouldShowGoalAlert(checkpoint, afterDeposit)).toBe(true);

      // Usuário retirou R$ 200
      const afterWithdraw: GoalAlertEvaluation = {
        ...baseGoal,
        currentCents: 80000,
        percentage: 80,
        stage: "final_stretch",
      };
      expect(shouldShowGoalAlert(checkpoint, afterWithdraw)).toBe(true);
    });

    it("reativa o alerta quando o valor alvo (targetCents) é redefinido", () => {
      const checkpoint = createGoalDismissalCheckpoint(baseGoal);
      const afterTargetChange: GoalAlertEvaluation = {
        ...baseGoal,
        targetCents: 200000,
        percentage: 50,
        stage: "regular",
      };
      expect(shouldShowGoalAlert(checkpoint, afterTargetChange)).toBe(true);
    });

    it("reativa o alerta quando a meta atinge o marco de 100% batido", () => {
      const inFinalStretch: GoalAlertEvaluation = {
        goalId: "goal-2",
        currentCents: 85000,
        targetCents: 100000,
        percentage: 85,
        stage: "final_stretch",
      };
      const checkpoint = createGoalDismissalCheckpoint(inFinalStretch);

      // Bateu 100%
      const completedGoal: GoalAlertEvaluation = {
        ...inFinalStretch,
        currentCents: 100000,
        percentage: 100,
        stage: "completed",
      };
      expect(shouldShowGoalAlert(checkpoint, completedGoal)).toBe(true);
    });

    it("reativa o alerta quando a meta entra na reta final (>= 80%)", () => {
      const regularGoal: GoalAlertEvaluation = {
        goalId: "goal-3",
        currentCents: 50000,
        targetCents: 100000,
        percentage: 50,
        stage: "regular",
      };
      const checkpoint = createGoalDismissalCheckpoint(regularGoal);

      const enteredFinalStretch: GoalAlertEvaluation = {
        ...regularGoal,
        currentCents: 82000,
        percentage: 82,
        stage: "final_stretch",
      };
      expect(shouldShowGoalAlert(checkpoint, enteredFinalStretch)).toBe(true);
    });

    it("reativa o alerta quando o status da meta é alterado", () => {
      const checkpoint = createGoalDismissalCheckpoint({
        ...baseGoal,
        status: "in_progress",
      });
      const updatedStatus: GoalAlertEvaluation = {
        ...baseGoal,
        status: "paused",
      };
      expect(shouldShowGoalAlert(checkpoint, updatedStatus)).toBe(true);
    });
  });

  describe("shouldShowPaceAlert", () => {
    const basePace = {
      month: "2026-11",
      spentPercent: 70,
      surplusCents: 50000,
    };

    it("retorna true quando não há checkpoint", () => {
      expect(shouldShowPaceAlert(null, basePace)).toBe(true);
    });

    it("mantém dispensado quando ritmo e superávit permanecem estáveis", () => {
      const checkpoint = createPaceDismissalCheckpoint(basePace);
      expect(shouldShowPaceAlert(checkpoint, { ...basePace, spentPercent: 72 })).toBe(false);
    });

    it("reativa na virada de mês", () => {
      const checkpoint = createPaceDismissalCheckpoint(basePace);
      expect(shouldShowPaceAlert(checkpoint, { ...basePace, month: "2026-12" })).toBe(true);
    });

    it("reativa quando entra em déficit projetado", () => {
      const checkpoint = createPaceDismissalCheckpoint(basePace);
      expect(shouldShowPaceAlert(checkpoint, { ...basePace, surplusCents: -5000 })).toBe(true);
    });

    it("reativa quando ritmo de gastos piora em 5% ou mais", () => {
      const checkpoint = createPaceDismissalCheckpoint(basePace);
      expect(shouldShowPaceAlert(checkpoint, { ...basePace, spentPercent: 75 })).toBe(true);
    });
  });

  describe("shouldShowSurplusAlert", () => {
    const baseSurplus = {
      month: "2026-11",
      surplusCents: 150000, // R$ 1.500,00
    };

    it("retorna true quando não há checkpoint", () => {
      expect(shouldShowSurplusAlert(null, baseSurplus)).toBe(true);
    });

    it("mantém dispensado para variações pequenas de sobra (< R$ 50)", () => {
      const checkpoint = createSurplusDismissalCheckpoint(baseSurplus);
      expect(
        shouldShowSurplusAlert(checkpoint, {
          ...baseSurplus,
          surplusCents: 152000, // +R$ 20
        }),
      ).toBe(false);
    });

    it("reativa na virada de mês", () => {
      const checkpoint = createSurplusDismissalCheckpoint(baseSurplus);
      expect(shouldShowSurplusAlert(checkpoint, { ...baseSurplus, month: "2026-12" })).toBe(true);
    });

    it("reativa quando a sobra varia em R$ 50,00 ou mais", () => {
      const checkpoint = createSurplusDismissalCheckpoint(baseSurplus);
      expect(
        shouldShowSurplusAlert(checkpoint, {
          ...baseSurplus,
          surplusCents: 156000, // +R$ 60
        }),
      ).toBe(true);
    });
  });

  describe("shouldShowZeroGuiltAlert", () => {
    it("retorna true quando não há checkpoint", () => {
      expect(shouldShowZeroGuiltAlert(null, "2026-11-08")).toBe(true);
    });

    it("mantém dispensado no mesmo dia", () => {
      const checkpoint = createZeroGuiltDismissalCheckpoint("2026-11-08");
      expect(shouldShowZeroGuiltAlert(checkpoint, "2026-11-08")).toBe(false);
    });

    it("reativa em um novo dia", () => {
      const checkpoint = createZeroGuiltDismissalCheckpoint("2026-11-08");
      expect(shouldShowZeroGuiltAlert(checkpoint, "2026-11-09")).toBe(true);
    });
  });
});
