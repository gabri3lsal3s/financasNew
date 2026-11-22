import { describe, expect, it } from "vitest";
import {
  createGoalDismissalCheckpoint,
  createPaceDismissalCheckpoint,
  createSurplusDismissalCheckpoint,
  createTimedDismissalCheckpoint,
  createZeroGuiltDismissalCheckpoint,
  isTimedAlertDismissed,
  shouldShowGoalAlert,
  shouldShowPaceAlert,
  shouldShowSurplusAlert,
  shouldShowTrialBanner,
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

    it("reativa quando ritmo de gastos piora em 5% ou mais no modo legado", () => {
      const checkpoint = createPaceDismissalCheckpoint(basePace);
      expect(shouldShowPaceAlert(checkpoint, { ...basePace, spentPercent: 75 })).toBe(true);
    });

    it("respeita o período de 7 dias de dispensa mesmo com aumento no ritmo de gastos", () => {
      const checkpoint = createPaceDismissalCheckpoint(basePace, 7, "2026-11-01T12:00:00Z");
      // 3 dias depois: ritmo piorou de 70% para 78%, mas ainda dentro dos 7 dias
      expect(
        shouldShowPaceAlert(checkpoint, { ...basePace, spentPercent: 78 }, {
          nowMs: new Date("2026-11-04T12:00:00Z").getTime(),
        }),
      ).toBe(false);

      // 8 dias depois: expirou o período de 7 dias e ritmo continua acelerado -> reexibe!
      expect(
        shouldShowPaceAlert(checkpoint, { ...basePace, spentPercent: 78 }, {
          nowMs: new Date("2026-11-09T13:00:00Z").getTime(),
        }),
      ).toBe(true);
    });

    it("respeita o período de 30 dias de dispensa", () => {
      const checkpoint = createPaceDismissalCheckpoint(basePace, 30, "2026-11-01T12:00:00Z");
      // 25 dias depois dentro do mesmo mês: continua silenciado
      expect(
        shouldShowPaceAlert(checkpoint, { ...basePace, spentPercent: 80 }, {
          nowMs: new Date("2026-11-26T12:00:00Z").getTime(),
        }),
      ).toBe(false);

      // 31 dias depois: expirou os 30 dias
      expect(
        shouldShowPaceAlert(checkpoint, { ...basePace, spentPercent: 80 }, {
          nowMs: new Date("2026-12-02T13:00:00Z").getTime(),
        }),
      ).toBe(true);
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

    it("reativa quando a sobra varia em R$ 50,00 ou mais no modo legado", () => {
      const checkpoint = createSurplusDismissalCheckpoint(baseSurplus);
      expect(
        shouldShowSurplusAlert(checkpoint, {
          ...baseSurplus,
          surplusCents: 156000, // +R$ 60
        }),
      ).toBe(true);
    });

    it("respeita o período de 7 dias de dispensa mesmo com grande variação de sobra", () => {
      const checkpoint = createSurplusDismissalCheckpoint(baseSurplus, 7, "2026-11-01T12:00:00Z");
      // 4 dias depois: sobra variou R$ 100, mas está dentro dos 7 dias
      expect(
        shouldShowSurplusAlert(checkpoint, {
          ...baseSurplus,
          surplusCents: 160000,
        }, {
          nowMs: new Date("2026-11-05T12:00:00Z").getTime(),
        }),
      ).toBe(false);

      // 8 dias depois: expirou o período de 7 dias
      expect(
        shouldShowSurplusAlert(checkpoint, {
          ...baseSurplus,
          surplusCents: 160000,
        }, {
          nowMs: new Date("2026-11-09T13:00:00Z").getTime(),
        }),
      ).toBe(true);
    });

    it("respeita o período de 30 dias de dispensa da sobra", () => {
      const checkpoint = createSurplusDismissalCheckpoint(baseSurplus, 30, "2026-11-01T12:00:00Z");
      // 20 dias depois
      expect(
        shouldShowSurplusAlert(checkpoint, {
          ...baseSurplus,
          surplusCents: 200000,
        }, {
          nowMs: new Date("2026-11-21T12:00:00Z").getTime(),
        }),
      ).toBe(false);

      // 31 dias depois
      expect(
        shouldShowSurplusAlert(checkpoint, {
          ...baseSurplus,
          surplusCents: 200000,
        }, {
          nowMs: new Date("2026-12-02T13:00:00Z").getTime(),
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

  describe("createTimedDismissalCheckpoint e isTimedAlertDismissed", () => {
    it("mantém card dispensado durante 7 dias e reativa após expirar", () => {
      const now = new Date("2026-11-01T12:00:00Z").getTime();
      const checkpoint = createTimedDismissalCheckpoint(7, now);

      expect(isTimedAlertDismissed(checkpoint, now + 6 * 24 * 60 * 60 * 1000)).toBe(true);
      expect(isTimedAlertDismissed(checkpoint, now + 7 * 24 * 60 * 60 * 1000 + 1)).toBe(false);
    });

    it("mantém card dispensado durante 30 dias e reativa após expirar", () => {
      const now = new Date("2026-11-01T12:00:00Z").getTime();
      const checkpoint = createTimedDismissalCheckpoint(30, now);

      expect(isTimedAlertDismissed(checkpoint, now + 29 * 24 * 60 * 60 * 1000)).toBe(true);
      expect(isTimedAlertDismissed(checkpoint, now + 30 * 24 * 60 * 60 * 1000 + 1)).toBe(false);
    });
  });

  describe("shouldShowTrialBanner", () => {
    it("oculta quando há cobrança automática ativa ou daysRemaining é null", () => {
      expect(shouldShowTrialBanner(15, true, null)).toBe(false);
      expect(shouldShowTrialBanner(null, false, null)).toBe(false);
    });

    it("respeita dispensa de 7d/30d quando faltam mais de 3 dias", () => {
      const now = new Date("2026-11-01T12:00:00Z").getTime();
      const checkpoint = createTimedDismissalCheckpoint(7, now);

      expect(shouldShowTrialBanner(15, false, checkpoint, now + 2 * 24 * 60 * 60 * 1000)).toBe(
        false,
      );
      expect(shouldShowTrialBanner(15, false, checkpoint, now + 8 * 24 * 60 * 60 * 1000)).toBe(
        true,
      );
    });

    it("reativa obrigatoriamente na janela crítica (<= 3 dias) mesmo se dispensado antes", () => {
      const now = new Date("2026-11-01T12:00:00Z").getTime();
      const checkpoint = createTimedDismissalCheckpoint(30, now);

      expect(shouldShowTrialBanner(3, false, checkpoint, now + 1000)).toBe(true);
      expect(shouldShowTrialBanner(1, false, checkpoint, now + 1000)).toBe(true);
      expect(shouldShowTrialBanner(0, false, checkpoint, now + 1000)).toBe(true);
    });
  });
});
