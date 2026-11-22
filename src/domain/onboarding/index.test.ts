import { describe, expect, it } from "vitest";
import {
  coreOnboardingProgress,
  coreOnboardingSteps,
  isFirstUse,
  isOnboardingComplete,
  isUserActive,
  onboardingProgress,
  onboardingSteps,
  shouldShowOnboardingBanner,
} from "./index";
import type { OnboardingCounts } from "./index";

const empty: OnboardingCounts = {
  expenseCategories: 0,
  incomeCategories: 0,
  cashCheckpoints: 0,
  cards: 0,
  transactions: 0,
  portfolioAssets: 0,
  portfolioTransactions: 0,
  notificationsEnabled: false,
};

const full: OnboardingCounts = {
  expenseCategories: 1,
  incomeCategories: 1,
  cashCheckpoints: 1,
  cards: 1,
  transactions: 1,
  portfolioAssets: 1,
  portfolioTransactions: 1,
  notificationsEnabled: true,
};

describe("onboardingSteps — checklist derivado das contagens", () => {
  it("conta vazia sem filtro de feature retorna os 6 passos reais (sem categorias pré-criadas)", () => {
    const steps = onboardingSteps(empty);
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.id)).toEqual([
      "cash-checkpoint",
      "first-transaction",
      "card",
      "portfolio-asset",
      "portfolio-transaction",
      "bank-notifications",
    ]);
    expect(steps.every((step) => !step.done)).toBe(true);
  });

  it("filtra exclusivamente passos de investimentos quando hasFeature permite apenas investments", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    const steps = onboardingSteps(empty, hasOnlyInvestments);
    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.id)).toEqual(["portfolio-asset", "portfolio-transaction"]);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it("filtra passos de finanças quando hasFeature permite apenas finanças", () => {
    const hasFinances = (key: string) =>
      key === "budgets" || key === "cards" || key === "transactions";
    const steps = onboardingSteps(empty, hasFinances);
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.id)).toEqual(["cash-checkpoint", "first-transaction", "card"]);
  });

  it("cada passo fica done quando há dados do tipo correspondente", () => {
    const counts: OnboardingCounts = {
      expenseCategories: 10,
      incomeCategories: 3,
      cashCheckpoints: 1,
      cards: 0,
      transactions: 0,
      portfolioAssets: 1,
      portfolioTransactions: 0,
      notificationsEnabled: false,
    };
    const steps = onboardingSteps(counts);
    expect(steps.find((s) => s.id === "cash-checkpoint")?.done).toBe(true);
    expect(steps.find((s) => s.id === "first-transaction")?.done).toBe(false);
    expect(steps.find((s) => s.id === "card")?.done).toBe(false);
    expect(steps.find((s) => s.id === "portfolio-asset")?.done).toBe(true);
    expect(steps.find((s) => s.id === "portfolio-transaction")?.done).toBe(false);
    expect(steps.find((s) => s.id === "bank-notifications")?.done).toBe(false);
  });

  it("conta completa deixa todos os passos done", () => {
    const steps = onboardingSteps(full);
    expect(steps).toHaveLength(6);
    expect(steps.every((step) => step.done)).toBe(true);
  });
});

describe("onboardingProgress", () => {
  it("progresso 0/6 para conta vazia sem filtro", () => {
    expect(onboardingProgress(empty)).toEqual({ done: 0, total: 6 });
  });

  it("progresso de usuário que só tem investimentos (1/2)", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    const counts = { ...empty, portfolioAssets: 1 };
    expect(onboardingProgress(counts, hasOnlyInvestments)).toEqual({ done: 1, total: 2 });
  });

  it("progresso 6/6 para conta completa", () => {
    expect(onboardingProgress(full)).toEqual({ done: 6, total: 6 });
  });
});

