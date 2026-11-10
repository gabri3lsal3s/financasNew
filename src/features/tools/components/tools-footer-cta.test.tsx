import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import { ToolsFooterCta } from "./tools-footer-cta";
import {
  getPendingSimulation,
  type PendingDebtSimulation,
} from "@/domain/share";

const mockUseAuth = vi.fn();
const mockMutateAsync = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/state", () => ({
  useSaveSimulationToAccount: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("features/tools/components/tools-footer-cta", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: null });
    mockMutateAsync.mockResolvedValue(undefined);
  });

  it("renderiza título padrão, descrição e botão Criar Conta no Axir", () => {
    render(
      <MemoryRouter>
        <ToolsFooterCta />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Deseja monitorar suas finanças e metas com automação diária?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar Conta no Axir" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Conhecer Recursos")).toBeInTheDocument();
  });

  it("permite customizar título e descrição", () => {
    render(
      <MemoryRouter>
        <ToolsFooterCta
          title="Título Personalizado"
          description="Descrição Personalizada"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Título Personalizado" })).toBeInTheDocument();
    expect(screen.getByText("Descrição Personalizada")).toBeInTheDocument();
  });

  it("armazena simulação e redireciona para cadastro ao clicar no botão rápido como visitante", () => {
    const payload: PendingDebtSimulation = {
      type: "debt_simulator",
      debts: [{ name: "Cartão Santander", balanceCents: 400000, interestRateAnnual: 300, minimumPaymentCents: 40000 }],
    };

    render(
      <MemoryRouter>
        <ToolsFooterCta simulationPayload={payload} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Transporta dados da simulação")).toBeInTheDocument();

    const ctaBtn = screen.getByRole("button", { name: "Criar Conta no Axir" });
    fireEvent.click(ctaBtn);

    expect(getPendingSimulation()).toEqual(payload);
    expect(mockNavigate).toHaveBeenCalledWith("/cadastro?from=simulador&tipo=debt_simulator");
  });

  it("dispara salvamento direto e redireciona para /dividas quando usuário já está autenticado", async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-test-123" } },
    });

    const payload: PendingDebtSimulation = {
      type: "debt_simulator",
      debts: [{ name: "Empréstimo", balanceCents: 800000, interestRateAnnual: 24, minimumPaymentCents: 80000 }],
    };

    render(
      <MemoryRouter>
        <ToolsFooterCta simulationPayload={payload} />
      </MemoryRouter>,
    );

    const saveBtn = screen.getByRole("button", { name: "Salvar Simulação na Minha Conta" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(payload);
      expect(mockNavigate).toHaveBeenCalledWith("/dividas");
    });
  });
});
