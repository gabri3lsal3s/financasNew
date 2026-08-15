import { describe, expect, it } from "vitest";
import {
  PULL_TO_TOP_MAX_PULL_PX,
  PULL_TO_TOP_THRESHOLD_PX,
  computePullDistance,
  evaluatePullIntent,
  isAtScrollBottom,
} from "./overscroll";

describe("computePullDistance (F26 — resistência elástica logarítmica)", () => {
  it("retorna 0 para arrasto nulo, negativo ou não-finito", () => {
    expect(computePullDistance(0)).toBe(0);
    expect(computePullDistance(-50)).toBe(0);
    expect(computePullDistance(Number.NaN)).toBe(0);
    expect(computePullDistance(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("segue quase 1:1 nos primeiros px (feedback imediato)", () => {
    const early = computePullDistance(10);
    expect(early).toBeGreaterThan(8);
    expect(early).toBeLessThanOrEqual(10);
  });

  it("amortece o arrasto grande (nunca ultrapassa o teto maxPull)", () => {
    expect(computePullDistance(500)).toBeLessThanOrEqual(PULL_TO_TOP_MAX_PULL_PX);
    expect(computePullDistance(10_000)).toBe(PULL_TO_TOP_MAX_PULL_PX);
  });

  it("é monotônica: quanto mais puxa, maior a distância (até o teto)", () => {
    const a = computePullDistance(30);
    const b = computePullDistance(80);
    const c = computePullDistance(200);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThanOrEqual(PULL_TO_TOP_MAX_PULL_PX);
  });
});

describe("isAtScrollBottom (F26 — barreira de inércia)", () => {
  it("true quando o scroll está no fim (com tolerância)", () => {
    expect(isAtScrollBottom(0, 100, 100)).toBe(true);
    expect(isAtScrollBottom(98, 100, 100, 2)).toBe(true);
    expect(isAtScrollBottom(100, 100, 200)).toBe(true); // 100+100 = 200 ≥ 198
    expect(isAtScrollBottom(0, 100, 200, 0)).toBe(false); // longe do fim
  });

  it("false em contêiner sem conteúdo ou longe do fim", () => {
    expect(isAtScrollBottom(0, 0, 0)).toBe(false);
    expect(isAtScrollBottom(0, 100, 1000)).toBe(false);
    expect(isAtScrollBottom(500, 100, 1000)).toBe(false);
  });
});

describe("evaluatePullIntent (F26 — decisão de disparo)", () => {
  it("idle sem rodapé estático (barreira de momentum)", () => {
    expect(evaluatePullIntent(200, PULL_TO_TOP_THRESHOLD_PX, false)).toBe("idle");
  });

  it("hold quando puxa abaixo do threshold", () => {
    expect(evaluatePullIntent(40, PULL_TO_TOP_THRESHOLD_PX, true)).toBe("hold");
  });

  it("trigger apenas com threshold atingido E rodapé estático", () => {
    expect(evaluatePullIntent(80, PULL_TO_TOP_THRESHOLD_PX, true)).toBe("trigger");
    expect(evaluatePullIntent(300, PULL_TO_TOP_THRESHOLD_PX, true)).toBe("trigger");
    expect(evaluatePullIntent(80, PULL_TO_TOP_THRESHOLD_PX, false)).toBe("idle");
  });

  it("idle com distância zero mesmo no rodapé", () => {
    expect(evaluatePullIntent(0, PULL_TO_TOP_THRESHOLD_PX, true)).toBe("idle");
  });
});
