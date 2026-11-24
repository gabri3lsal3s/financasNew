import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessPage } from "./business-page";

let mockIsBusinessModeEnabled = false;
const mockToggleBusinessMode = vi.fn().mockResolvedValue(undefined);
const mockUpdateBusinessProfile = vi.fn().mockResolvedValue(undefined);
const mockInstallCategoryKit = vi.fn().mockResolvedValue([]);

vi.mock("@/hooks/use-mutation-guard", () => ({
  useMutationGuard: () => ({
    guardAction: (fn: () => void) => fn(),
    upgradeModal: null,
    isReadOnlyMode: false,
  }),
}));

vi.mock("@/state", () => ({
  useBusinessMode: () => ({
    isBusinessModeEnabled: mockIsBusinessModeEnabled,
    businessProfile: {
      profileKind: "mei" as const,
      businessName: "Studio Beta",
      monthlyDasCents: 7590,
      annualCeilingCents: 8100000,
      targetProLaboreCents: 300000,
    },
    toggleBusinessMode: mockToggleBusinessMode,
    updateBusinessProfile: mockUpdateBusinessProfile,
    isLoading: false,
    isPending: false,
  }),
  useExpenses: () => ({
    data: [
      {
        id: "exp-pj-1",
        user_id: "u1",
        category_id: "cat-pj-exp",
        card_id: null,
        value: 500,
        base_amount: 500,
        report_weight: 1,
        date: "2026-11-10",
        description: "Insumos operacionais",
        payment_method: "pix",
        installment_group_id: null,
        installment_number: 1,
        installments_total: 1,
        bill_competence: null,
        scope: "business",
        is_internal_transfer: false,
        is_tax_deductible: true,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useIncomes: () => ({
    data: [
      {
        id: "inc-pj-1",
        user_id: "u1",
        category_id: "cat-pj-inc",
        value: 4000,
        report_weight: 1,
        date: "2026-11-05",
        description: "Projeto cliente X",
        receive_type: "pix",
        scope: "business",
        is_internal_transfer: false,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useIncomesByRange: () => ({
    data: [
      {
        id: "inc-pj-1",
        user_id: "u1",
        category_id: "cat-pj-inc",
        value: 4000,
        report_weight: 1,
        date: "2026-11-05",
        description: "Projeto cliente X",
        receive_type: "pix",
        scope: "business",
        is_internal_transfer: false,
      },
    ],
    isLoading: false,
  }),
  useDebts: () => ({ data: [], isLoading: false, error: null }),
  useCategories: () => ({
    data: [
      { id: "cat-pj-exp", name: "Operação PJ", icon: "tag", color: "#000", type: "expense" },
      { id: "cat-pj-inc", name: "Serviços", icon: "briefcase", color: "#000", type: "income" },
    ],
  }),
  useRealCashBalance: () => ({
    cashBalance: {
      currentBalanceCents: 1200000,
      latestCheckpoint: { date: "2026-11-01" },
      inflowSinceCheckpointCents: 400000,
      outflowSinceCheckpointCents: 50000,
      eventsSinceCheckpoint: [],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateInternalTransferPair: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateCashCheckpoint: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useInstallCategoryKit: () => ({
    mutateAsync: mockInstallCategoryKit,
    isPending: false,
  }),
}));

describe("BusinessPage (/negocio)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBusinessModeEnabled = false;
  });

  it("exibe onboarding calmo opt-in quando Modo Negócio está desligado e permite ativar em 1 clique", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BusinessPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Ative o Modo Negócio sem poluir suas finanças pessoais/i)).toBeInTheDocument();
    const activateBtn = screen.getByRole("button", { name: /Ativar Modo Negócio/i });
    await user.click(activateBtn);

    await waitFor(() => {
      expect(mockToggleBusinessMode).toHaveBeenCalledWith(true);
      expect(mockUpdateBusinessProfile).toHaveBeenCalled();
    });
  });

  it("renderiza painel completo de Meu Negócio com DRE, Escudo Tributário, Teto MEI e movimentações quando ativo", () => {
    mockIsBusinessModeEnabled = true;
    render(
      <MemoryRouter>
        <BusinessPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Studio Beta")).toBeInTheDocument();
    expect(screen.getByText(/Caixa Real PJ/i)).toBeInTheDocument();
    expect(screen.getAllByText(/DRE Simplificado/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Escudo Tributário Líquido/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ponto de Equilíbrio/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Termômetro Teto MEI/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Projeto cliente X")).toBeInTheDocument();
    expect(screen.getByText("Insumos operacionais")).toBeInTheDocument();
  });

  it("permite abrir o Guia do Empreendedor a partir do cabeçalho", async () => {
    const user = userEvent.setup();
    mockIsBusinessModeEnabled = true;

    render(
      <MemoryRouter>
        <BusinessPage />
      </MemoryRouter>,
    );

    const guideBtn = screen.getByRole("button", { name: /^Guia$/i });
    expect(guideBtn).toBeInTheDocument();
    await user.click(guideBtn);

    expect(await screen.findByText(/Guia do Empreendedor & Enquadramento/i)).toBeInTheDocument();
    expect(screen.getByText(/Descobrir Perfil/i)).toBeInTheDocument();
    expect(screen.getByText(/PF × PJ na Prática/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Despesas Dedutíveis/i).length).toBeGreaterThan(0);
  });
});
