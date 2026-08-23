import { describe, expect, it } from "vitest";
import {
  activationDistance,
  boundaryResistance,
  directionOf,
  EDGE_INSET_PX,
  isEdgeZoneTouch,
  isFlick,
  isHorizontalDominant,
  isHorizontalLock,
  resolveSwipeIntent,
} from "./swipe";

describe("isHorizontalLock (F20 — axis-lock ±42°)", () => {
  it("aceita vetores dentro do cone de ±42° do eixo X", () => {
    // tan(42°) ≈ 0.9004 → dy pode ser até ~0.9× dx.
    expect(isHorizontalLock(100, 50)).toBe(true); // 26.6° < 42°
    expect(isHorizontalLock(100, 80)).toBe(true); // 38.6° < 42°
    expect(isHorizontalLock(100, 89)).toBe(true); // ~41.6° < 42°
    expect(isHorizontalLock(-80, -20)).toBe(true);
  });

  it("rejeita vetores fora do cone (drift vertical)", () => {
    expect(isHorizontalLock(100, 95)).toBe(false);
    expect(isHorizontalLock(100, 200)).toBe(false);
  });

  it("rejeita dominância vertical inequívoca (|dy| > |dx|) — Thumb Drift", () => {
    expect(isHorizontalLock(30, 40)).toBe(false);
    expect(isHorizontalLock(-10, 90)).toBe(false);
  });

  it("rejeita deslocamento nulo", () => {
    expect(isHorizontalLock(0, 0)).toBe(false);
  });
});

describe("isEdgeZoneTouch (F20 evolução — zona de exclusão de borda)", () => {
  it("descarta toques iniciados na borda extrema (12px)", () => {
    expect(isEdgeZoneTouch(0, 390)).toBe(true);
    expect(isEdgeZoneTouch(10, 390)).toBe(true);
    expect(isEdgeZoneTouch(EDGE_INSET_PX, 390)).toBe(true); // <= inset
  });

  it("descarta toques iniciados na borda direita", () => {
    expect(isEdgeZoneTouch(390, 390)).toBe(true);
    expect(isEdgeZoneTouch(385, 390)).toBe(true);
    expect(isEdgeZoneTouch(390 - EDGE_INSET_PX, 390)).toBe(true);
  });

  it("aceita toques na área central segura", () => {
    expect(isEdgeZoneTouch(195, 390)).toBe(false);
    expect(isEdgeZoneTouch(EDGE_INSET_PX + 1, 390)).toBe(false); // 13 > 12
    expect(isEdgeZoneTouch(390 - EDGE_INSET_PX - 1, 390)).toBe(false);
  });

  it("aceita inset customizado e viewport não medido", () => {
    expect(isEdgeZoneTouch(30, 390, 32)).toBe(true);
    expect(isEdgeZoneTouch(30, 390, 24)).toBe(false);
    expect(isEdgeZoneTouch(10, 0)).toBe(false); // viewport desconhecido
  });
});

describe("isHorizontalDominant (F20 evolução — arming com razão 1.25)", () => {
  it("arma quando o eixo X é claramente dominante (|dx| > 1.25·|dy|)", () => {
    expect(isHorizontalDominant(100, 50)).toBe(true); // 100 > 62.5
    expect(isHorizontalDominant(-80, -20)).toBe(true); // 80 > 25
  });

  it("rejeita rolagem vertical com leve desvio horizontal", () => {
    expect(isHorizontalDominant(30, 30)).toBe(false); // 30 <= 37.5
    expect(isHorizontalDominant(50, 45)).toBe(false); // 50 <= 56.25
    expect(isHorizontalDominant(10, 100)).toBe(false); // dominância vertical
  });

  it("respeita a razão customizada e deslocamento nulo", () => {
    expect(isHorizontalDominant(60, 40, 1.2)).toBe(true); // 60 > 48
    expect(isHorizontalDominant(0, 10)).toBe(false);
  });
});

