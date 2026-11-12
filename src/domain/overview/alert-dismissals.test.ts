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

    it("mantém dispensada meta 100% batida quando nada relevante mudou dentro do cooldown", () => {
      const checkpoint = createGoalDismissalCheckpoint(baseGoal, "2026-11-01T12:00:00Z");
      expect(
        shouldShowGoalAlert(checkpoint, baseGoal, {
          nowIso: "2026-11-05T12:00:00Z",
        }),
      ).toBe(false);
    });

    it("protege contra oscilações de saldo diário e centavos dentro do cooldown de 30 dias", () => {
      const regularGoal: GoalAlertEvaluation = {
        goalId: "goal-invest",
        currentCents: 1825164,
        targetCents: 5000000,
        percentage: 37,
        stage: "regular",
        status: "in_progress",
      };
      const checkpoint = createGoalDismissalCheckpoint(regularGoal, "2026-11-01T10:00:00Z");

      // Variação de centavos no dia seguinte (ex: rendimento ou despesa de cafezinho)
      const nextDayWithCentDiff: GoalAlertEvaluation = {
        ...regularGoal,
        currentCents: 1825180,
      };
      expect(
        shouldShowGoalAlert(checkpoint, nextDayWithCentDiff, {
          nowIso: "2026-11-02T10:00:00Z",
        }),
      ).toBe(false);

      // 10 dias depois com variação moderada de saldo: continua silenciado
      const tenDaysLater: GoalAlertEvaluation = {
        ...regularGoal,
        currentCents: 1950000,
        percentage: 39,
      };
      expect(
        shouldShowGoalAlert(checkpoint, tenDaysLater, {
          nowIso: "2026-11-11T10:00:00Z",
        }),
      ).toBe(false);
    });

    it("reativa o alerta após expirar a janela de cooldown (ex: 30 dias)", () => {
      const regularGoal: GoalAlertEvaluation = {
        goalId: "goal-invest",
        currentCents: 1825164,
        targetCents: 5000000,
        percentage: 37,
        stage: "regular",
        status: "in_progress",
      };
      const checkpoint = createGoalDismissalCheckpoint(regularGoal, "2026-10-01T10:00:00Z");

      // 31 dias depois: cooldown expirou, retorna true como check-in mensal
      expect(
        shouldShowGoalAlert(checkpoint, regularGoal, {
          nowIso: "2026-11-02T10:00:00Z",
        }),
      ).toBe(true);
    });

    it("reativa o alerta quando o valor alvo (targetCents) é redefinido mesmo dentro do cooldown", () => {
      const checkpoint = createGoalDismissalCheckpoint(baseGoal, "2026-11-01T12:00:00Z");
      const afterTargetChange: GoalAlertEvaluation = {
        ...baseGoal,
        targetCents: 200000,
        percentage: 50,
        stage: "regular",
      };
      expect(
        shouldShowGoalAlert(checkpoint, afterTargetChange, {
          nowIso: "2026-11-05T12:00:00Z",
        }),
      ).toBe(true);
    });

    it("reativa o alerta imediatamente quando a meta atinge 100% batido (celebração fura cooldown)", () => {
      const inFinalStretch: GoalAlertEvaluation = {
        goalId: "goal-2",
        currentCents: 85000,
        targetCents: 100000,
        percentage: 85,
        stage: "final_stretch",
      };
      const checkpoint = createGoalDismissalCheckpoint(inFinalStretch, "2026-11-01T12:00:00Z");

      // Bateu 100%
      const completedGoal: GoalAlertEvaluation = {
        ...inFinalStretch,
        currentCents: 100000,
        percentage: 100,
        stage: "completed",
      };
      expect(
        shouldShowGoalAlert(checkpoint, completedGoal, {
          nowIso: "2026-11-05T12:00:00Z",
        }),
      ).toBe(true);
    });

    it("reativa o alerta quando a meta entra na reta final (>= 80%) a partir de estágio anterior", () => {
      const regularGoal: GoalAlertEvaluation = {
        goalId: "goal-3",
        currentCents: 50000,
        targetCents: 100000,
        percentage: 50,
        stage: "regular",
      };
      const checkpoint = createGoalDismissalCheckpoint(regularGoal, "2026-11-01T12:00:00Z");

      const enteredFinalStretch: GoalAlertEvaluation = {
        ...regularGoal,
        currentCents: 82000,
        percentage: 82,
        stage: "final_stretch",
      };
      expect(
        shouldShowGoalAlert(checkpoint, enteredFinalStretch, {
          nowIso: "2026-11-05T12:00:00Z",
        }),
      ).toBe(true);
    });

    it("reativa o alerta quando o status da meta é alterado", () => {
      const checkpoint = createGoalDismissalCheckpoint(
        {
          ...baseGoal,
          status: "in_progress",
        },
        "2026-11-01T12:00:00Z",
      );
      const updatedStatus: GoalAlertEvaluation = {
        ...baseGoal,
        status: "paused",
      };
      expect(
        shouldShowGoalAlert(checkpoint, updatedStatus, {
          nowIso: "2026-11-05T12:00:00Z",
        }),
      ).toBe(true);
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
