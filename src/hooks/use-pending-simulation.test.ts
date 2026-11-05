import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { usePendingSimulation } from "./use-pending-simulation";
import {
  storePendingSimulation,
  getPendingSimulation,
  PENDING_SIMULATION_STORAGE_KEY,
  type PendingDebtSimulation,
} from "@/domain/share";

const mockUseAuth = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("./use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/state", () => ({
  useSaveSimulationToAccount: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

describe("usePendingSimulation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(undefined);
  });

  it("não faz nada se o usuário não estiver autenticado", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const debtSim: PendingDebtSimulation = {
      type: "debt_simulator",
      debts: [{ name: "Cartão XP", balanceCents: 150000, interestRateAnnual: 12, minimumPaymentCents: 15000 }],
    };
    storePendingSimulation(debtSim);

    renderHook(() => usePendingSimulation());

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(getPendingSimulation()).toEqual(debtSim);
  });

  it("não faz nada se não houver simulação pendente", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-123" } },
    });

    renderHook(() => usePendingSimulation());

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("chama a mutation e limpa o storage quando usuário está logado e há simulação", async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-123" } },
    });

    const debtSim: PendingDebtSimulation = {
      type: "debt_simulator",
      debts: [{ name: "Financiamento Carro", balanceCents: 2000000, interestRateAnnual: 14, minimumPaymentCents: 60000 }],
    };
    storePendingSimulation(debtSim);

    renderHook(() => usePendingSimulation());

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith(debtSim);
    expect(localStorage.getItem(PENDING_SIMULATION_STORAGE_KEY)).toBeNull();
  });
});