describe("isFlick (F20 — arremesso > 0.3 px/ms com ≥ 30px)", () => {
  it("reconhece arremesso rápido", () => {
    // 90px em 200ms = 0.45 px/ms > 0.3.
    expect(isFlick(90, 200)).toBe(true);
    expect(isFlick(-90, 200)).toBe(true);
  });

  it("rejeita gestos lentos (velocidade ≤ 0.3 px/ms)", () => {
    expect(isFlick(90, 400)).toBe(false); // 0.225 px/ms
    expect(isFlick(30, 100)).toBe(false); // exatamente 0.3 → não é maior
  });

  it("rejeita distâncias abaixo de 30px (ajustes finos)", () => {
    expect(isFlick(20, 40)).toBe(false);
  });

  it("rejeita tempo nulo", () => {
    expect(isFlick(90, 0)).toBe(false);
  });
});

describe("activationDistance (F20 — clamped entre 48px e 120px, 14% viewport)", () => {
  it("usa o piso de 48px em viewports pequenos", () => {
    expect(activationDistance(320)).toBe(48); // 14% = 45 → piso 48
    expect(activationDistance(300)).toBe(48);
  });

  it("usa 14% do viewport quando maior que o piso", () => {
    expect(activationDistance(390)).toBe(55); // 14% = 54.6 → 55
    expect(activationDistance(500)).toBe(70); // 70px
    expect(activationDistance(1200)).toBe(120); // clamped em 120px
  });
});

describe("boundaryResistance (F20 — rubber-banding elástico)", () => {
  it("não aplica resistência dentro do limite", () => {
    expect(boundaryResistance(30, 60)).toBe(30);
    expect(boundaryResistance(-60, 60)).toBe(-60);
  });

  it("aplica resistência crescente além do limite (sem nunca reverter)", () => {
    // 100px além de 60 → 60 + (40 × 0.35) = 74 (não 100).
    const resisted = boundaryResistance(100, 60);
    expect(resisted).toBeGreaterThan(60);
    expect(resisted).toBeLessThan(100);
    expect(boundaryResistance(-100, 60)).toBeCloseTo(-74, 5);
  });
});

describe("resolveSwipeIntent (F20 — decisão final)", () => {
  const viewport = 390;

  it("navega para 'next' ao arrastar para a esquerda além do threshold", () => {
    expect(resolveSwipeIntent({ dx: -70, dy: 5, elapsedMs: 400, viewportWidthPx: viewport })).toBe("next");
  });

  it("navega para 'previous' ao arrastar para a direita além do threshold", () => {
    expect(resolveSwipeIntent({ dx: 70, dy: -5, elapsedMs: 400, viewportWidthPx: viewport })).toBe("previous");
  });

  it("flick rápido e curto navega mesmo abaixo da distância de ativação", () => {
    // 45px < 60px (threshold), mas 45/120 = 0.375 px/ms → flick.
    expect(resolveSwipeIntent({ dx: -45, dy: 0, elapsedMs: 120, viewportWidthPx: viewport })).toBe("next");
  });

  it("gesto lento e curto NÃO navega (toque/ajuste fino)", () => {
    expect(resolveSwipeIntent({ dx: 40, dy: 0, elapsedMs: 500, viewportWidthPx: viewport })).toBeNull();
  });

  it("gesto com drift vertical dominante NÃO navega (scroll)", () => {
    expect(resolveSwipeIntent({ dx: 30, dy: 80, elapsedMs: 300, viewportWidthPx: viewport })).toBeNull();
  });

  it("deslocamento nulo nunca navega", () => {
    expect(resolveSwipeIntent({ dx: 0, dy: 0, elapsedMs: 100, viewportWidthPx: viewport })).toBeNull();
  });

  it("borda: overscroll curto não navega (resistência)", () => {
    // 40px com resistência (se estivesse na borda) → abaixo do threshold.
    expect(resolveSwipeIntent({ dx: -40, dy: 0, elapsedMs: 300, viewportWidthPx: viewport })).toBeNull();
  });
});

describe("directionOf (F20)", () => {
  it("mapeia o sinal do deslocamento para a direção", () => {
    expect(directionOf(-10)).toBe("next");
    expect(directionOf(10)).toBe("previous");
    expect(directionOf(0)).toBeNull();
  });
});