describe("isOnboardingComplete / isFirstUse", () => {
  it("conta vazia é primeiro uso e setup incompleto", () => {
    expect(isFirstUse(empty)).toBe(true);
    expect(isOnboardingComplete(empty)).toBe(false);
  });

  it("setup completo apenas com todos os passos", () => {
    expect(isOnboardingComplete(full)).toBe(true);
    expect(isOnboardingComplete({ ...full, cashCheckpoints: 0 })).toBe(false);
    expect(isOnboardingComplete({ ...full, cards: 0 })).toBe(false);
    expect(isOnboardingComplete({ ...full, portfolioAssets: 0 })).toBe(false);
  });

  it("setup completo para perfil exclusivo de investimentos", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    const counts = { ...empty, portfolioAssets: 1, portfolioTransactions: 1 };
    expect(isOnboardingComplete(counts, hasOnlyInvestments)).toBe(true);
    expect(
      isOnboardingComplete({ ...counts, portfolioTransactions: 0 }, hasOnlyInvestments),
    ).toBe(false);
  });

  it("primeiro uso passa a false ao informar saldo inicial (cashCheckpoints), cartão, lançamento ou ativo", () => {
    expect(isFirstUse({ ...empty, cashCheckpoints: 1 })).toBe(false);
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

describe("isUserActive — limiar de atividade para conclusão / smart dismiss", () => {
  it("falso para conta vazia ou com apenas 1 ação parcial", () => {
    expect(isUserActive(empty)).toBe(false);
    expect(isUserActive({ ...empty, cashCheckpoints: 1 })).toBe(false);
    expect(isUserActive({ ...empty, cards: 1 })).toBe(false);
    expect(isUserActive({ ...empty, transactions: 1 })).toBe(false);
  });

  it("verdadeiro ao concluir os 3 passos core ou atingir 5 lançamentos", () => {
    expect(isUserActive({ ...empty, cashCheckpoints: 1, transactions: 1, cards: 1 })).toBe(true);
    expect(isUserActive({ ...empty, transactions: 5 })).toBe(true);
  });

  it("verdadeiro apenas quando ativo e operação estão presentes no perfil exclusivo de investimentos", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    expect(isUserActive({ ...empty, portfolioAssets: 1 }, hasOnlyInvestments)).toBe(false);
    expect(
      isUserActive({ ...empty, portfolioAssets: 1, portfolioTransactions: 1 }, hasOnlyInvestments),
    ).toBe(true);
    expect(isUserActive(empty, hasOnlyInvestments)).toBe(false);
  });

  it("usuário com apenas investimentos ignora contagem de transações tradicionais", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    expect(isUserActive({ ...empty, transactions: 5 }, hasOnlyInvestments)).toBe(false);
  });
});

describe("coreOnboardingSteps — 3 passos reais prioritários", () => {
  it("retorna 3 passos essenciais por padrão", () => {
    const steps = coreOnboardingSteps(empty);
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.id)).toEqual(["cash-checkpoint", "first-transaction", "card"]);
  });

  it("progresso core para usuário exclusivo de investimentos (0/2 e 2/2)", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    expect(coreOnboardingProgress(empty, hasOnlyInvestments)).toEqual({ done: 0, total: 2 });
    const doneInvestments = { ...empty, portfolioAssets: 1, portfolioTransactions: 1 };
    expect(coreOnboardingProgress(doneInvestments, hasOnlyInvestments)).toEqual({
      done: 2,
      total: 2,
    });
  });

  it("progresso core para usuário de finanças tradicionais (0/3 e 3/3)", () => {
    const hasFinances = (key: string) =>
      key === "budgets" || key === "cards" || key === "transactions";
    expect(coreOnboardingProgress(empty, hasFinances)).toEqual({ done: 0, total: 3 });
    const doneFinances = {
      ...empty,
      cashCheckpoints: 1,
      cards: 1,
      transactions: 1,
    };
    expect(coreOnboardingProgress(doneFinances, hasFinances)).toEqual({ done: 3, total: 3 });
  });

  it("reordena priorizando cartão quando initialGoal é 'cards'", () => {
    const steps = coreOnboardingSteps(empty, undefined, "cards");
    expect(steps[0]!.id).toBe("card");
  });

  it("reordena priorizando primeira transação quando initialGoal é 'ocr' ou 'debts'", () => {
    expect(coreOnboardingSteps(empty, undefined, "ocr")[0]!.id).toBe("first-transaction");
    expect(coreOnboardingSteps(empty, undefined, "debts")[0]!.id).toBe("first-transaction");
  });

  it("prioriza portfolio-asset com saldo e lançamento quando initialGoal é 'investments'", () => {
    const steps = coreOnboardingSteps(empty, undefined, "investments");
    expect(steps.map((s) => s.id)).toEqual([
      "portfolio-asset",
      "cash-checkpoint",
      "first-transaction",
    ]);
  });

  it("mantém ordem padrão (cash-checkpoint primeiro) quando initialGoal é omitido ou nulo", () => {
    expect(coreOnboardingSteps(empty)[0]!.id).toBe("cash-checkpoint");
    expect(coreOnboardingSteps(empty, undefined, null)[0]!.id).toBe("cash-checkpoint");
  });
});

describe("shouldShowOnboardingBanner — lógica de exibição do guia na Fase 2", () => {
  it("permanece visível após calibrar saldo ou adicionar apenas 1 cartão até completar os 3 passos", () => {
    const hasFinances = (key: string) =>
      key === "budgets" || key === "cards" || key === "transactions";
    expect(shouldShowOnboardingBanner(empty, hasFinances)).toBe(true);
    expect(shouldShowOnboardingBanner({ ...empty, cashCheckpoints: 1 }, hasFinances)).toBe(true);
    expect(
      shouldShowOnboardingBanner({ ...empty, cashCheckpoints: 1, cards: 1 }, hasFinances),
    ).toBe(true);
    expect(
      shouldShowOnboardingBanner(
        { ...empty, cashCheckpoints: 1, cards: 1, transactions: 1 },
        hasFinances,
      ),
    ).toBe(false);
  });

  it("exibe para conta de investimentos até concluir ativo e operação", () => {
    const hasOnlyInvestments = (key: string) => key === "investments";
    expect(shouldShowOnboardingBanner(empty, hasOnlyInvestments)).toBe(true);
    expect(shouldShowOnboardingBanner({ ...empty, portfolioAssets: 1 }, hasOnlyInvestments)).toBe(
      true,
    );
    expect(
      shouldShowOnboardingBanner(
        { ...empty, portfolioAssets: 1, portfolioTransactions: 1 },
        hasOnlyInvestments,
      ),
    ).toBe(false);
  });

  it("oculta para conta de finanças quando usuário atinge 5 ou mais lançamentos (smart dismiss)", () => {
    const hasFinances = (key: string) =>
      key === "budgets" || key === "cards" || key === "transactions";
    expect(shouldShowOnboardingBanner({ ...empty, transactions: 5 }, hasFinances)).toBe(false);
  });

  it("oculta se usuário não possui nenhuma feature habilitada", () => {
    const hasNoFeatures = () => false;
    expect(shouldShowOnboardingBanner(empty, hasNoFeatures)).toBe(false);
  });
});
