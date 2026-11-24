import { describe, expect, it } from "vitest";
import {
  advanceSmartDecay,
  applyHomeCarouselAttentionBudget,
  DEFAULT_ATTENTION_BUDGET_POLICY,
  isFamilyUnderDecay,
  muteInsightFamily,
  resolveInsightThemeFamily,
  resolveThemeFamily,
  selectOperationalHomeBanner,
  unmuteInsightFamily,
} from "./attention-budget";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("attention-budget (Governança de Atenção & Smart Decay)", () => {
  describe("applyHomeCarouselAttentionBudget", () => {
    it("respeita silêncio intencional quando não há alertas elegíveis", () => {
      const res = applyHomeCarouselAttentionBudget([]);
      expect(res.visibleItems).toEqual([]);
      expect(res.hiddenCount).toBe(0);
      expect(res.focusedCriticalMode).toBe(false);
      expect(res.isSilent).toBe(true);
    });

    it("limita a no máximo 2 slides por padrão quando há 5 alertas elegíveis", () => {
      const items = [
        { id: "surplus", priority: 4 },
        { id: "pace", priority: 2 },
        { id: "goal-1", priority: 3 },
        { id: "advisor-1", priority: 2.5 },
        { id: "trial", priority: 4 },
      ];

      const res = applyHomeCarouselAttentionBudget(items);
      expect(DEFAULT_ATTENTION_BUDGET_POLICY.homeMaxCards).toBe(2);
      expect(res.focusedCriticalMode).toBe(false);
      expect(res.isSilent).toBe(false);
      expect(res.visibleItems.map((i) => i.id)).toEqual(["pace", "advisor-1"]);
      expect(res.hiddenCount).toBe(3);
    });

    it("ativa modo focado (1 único slide) quando há alerta crítico P0 (priority <= 1)", () => {
      const items = [
        { id: "surplus", priority: 4 },
        { id: "cash-gap-critical", priority: 1 },
        { id: "pace", priority: 2 },
        { id: "goal-1", priority: 3 },
      ];

      const res = applyHomeCarouselAttentionBudget(items);
      expect(res.focusedCriticalMode).toBe(true);
      expect(res.visibleItems.map((i) => i.id)).toEqual(["cash-gap-critical"]);
      expect(res.hiddenCount).toBe(3);
    });

    it("considera subscription-past-due (priority 0) como foco único crítico P0", () => {
      const items = [
        { id: "onboarding", priority: 2 },
        { id: "subscription-past-due", priority: 0 },
      ];

      const res = applyHomeCarouselAttentionBudget(items);
      expect(res.focusedCriticalMode).toBe(true);
      expect(res.visibleItems.map((i) => i.id)).toEqual(["subscription-past-due"]);
    });
  });

  describe("selectOperationalHomeBanner", () => {
    it("coordena os 4 banners fora do carrossel priorizando auto_registered > pending_split_signals > pending_suggestions > pix_clipboard", () => {
      const fullPlan = selectOperationalHomeBanner([
        { kind: "pix_clipboard", active: true },
        { kind: "pending_suggestions", active: true },
        { kind: "pending_split_signals", active: true },
        { kind: "auto_registered", active: true },
      ]);

      expect(fullPlan.visibleKinds).toEqual(["auto_registered"]);
      expect(fullPlan.deferredKinds).toEqual([
        "pending_split_signals",
        "pending_suggestions",
        "pix_clipboard",
      ]);
      expect(fullPlan.deferredCount).toBe(3);

      const splitVsSuggestions = selectOperationalHomeBanner([
        { kind: "auto_registered", active: false },
        { kind: "pending_suggestions", active: true },
        { kind: "pending_split_signals", active: true },
        { kind: "pix_clipboard", active: true },
      ]);
      expect(splitVsSuggestions.visibleKinds).toEqual(["pending_split_signals"]);
      expect(splitVsSuggestions.deferredCount).toBe(2);
    });
  });

  describe("Smart Decay (7d -> 30d -> 90d -> pausa)", () => {
    it("evolui progressivamente 7d -> 30d -> 90d e sinaliza shouldOfferMute na 3a dispensa", () => {
      const t0 = Date.parse("2026-08-01T12:00:00Z");

      const first = advanceSmartDecay(null, t0);
      expect(first.nextCooldownDays).toBe(7);
      expect(first.record.dismissCount).toBe(1);
      expect(first.record.dismissedUntil).toBe(t0 + 7 * DAY_MS);
      expect(first.shouldOfferMute).toBe(false);
      expect(isFamilyUnderDecay(first.record, t0 + 3 * DAY_MS)).toBe(true);
      expect(isFamilyUnderDecay(first.record, t0 + 8 * DAY_MS)).toBe(false);

      const t1 = t0 + 8 * DAY_MS;
      const second = advanceSmartDecay(first.record, t1);
      expect(second.nextCooldownDays).toBe(30);
      expect(second.record.dismissCount).toBe(2);
      expect(second.record.dismissedUntil).toBe(t1 + 30 * DAY_MS);
      expect(second.shouldOfferMute).toBe(false);

      const t2 = t1 + 31 * DAY_MS;
      const third = advanceSmartDecay(second.record, t2);
      expect(third.nextCooldownDays).toBe(90);
      expect(third.record.dismissCount).toBe(3);
      expect(third.record.dismissedUntil).toBe(t2 + 90 * DAY_MS);
      expect(third.shouldOfferMute).toBe(true);

      const muted = muteInsightFamily(third.record, t2);
      expect(muted.muted).toBe(true);
      expect(isFamilyUnderDecay(muted, t2 + 365 * DAY_MS)).toBe(true);

      const unmuted = unmuteInsightFamily(muted, t2 + 10 * DAY_MS);
      expect(unmuted.muted).toBe(false);
      expect(unmuted.dismissCount).toBe(0);
      expect(isFamilyUnderDecay(unmuted, t2 + 10 * DAY_MS)).toBe(false);
    });
  });

  describe("resolução unificada de família (resolveInsightThemeFamily === resolveThemeFamily)", () => {
    it("mapeia de forma idêntica todos os prefixos sem colidir dup:* em pace", () => {
      const keys = [
        "dup:netflix",
        "dup:sub:spotify",
        "savings:streaming",
        "charges:drain",
        "annual:ipva",
        "annual_commit:iptu",
        "weekly:feira",
        "due_today:aluguel",
        "calib_tx:123",
        "calib:academia",
        "income_goal:cat-1",
        "aporte:rebalance",
        "celebration:real_savings",
        "household:ceiling_exceeded",
      ];

      for (const k of keys) {
        expect(resolveInsightThemeFamily(k)).toBe(resolveThemeFamily(k));
      }

      expect(resolveInsightThemeFamily("dup:netflix")).toBe("savings_cut");
      expect(resolveInsightThemeFamily("dup:netflix")).not.toBe("pace");
      expect(resolveInsightThemeFamily("annual:ipva")).toBe("annual_commitment");
      expect(resolveInsightThemeFamily("annual_commit:iptu")).toBe("annual_commitment");
      expect(resolveInsightThemeFamily("weekly:feira")).toBe("habit");
      expect(resolveInsightThemeFamily("due_today:aluguel")).toBe("missing_expense");
      expect(resolveInsightThemeFamily("household:ceiling_exceeded")).toBe("habit");
    });
  });
});
