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

const empty: OnboardingCounts = {
  expenseCategories: 0,
  incomeCategories: 0,
  cards: 0,
  transactions: 0,
  portfolioAssets: 0,
  portfolioTransactions: 0,
  notificationsEnabled: false,
};

const full: OnboardingCounts = {
  expenseCategories: 1,
  incomeCategories: 1,
  cards: 1,
  transactions: 1,
  portfolioAssets: 1,
  portfolioTransactions: 1,
  notificationsEnabled: true,
};

describe("onboardingSteps — checklist derivado das contagens", () => {
  it("conta vazia sem filtro de feature → todos os 7 passos pendentes", () => {
    const steps = onboardingSteps(empty);
    expect(steps).toHaveLength(7);
    expect(steps.every((step) => !step.done)).toBe(true);
  });

  it("filtra exclusivamente passos do módulo de investimentos quando hasFeature permite apenas investments", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    const steps = onboardingSteps(empty, hasOnlyInvestments);
    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.id)).toEqual(["portfolio-asset", "portfolio-transaction"]);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it("filtra exclusivamente passos de finanças quando hasFeature permite apenas finanças", () => {
    const hasFinances = (key: string) => key === "budgets" || key === "cards" || key === "transactions";
    const steps = onboardingSteps(empty, hasFinances);
    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.id)).toEqual([
      "expense-category",
      "income-category",
      "card",
      "first-transaction",
    ]);
  });

  it("cada passo fica done quando há dados do tipo correspondente", () => {
    const counts = {
      expenseCategories: 1,
      incomeCategories: 0,
      cards: 0,
      transactions: 0,
      portfolioAssets: 1,
      portfolioTransactions: 0,
      notificationsEnabled: false,
    };
    const steps = onboardingSteps(counts);
    expect(steps.find((s) => s.id === "expense-category")?.done).toBe(true);
    expect(steps.find((s) => s.id === "income-category")?.done).toBe(false);
    expect(steps.find((s) => s.id === "card")?.done).toBe(false);
    expect(steps.find((s) => s.id === "first-transaction")?.done).toBe(false);
    expect(steps.find((s) => s.id === "portfolio-asset")?.done).toBe(true);
    expect(steps.find((s) => s.id === "portfolio-transaction")?.done).toBe(false);
    expect(steps.find((s) => s.id === "bank-notifications")?.done).toBe(false);
  });

  it("conta completa → todos os passos done", () => {
    const steps = onboardingSteps(full);
    expect(steps).toHaveLength(7);
    expect(steps.every((step) => step.done)).toBe(true);
  });
});

describe("onboardingProgress", () => {
  it("progresso 0/7 para conta vazia sem filtro", () => {
    expect(onboardingProgress(empty)).toEqual({ done: 0, total: 7 });
  });

  it("progresso de usuário que só tem investimentos (1/2)", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    const counts = { ...empty, portfolioAssets: 1 };
    expect(onboardingProgress(counts, hasOnlyInvestments)).toEqual({ done: 1, total: 2 });
  });

  it("progresso 7/7 para conta completa", () => {
    expect(onboardingProgress(full)).toEqual({ done: 7, total: 7 });
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
    expect(isOnboardingComplete({ ...full, portfolioAssets: 0 })).toBe(false);
  });

  it("setup completo para perfil exclusivo de investimentos", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    const counts = { ...empty, portfolioAssets: 1, portfolioTransactions: 1 };
    expect(isOnboardingComplete(counts, hasOnlyInvestments)).toBe(true);
    expect(isOnboardingComplete({ ...counts, portfolioTransactions: 0 }, hasOnlyInvestments)).toBe(false);
  });

  it("primeiro uso é falso se houver movimentações ou ativos cadastrados", () => {
    expect(isFirstUse({ ...empty, cards: 1 })).toBe(false);
    expect(isFirstUse({ ...empty, transactions: 1 })).toBe(false);
    expect(isFirstUse({ ...empty, portfolioAssets: 1 })).toBe(false);
    expect(isFirstUse({ ...empty, portfolioTransactions: 1 })).toBe(false);
    expect(isFirstUse({ ...empty, notificationsEnabled: true })).toBe(false);
  });

  it("primeiro uso permanece verdadeiro com categorias pré-populadas do sistema", () => {
    expect(isFirstUse({ ...empty, expenseCategories: 10, incomeCategories: 3 })).toBe(true);
  });
});

