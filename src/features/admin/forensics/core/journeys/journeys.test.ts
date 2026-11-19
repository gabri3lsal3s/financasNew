/**
 * Suíte de Testes do Portão de Qualidade 7 — 8 Golden User Journeys.
 *
 * Valida a integridade funcional, contratual e matemática em cada um dos 8 pilares:
 * 1. JRN-AUTH-01: Autenticação, Onboarding, Aprovação e Guarda RequireAdminSession.
 * 2. JRN-SUBS-01: Checkout Pix com CRC-16 BACEN, Trial 14d, Arrependimento CDC e Downgrade.
 * 3. JRN-CAT-01: Taxonomia Pai/Filho, CATEGORY_ICON_MAP e Reconciliação de Órfãos.
 * 4. JRN-CARD-01: Corte de Competência de Fatura, Parcelamento em Dízima e CDC 52.
 * 5. JRN-INV-01: Eventos Corporativos, Splits 1:2, Isenção Fiscal <= R$ 20k e DARF de FIIs.
 * 6. JRN-FAM-01: Orçamento Base Zero, Pace Alert, Provisão Anual e Convites Modulares.
 * 7. JRN-TRIP-01: Viagem Internacional em USD, Câmbio, Racha e Algoritmo Min-Cash-Flow.
 * 8. JRN-DATA-01: SmartAdvisor, Ordenação Hierárquica, Snooze e Backup JSON Referencial.
 *
 * Conforme AGENTS.md (TypeScript estrito, centavos inteiros, sem emojis).
 */

import { describe, expect, it } from "vitest";
import { HeadlessStateStore } from "../engine/headless-state-store";
import { HeadlessTransactionRouter } from "../engine/headless-transaction-router";
import { ALL_GOLDEN_JOURNEYS, executeAllJourneys, executeJourneyById } from "./journey-catalog";

describe("Portão de Qualidade 7 — Fábrica das 8 Jornadas Sintéticas (Golden User Journeys)", () => {
  it("carrega as 8 jornadas canônicas cobrindo os 8 pilares da aplicação", () => {
    expect(ALL_GOLDEN_JOURNEYS).toHaveLength(8);

    const pillars = new Set(ALL_GOLDEN_JOURNEYS.map((j) => j.pillar));
    expect(pillars.has("auth")).toBe(true);
    expect(pillars.has("subscription")).toBe(true);
    expect(pillars.has("categories")).toBe(true);
    expect(pillars.has("transactions")).toBe(true);
    expect(pillars.has("portfolio")).toBe(true);
    expect(pillars.has("goals_budgets")).toBe(true);
    expect(pillars.has("trips")).toBe(true);
    expect(pillars.has("insights")).toBe(true);
  });

  it("executa individualmente JRN-AUTH-01 com 100% de passos aprovados", async () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const result = await executeJourneyById("JRN-AUTH-01", { store, router });
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.steps.length).toBeGreaterThanOrEqual(7);
    expect(result?.steps.every((s) => s.passed)).toBe(true);
  });

  it("executa individualmente JRN-SUBS-01 com 100% de passos aprovados", async () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const result = await executeJourneyById("JRN-SUBS-01", { store, router });
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.steps.length).toBeGreaterThanOrEqual(7);
    expect(result?.steps.every((s) => s.passed)).toBe(true);
  });

  it("executa individualmente JRN-CAT-01 com 100% de passos aprovados", async () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const result = await executeJourneyById("JRN-CAT-01", { store, router });
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.steps.length).toBeGreaterThanOrEqual(7);
    expect(result?.steps.every((s) => s.passed)).toBe(true);
  });

  it("executa individualmente JRN-CARD-01 com 100% de passos aprovados", async () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const result = await executeJourneyById("JRN-CARD-01", { store, router });
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.steps.length).toBeGreaterThanOrEqual(7);
    expect(result?.steps.every((s) => s.passed)).toBe(true);
  });

  it("executa individualmente JRN-INV-01 com 100% de passos aprovados", async () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const result = await executeJourneyById("JRN-INV-01", { store, router });
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.steps.length).toBeGreaterThanOrEqual(7);
    expect(result?.steps.every((s) => s.passed)).toBe(true);
  });

  it("executa individualmente JRN-FAM-01 com 100% de passos aprovados", async () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const result = await executeJourneyById("JRN-FAM-01", { store, router });
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.steps.length).toBeGreaterThanOrEqual(7);
    expect(result?.steps.every((s) => s.passed)).toBe(true);
  });

  it("executa individualmente JRN-TRIP-01 com 100% de passos aprovados", async () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const result = await executeJourneyById("JRN-TRIP-01", { store, router });
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.steps.length).toBeGreaterThanOrEqual(7);
    expect(result?.steps.every((s) => s.passed)).toBe(true);
  });

  it("executa individualmente JRN-DATA-01 com 100% de passos aprovados", async () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const result = await executeJourneyById("JRN-DATA-01", { store, router });
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.steps.length).toBeGreaterThanOrEqual(7);
    expect(result?.steps.every((s) => s.passed)).toBe(true);
  });

  it("executa toda a bateria das 8 jornadas sintéticas em menos de 100ms preservando o estado", async () => {
    const store = new HeadlessStateStore();
    const router = new HeadlessTransactionRouter(store);

    const initialCategoriesCount = store.getState().categories.length;
    const initialProfileTier = store.getState().profile.tier;

    const tStart = performance.now();
    const results = await executeAllJourneys({ store, router });
    const duration = performance.now() - tStart;

    // Todas as 8 aprovadas
    expect(results).toHaveLength(8);
    expect(results.every((r) => r.passed)).toBe(true);

    // Contagem total de passos executados e aprovados (8 jornadas * ~7 passos = ~56 asserções)
    const totalSteps = results.reduce((acc, r) => acc + r.steps.length, 0);
    expect(totalSteps).toBeGreaterThanOrEqual(56);

    const passedSteps = results.reduce(
      (acc, r) => acc + r.steps.filter((s) => s.passed).length,
      0,
    );
    expect(passedSteps).toBe(totalSteps);

    // Tempo de execução headless ultrarrápido (< 100ms)
    expect(duration).toBeLessThan(100);

    // Reversibilidade perfeita do estado
    expect(store.getState().categories.length).toBe(initialCategoriesCount);
    expect(store.getState().profile.tier).toBe(initialProfileTier);
  });
});
