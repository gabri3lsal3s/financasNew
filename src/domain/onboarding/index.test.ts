import { describe, expect, it } from "vitest";
import {
  isFirstUse,
  isOnboardingComplete,
  isUserActive,
  coreOnboardingSteps,
  coreOnboardingProgress,
  shouldShowOnboardingBanner,
  onboardingProgress,
  onboardingSteps,
} from "./index";
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

describe("isUserActive — limiar de atividade para smart dismiss", () => {
  it("falso para conta completamente vazia", () => {
    expect(isUserActive(empty)).toBe(false);
  });

  it("verdadeiro com 3 ou mais transações", () => {
    expect(isUserActive({ ...empty, transactions: 3 })).toBe(true);
    expect(isUserActive({ ...empty, transactions: 10 })).toBe(true);
  });

  it("verdadeiro com ao menos 1 cartão", () => {
    expect(isUserActive({ ...empty, cards: 1 })).toBe(true);
  });

  it("falso com menos de 3 transações e nenhum cartão", () => {
    expect(isUserActive({ ...empty, transactions: 2 })).toBe(false);
    expect(isUserActive({ ...empty, transactions: 1 })).toBe(false);
  });

  it("verdadeiro para conta totalmente completa", () => {
    expect(isUserActive(full)).toBe(true);
  });
});

describe("coreOnboardingSteps — passos sem bank-notifications", () => {
  it("retorna exatamente 4 passos (sem bank-notifications)", () => {
    const steps = coreOnboardingSteps(empty);
    expect(steps).toHaveLength(4);
    expect(steps.find((s) => s.id === "bank-notifications")).toBeUndefined();
  });

  it("progresso core 0/4 para conta vazia", () => {
    expect(coreOnboardingProgress(empty)).toEqual({ done: 0, total: 4 });
  });

  it("progresso core 4/4 mesmo sem notificações ativadas", () => {
    const countsWithoutNotif = { ...full, notificationsEnabled: false };
    expect(coreOnboardingProgress(countsWithoutNotif)).toEqual({ done: 4, total: 4 });
  });
});

describe("shouldShowOnboardingBanner — lógica de exibição do banner", () => {
  it("exibe para conta nova sem dados", () => {
    expect(shouldShowOnboardingBanner(empty)).toBe(true);
  });

  it("exibe quando usuário tem 1-2 transações e nenhum cartão (ainda não ativo)", () => {
    expect(shouldShowOnboardingBanner({ ...empty, transactions: 1 })).toBe(true);
    expect(shouldShowOnboardingBanner({ ...empty, transactions: 2 })).toBe(true);
  });

  it("oculta quando usuário tem 3 ou mais transações (smart dismiss)", () => {
    expect(shouldShowOnboardingBanner({ ...empty, transactions: 3 })).toBe(false);
  });

  it("oculta quando usuário tem ao menos 1 cartão (smart dismiss)", () => {
    expect(shouldShowOnboardingBanner({ ...empty, cards: 1 })).toBe(false);
  });

  it("oculta para conta totalmente completa", () => {
    expect(shouldShowOnboardingBanner(full)).toBe(false);
  });

  it("bank-notifications pendente não impede o ocultar por atividade", () => {
    const activeWithoutNotif = { ...full, notificationsEnabled: false };
    expect(shouldShowOnboardingBanner(activeWithoutNotif)).toBe(false);
  });
});
