import { describe, expect, it } from "vitest";
import { isFirstUse, isOnboardingComplete, onboardingProgress, onboardingSteps } from "./index";
import type { OnboardingCounts } from "./index";

const empty: OnboardingCounts = { expenseCategories: 0, incomeCategories: 0, cards: 0, transactions: 0, notificationsEnabled: false };

const full: OnboardingCounts = { expenseCategories: 1, incomeCategories: 1, cards: 1, transactions: 1, notificationsEnabled: true };

describe("onboardingSteps — checklist derivado das contagens", () => {
  it("conta vazia → todos os passos pendentes", () => {
    const steps = onboardingSteps(empty);
    expect(steps).toHaveLength(5);
    expect(steps.every((step) => !step.done)).toBe(true);
  });

  it("cada passo fica done quando há dados do tipo correspondente", () => {
    const steps = onboardingSteps({ expenseCategories: 1, incomeCategories: 0, cards: 0, transactions: 0, notificationsEnabled: false });
    expect(steps.find((s) => s.id === "expense-category")?.done).toBe(true);
    expect(steps.find((s) => s.id === "income-category")?.done).toBe(false);
    expect(steps.find((s) => s.id === "card")?.done).toBe(false);
    expect(steps.find((s) => s.id === "first-transaction")?.done).toBe(false);
    expect(steps.find((s) => s.id === "bank-notifications")?.done).toBe(false);

    const stepsWithNotif = onboardingSteps({ expenseCategories: 0, incomeCategories: 0, cards: 0, transactions: 0, notificationsEnabled: true });
    expect(stepsWithNotif.find((s) => s.id === "bank-notifications")?.done).toBe(true);
  });

  it("conta completa → todos os passos done", () => {
    const steps = onboardingSteps(full);
    expect(steps).toHaveLength(5);
    expect(steps.every((step) => step.done)).toBe(true);
  });
});

describe("onboardingProgress", () => {
  it("progresso 0/5 para conta vazia", () => {
    expect(onboardingProgress(empty)).toEqual({ done: 0, total: 5 });
  });

  it("progresso parcial (2/5)", () => {
    const progress = onboardingProgress({ expenseCategories: 1, incomeCategories: 1, cards: 0, transactions: 0, notificationsEnabled: false });
    expect(progress).toEqual({ done: 2, total: 5 });
  });

  it("progresso 5/5 para conta completa", () => {
    expect(onboardingProgress(full)).toEqual({ done: 5, total: 5 });
  });
});

describe("isOnboardingComplete / isFirstUse", () => {
  it("conta vazia é primeiro uso e setup incompleto", () => {
    expect(isFirstUse(empty)).toBe(true);
    expect(isOnboardingComplete(empty)).toBe(false);
  });

  it("setup completo apenas com todos os passos", () => {
    expect(isOnboardingComplete(full)).toBe(true);
    expect(isOnboardingComplete({ ...full, cards: 0 })).toBe(false);
    expect(isOnboardingComplete({ ...full, transactions: 0 })).toBe(false);
    expect(isOnboardingComplete({ ...full, notificationsEnabled: false })).toBe(false);
  });

  it("primeiro uso é falso com qualquer dado presente", () => {
    expect(isFirstUse({ ...empty, cards: 1 })).toBe(false);
    expect(isFirstUse({ ...empty, transactions: 1 })).toBe(false);
    expect(isFirstUse({ ...empty, notificationsEnabled: true })).toBe(false);
  });
});
