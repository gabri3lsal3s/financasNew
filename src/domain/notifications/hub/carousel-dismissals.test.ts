import { describe, expect, it } from "vitest";
import {
  computeCarouselDismissalUntil,
  createCarouselDismissalRecord,
  evaluateCarouselCardVisibility,
  listActiveCarouselDismissals,
  formatCarouselReturnDate,
  mergeCarouselDismissals,
  parseCarouselDismissalsMap,
  resolveCarouselCardPolicy,
  revokeCarouselDismissalRecord,
} from "./index";

describe("carousel-dismissals (domain)", () => {
  describe("computeCarouselDismissalUntil — calendário civil local", () => {
    it("soma 7 dias civis para preset 7d na meia-noite local", () => {
      const nov27 = new Date(2026, 10, 27, 15, 42, 10).getTime();
      const until = computeCarouselDismissalUntil(nov27, "7d");
      const expected = new Date(2026, 11, 4, 0, 0, 0, 0).getTime();
      expect(until).toBe(expected);
    });

    it("clampa 31/01 + 1m para 28/02 em ano comum (2027) e 29/02 em ano bissexto (2028)", () => {
      const jan31_2027 = new Date(2027, 0, 31, 14, 0, 0).getTime();
      expect(computeCarouselDismissalUntil(jan31_2027, "1m")).toBe(
        new Date(2027, 1, 28, 0, 0, 0, 0).getTime(),
      );

      const jan31_2028 = new Date(2028, 0, 31, 14, 0, 0).getTime();
      expect(computeCarouselDismissalUntil(jan31_2028, "1m")).toBe(
        new Date(2028, 1, 29, 0, 0, 0, 0).getTime(),
      );
    });

    it("clampa 31/08/2027 + 6m para 29/02/2028 (virada de ano + bissexto)", () => {
      const aug31_2027 = new Date(2027, 7, 31, 9, 30, 0).getTime();
      expect(computeCarouselDismissalUntil(aug31_2027, "6m")).toBe(
        new Date(2028, 1, 29, 0, 0, 0, 0).getTime(),
      );
    });

    it("trata virada de ano em 15/12/2026 + 1m -> 15/01/2027", () => {
      const dec15_2026 = new Date(2026, 11, 15, 22, 15, 0).getTime();
      expect(computeCarouselDismissalUntil(dec15_2026, "1m")).toBe(
        new Date(2027, 0, 15, 0, 0, 0, 0).getTime(),
      );
    });

    it("formata data de retorno com ano apenas quando muda de ano", () => {
      const ref2026 = new Date(2026, 10, 27, 10, 0).getTime();
      const dec4_2026 = new Date(2026, 11, 4, 0, 0).getTime();
      const jan15_2027 = new Date(2027, 0, 15, 0, 0).getTime();
      expect(formatCarouselReturnDate(dec4_2026, ref2026)).toBe("04/12");
      expect(formatCarouselReturnDate(jan15_2027, ref2026)).toBe("15/01/27");
    });
  });

  describe("mergeCarouselDismissals — convergência e desempate", () => {
    it("converge sequência 6m -> Desfazer -> 7d mesmo com resposta atrasada", () => {
      const t0 = new Date(2026, 10, 27, 10, 0, 0).getTime();
      const r6m = createCarouselDismissalRecord("6m", t0);
      const rUndo = revokeCarouselDismissalRecord(r6m, t0);
      const r7d = createCarouselDismissalRecord("7d", t0, { prevRecord: rUndo });

      expect(rUndo.revokedAt).toBeGreaterThan(r6m.dismissedAt);
      expect(r7d.dismissedAt).toBeGreaterThan(rUndo.revokedAt!);
      expect(r7d.revokedAt).toBeUndefined();

      // Chegada atrasada de r6m ou rUndo não sobrescreve r7d
      const mergedA = mergeCarouselDismissals({ "portfolio.drift": r7d }, { "portfolio.drift": r6m });
      const mergedB = mergeCarouselDismissals({ "portfolio.drift": rUndo }, { "portfolio.drift": r7d });
      expect(mergedA["portfolio.drift"]).toEqual(r7d);
      expect(mergedB["portfolio.drift"]).toEqual(r7d);
    });

    it("em empate exato de updatedAt prioriza revogação, depois maior dismissedAt/until/preset", () => {
      const active = { preset: "6m" as const, dismissedAt: 1000, dismissedUntil: 5000 };
      const revoked = { preset: "7d" as const, dismissedAt: 900, dismissedUntil: 2000, revokedAt: 1000 };
      const merged = mergeCarouselDismissals({ a: active }, { a: revoked });
      expect(merged.a).toEqual(revoked);

      const rec7d = { preset: "7d" as const, dismissedAt: 1000, dismissedUntil: 3000 };
      const rec1m = { preset: "1m" as const, dismissedAt: 1000, dismissedUntil: 3000 };
      expect(mergeCarouselDismissals({ a: rec7d }, { a: rec1m }).a).toEqual(rec1m);
    });
  });

  describe("parseCarouselDismissalsMap — validação zod na borda", () => {
    it("descarta entradas corrompidas em invalidIds e preserva válidas", () => {
      const onInvalid: string[] = [];
      const parsed = parseCarouselDismissalsMap(
        {
          "cashflow.pace": { preset: "7d", dismissedAt: 100, dismissedUntil: 200 },
          "bad.preset": { preset: "99d", dismissedAt: 100, dismissedUntil: 200 },
          "bad.nan": { preset: "1m", dismissedAt: Number.NaN, dismissedUntil: 200 },
          "bad.extra": { preset: "1m", dismissedAt: 100, dismissedUntil: 200, extra: 1 },
        },
        (id) => onInvalid.push(id),
      );

      expect(Object.keys(parsed.records)).toEqual(["cashflow.pace"]);
      expect(Array.from(parsed.invalidIds)).toEqual(["bad.preset", "bad.nan", "bad.extra"]);
      expect(onInvalid).toHaveLength(3);
    });
  });

  describe("evaluateCarouselCardVisibility — ordem única e aliases legados", () => {
    it("P0 obrigatório (past_due e trial <= 3d) ignora qualquer dispensa", () => {
      const t0 = new Date(2026, 10, 27, 10, 0).getTime();
      const rec = createCarouselDismissalRecord("1m", t0);

      expect(
        evaluateCarouselCardVisibility({
          canonicalId: "billing.past_due",
          carouselDismissals: { "billing.past_due": rec },
          nowMs: t0 + 1000,
        }),
      ).toMatchObject({ visible: true, reason: "mandatory" });

      expect(
        evaluateCarouselCardVisibility({
          canonicalId: "billing.trial_ending",
          carouselDismissals: { "billing.trial_ending": rec },
          nowMs: t0 + 1000,
          policyContext: { trialDaysRemaining: 3 },
        }),
      ).toMatchObject({ visible: true, reason: "mandatory" });

      expect(
        evaluateCarouselCardVisibility({
          canonicalId: "billing.trial_ending",
          carouselDismissals: { "billing.trial_ending": rec },
          nowMs: t0 + 1000,
          policyContext: { trialDaysRemaining: 5 },
        }),
      ).toMatchObject({ visible: false, reason: "active_canonical" });
    });

    it("registro canônico expirado ou revogado nunca cai no fallback legado", () => {
      const t0 = new Date(2026, 10, 27, 10, 0).getTime();
      const expired = createCarouselDismissalRecord("7d", t0);
      const after7d = expired.dismissedUntil;

      const evalExpired = evaluateCarouselCardVisibility({
        canonicalId: "portfolio.dividends_available",
        carouselDismissals: { "portfolio.dividends_available": expired },
        nowMs: after7d,
        legacySources: {
          portfolioAlertDismissals: {
            "available-dividends-alert": { dismissedUntil: after7d + 999999 },
          },
        },
      });
      expect(evalExpired).toMatchObject({ visible: true, reason: "expired_canonical" });

      const active = createCarouselDismissalRecord("1m", t0);
      const revoked = revokeCarouselDismissalRecord(active, t0);
      const evalRevoked = evaluateCarouselCardVisibility({
        canonicalId: "portfolio.reviews_overdue",
        carouselDismissals: { "portfolio.reviews_overdue": revoked },
        nowMs: t0 + 100,
        legacySources: {
          dashboardAlertDismissals: {
            governance: { dismissedAt: new Date(t0).toISOString(), dismissedUntil: t0 + 999999 },
          },
        },
      });
      expect(evalRevoked).toMatchObject({ visible: true, reason: "revoked" });
    });

    it("registro inválido falha aberto e bloqueia legado", () => {
      const t0 = new Date(2026, 10, 27, 10, 0).getTime();
      const res = evaluateCarouselCardVisibility({
        canonicalId: "cashflow.pace",
        invalidIds: new Set(["cashflow.pace"]),
        nowMs: t0,
        legacySources: {
          dashboardAlertDismissals: {
            pace: {
              dismissedAt: new Date(t0).toISOString(),
              dismissedUntil: t0 + 999999,
              month: "2026-11",
              spentPercent: 80,
              surplusCents: 100,
            },
          },
        },
      });
      expect(res).toMatchObject({ visible: true, reason: "invalid_fail_open" });
    });

    it("quando ausente, converte aliases legados e escolhe maior expiração legada", () => {
      const t0 = new Date(2026, 10, 27, 10, 0).getTime();
      const res = evaluateCarouselCardVisibility({
        canonicalId: "portfolio.dividends_available",
        carouselDismissals: {},
        nowMs: t0,
        legacySources: {
          dashboardAlertDismissals: {
            cards: {
              "corporate-dividends-alert": {
                dismissedAt: new Date(t0).toISOString(),
                dismissedUntil: t0 + 5000,
              },
            },
          },
          portfolioAlertDismissals: {
            "available-dividends-alert": { dismissedUntil: t0 + 15000 },
          },
        },
      });
      expect(res).toEqual({
        visible: false,
        reason: "active_legacy",
        dismissedUntil: t0 + 15000,
        source: "legacy",
      });
    });

    it("metas reabrem apenas na transição efetiva para completed e respeitam dispensa depois", () => {
      const t0 = new Date(2026, 10, 27, 10, 0).getTime();
      const openRecord = createCarouselDismissalRecord("1m", t0, { stage: "open" });

      expect(
        evaluateCarouselCardVisibility({
          canonicalId: "goals.progress.share-1",
          carouselDismissals: { "goals.progress.share-1": openRecord },
          nowMs: t0 + 1000,
          currentGoalStage: "completed",
        }),
      ).toMatchObject({ visible: true, reason: "goal_completed_transition" });

      const completedRecord = createCarouselDismissalRecord("1m", t0, {
        prevRecord: openRecord,
        stage: "completed",
      });
      expect(
        evaluateCarouselCardVisibility({
          canonicalId: "goals.progress.share-1",
          carouselDismissals: { "goals.progress.share-1": completedRecord },
          nowMs: t0 + 1000,
          currentGoalStage: "completed",
        }),
      ).toMatchObject({ visible: false, reason: "active_canonical" });
    });

    it("permissões Android avaliam cada capacidade independentemente", () => {
      const t0 = new Date(2026, 10, 27, 10, 0).getTime();
      const pushDismissed = createCarouselDismissalRecord("7d", t0);

      expect(
        evaluateCarouselCardVisibility({
          canonicalId: "device.permissions.push_due",
          carouselDismissals: { "device.permissions.push_due": pushDismissed },
          nowMs: t0 + 1000,
        }).visible,
      ).toBe(false);

      expect(
        evaluateCarouselCardVisibility({
          canonicalId: "device.permissions.bank_listener",
          carouselDismissals: { "device.permissions.push_due": pushDismissed },
          nowMs: t0 + 1000,
        }).visible,
      ).toBe(true);
    });
  });

  describe("resolveCarouselCardPolicy", () => {
    it("atribui presets 7d/1m/6m para estruturais/governança e 7d/1m para táticos", () => {
      expect(resolveCarouselCardPolicy("cashflow.pace").allowedPresets).toEqual(["7d", "1m"]);
      expect(resolveCarouselCardPolicy("portfolio.risk.single_asset.PETR4").allowedPresets).toEqual([
        "7d",
        "1m",
        "6m",
      ]);
      expect(resolveCarouselCardPolicy("advisor.subs:netflix").allowedPresets).toEqual([
        "7d",
        "1m",
        "6m",
      ]);
      expect(resolveCarouselCardPolicy("billing.past_due").allowedPresets).toEqual([]);
    });
  });

  describe("listActiveCarouselDismissals", () => {
    it("alinha chaves legadas de dashboard, carteira e permissões e deduplica aliases irmãos", () => {
      const t0 = new Date(2026, 10, 27, 10, 0).getTime();
      const future = t0 + 7 * 86_400_000;

      const entries = listActiveCarouselDismissals({
        nowMs: t0,
        carouselDismissals: {
          "portfolio.governance_review": createCarouselDismissalRecord("7d", t0),
          "portfolio.reviews_overdue": createCarouselDismissalRecord("1m", t0),
          "portfolio.allocation_drift": createCarouselDismissalRecord("7d", t0),
          "cashflow.surplus": createCarouselDismissalRecord("7d", t0),
          "goal.progress.g1": createCarouselDismissalRecord("7d", t0),
          "goals.progress.g1": createCarouselDismissalRecord("1m", t0),
          "billing.past_due": createCarouselDismissalRecord("7d", t0),
        },
        legacySources: {
          dashboardAlertDismissals: {
            cards: {
              "trial-ending": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
              "split-pending-banner": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
              "jit-device-alerts-invite": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
              "active-trip-trp-1": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
              "corporate-dividends-alert": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
            },
            governance: { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
            surplus: { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future, month: "2026-11", surplusCents: 150000 },
          },
          portfolioAlertDismissals: {
            "single-asset-PETR4": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
            "private-issuer-banco-x": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
            "macro-sector-energia": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
            "benchmark-overlap-ibov": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
            "low-diversification-nef-stocks": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
            "quarantine-governance-alert": { dismissedAt: new Date(t0).toISOString(), dismissedUntil: future },
          },
          deviceNotifications: {
            dismissedPermissionAlerts: { pushDue: true },
          },
        },
      });

      const ids = entries.map((e) => e.canonicalId);
      expect(ids).not.toContain("billing.past_due");
      expect(ids).not.toContain("portfolio.governance_review");
      expect(ids).not.toContain("portfolio.allocation_drift");
      expect(ids).not.toContain("cashflow.surplus");
      expect(ids).not.toContain("goal.progress.g1");
      expect(ids).not.toContain("portfolio.governance_summary");

      expect(ids).toEqual(
        expect.arrayContaining([
          "portfolio.reviews_overdue",
          "portfolio.drift",
          "cashflow.surplus_aporte",
          "goals.progress.g1",
          "billing.trial_ending",
          "split.pending",
          "device.alerts_invite",
          "trip.active.trp-1",
          "portfolio.dividends_available",
          "portfolio.dividends_projected",
          "portfolio.risk.single_asset.PETR4",
          "portfolio.risk.private_issuer.banco-x",
          "portfolio.risk.macro_sector.energia",
          "portfolio.risk.benchmark_overlap.ibov",
          "portfolio.risk.low_diversification",
          "portfolio.quarantine",
          "device.permissions.push_due",
        ]),
      );

      const permEntry = entries.find((e) => e.canonicalId === "device.permissions.push_due");
      expect(permEntry?.returnDateLabel).toBe("Até reativar");
    });
  });
});