describe("isUserActive — limiar de atividade para smart dismiss", () => {
  it("falso para conta completamente vazia", () => {
    expect(isUserActive(empty)).toBe(false);
  });

  it("verdadeiro com 3 ou mais transações para usuário de finanças", () => {
    expect(isUserActive({ ...empty, transactions: 3 })).toBe(true);
  });

  it("verdadeiro com ao menos 1 cartão para usuário de finanças", () => {
    expect(isUserActive({ ...empty, cards: 1 })).toBe(true);
  });

  it("verdadeiro com 1 ativo ou 1 transação de carteira para usuário de investimentos", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    expect(isUserActive({ ...empty, portfolioAssets: 1 }, hasOnlyInvestments)).toBe(true);
    expect(isUserActive({ ...empty, portfolioTransactions: 1 }, hasOnlyInvestments)).toBe(true);
    expect(isUserActive(empty, hasOnlyInvestments)).toBe(false);
  });

  it("usuário com apenas investimentos ignora contagem de transações tradicionais", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    expect(isUserActive({ ...empty, transactions: 5 }, hasOnlyInvestments)).toBe(false);
  });
});

describe("coreOnboardingSteps — passos sem bank-notifications", () => {
  it("retorna exatamente 6 passos core sem filtro de features", () => {
    const steps = coreOnboardingSteps(empty);
    expect(steps).toHaveLength(6);
    expect(steps.find((s) => s.id === "bank-notifications")).toBeUndefined();
  });

  it("progresso core para usuário exclusivo de investimentos (0/2 e 2/2)", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    expect(coreOnboardingProgress(empty, hasOnlyInvestments)).toEqual({ done: 0, total: 2 });
    const doneInvestments = { ...empty, portfolioAssets: 1, portfolioTransactions: 1 };
    expect(coreOnboardingProgress(doneInvestments, hasOnlyInvestments)).toEqual({ done: 2, total: 2 });
  });

  it("progresso core para usuário de finanças tradicionais (0/4 e 4/4)", () => {
    const hasFinances = (key: string) => key === "budgets" || key === "cards" || key === "transactions";
    expect(coreOnboardingProgress(empty, hasFinances)).toEqual({ done: 0, total: 4 });
    const doneFinances = {
      ...empty,
      expenseCategories: 1,
      incomeCategories: 1,
      cards: 1,
      transactions: 1,
    };
    expect(coreOnboardingProgress(doneFinances, hasFinances)).toEqual({ done: 4, total: 4 });
  });
});

describe("shouldShowOnboardingBanner — lógica de exibição do banner", () => {
  it("exibe para conta nova de finanças sem dados", () => {
    const hasFinances = (key: string) => key === "budgets" || key === "cards" || key === "transactions";
    expect(shouldShowOnboardingBanner(empty, hasFinances)).toBe(true);
  });

  it("exibe para conta nova de investimentos sem dados", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    expect(shouldShowOnboardingBanner(empty, hasOnlyInvestments)).toBe(true);
  });

  it("oculta para conta de investimentos quando o usuário já tem 1 ativo (smart dismiss)", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    expect(shouldShowOnboardingBanner({ ...empty, portfolioAssets: 1 }, hasOnlyInvestments)).toBe(false);
  });

  it("oculta para conta de finanças quando usuário tem 3 ou mais transações (smart dismiss)", () => {
    const hasFinances = (key: string) => key === "budgets" || key === "cards" || key === "transactions";
    expect(shouldShowOnboardingBanner({ ...empty, transactions: 3 }, hasFinances)).toBe(false);
  });

  it("oculta se usuário não possui nenhuma feature habilitada", () => {
    const hasNoFeatures = () => false;
    expect(shouldShowOnboardingBanner(empty, hasNoFeatures)).toBe(false);
  });
});
