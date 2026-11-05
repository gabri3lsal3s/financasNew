import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  storePendingSimulation,
  getPendingSimulation,
  clearPendingSimulation,
  buildSimulationRegisterUrl,
  PENDING_SIMULATION_STORAGE_KEY,
  type PendingDebtSimulation,
  type PendingRebalanceSimulation,
  type PendingCompoundInterestSimulation,
} from "./simulation-transport";

describe("domain/share/simulation-transport", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("storePendingSimulation & getPendingSimulation", () => {
    it("persiste e recupera simulação de quitação de dívidas", () => {
      const debtSim: PendingDebtSimulation = {
        type: "debt_simulator",
        debts: [
          {
            name: "Cartão Santander",
            balanceCents: 450000,
            interestRateAnnual: 400,
            minimumPaymentCents: 45000,
          },
        ],
        extraMonthlyCents: 30000,
        strategy: "avalanche",
      };

      storePendingSimulation(debtSim);

      const stored = getPendingSimulation();
      expect(stored).toEqual(debtSim);
      expect(localStorage.getItem(PENDING_SIMULATION_STORAGE_KEY)).not.toBeNull();
    });

    it("persiste e recupera simulação de rebalanceamento de carteira", () => {
      const rebalanceSim: PendingRebalanceSimulation = {
        type: "rebalance_simulator",
        classes: [
          { name: "Ações", targetPercent: 40 },
          { name: "FIIs", targetPercent: 40 },
          { name: "Renda Fixa", targetPercent: 20 },
        ],
        patrimonyBaseCents: 10000000,
        aporteAmountCents: 200000,
        selectedPreset: "dividendos",
      };

      storePendingSimulation(rebalanceSim);

      const stored = getPendingSimulation();
      expect(stored).toEqual(rebalanceSim);
    });

    it("persiste e recupera simulação de juros compostos", () => {
      const compoundSim: PendingCompoundInterestSimulation = {
        type: "compound_interest",
        initialAmountCents: 1000000,
        monthlyContributionCents: 150000,
        annualRatePercent: 10.5,
        periodYears: 20,
        monthlyLivingCostCents: 500000,
      };

      storePendingSimulation(compoundSim);

      const stored = getPendingSimulation();
      expect(stored).toEqual(compoundSim);
    });

    it("retorna null se o storage estiver vazio", () => {
      expect(getPendingSimulation()).toBeNull();
    });

    it("retorna null se o dado em storage estiver corrompido", () => {
      localStorage.setItem(PENDING_SIMULATION_STORAGE_KEY, "invalid_json_string{");
      expect(getPendingSimulation()).toBeNull();
    });

    it("retorna null se o objeto não contiver um type suportado", () => {
      localStorage.setItem(
        PENDING_SIMULATION_STORAGE_KEY,
        JSON.stringify({ type: "unknown_calculator", value: 123 }),
      );
      expect(getPendingSimulation()).toBeNull();
    });
  });

  describe("clearPendingSimulation", () => {
    it("remove a chave do storage com sucesso", () => {
      localStorage.setItem(PENDING_SIMULATION_STORAGE_KEY, JSON.stringify({ type: "compound_interest" }));
      expect(localStorage.getItem(PENDING_SIMULATION_STORAGE_KEY)).not.toBeNull();

      clearPendingSimulation();
      expect(localStorage.getItem(PENDING_SIMULATION_STORAGE_KEY)).toBeNull();
      expect(getPendingSimulation()).toBeNull();
    });
  });

  describe("buildSimulationRegisterUrl", () => {
    it("retorna /cadastro simples se nenhuma simulação for passada", () => {
      expect(buildSimulationRegisterUrl()).toBe("/cadastro");
    });

    it("inclui query params from=simulador e tipo correspondente", () => {
      const urlDebt = buildSimulationRegisterUrl({
        type: "debt_simulator",
        debts: [],
      });
      expect(urlDebt).toBe("/cadastro?from=simulador&tipo=debt_simulator");

      const urlRebalance = buildSimulationRegisterUrl({
        type: "rebalance_simulator",
        classes: [],
      });
      expect(urlRebalance).toBe("/cadastro?from=simulador&tipo=rebalance_simulator");

      const urlCompound = buildSimulationRegisterUrl({
        type: "compound_interest",
        initialAmountCents: 0,
        monthlyContributionCents: 0,
        annualRatePercent: 0,
        periodYears: 10,
      });
      expect(urlCompound).toBe("/cadastro?from=simulador&tipo=compound_interest");
    });
  });
});
