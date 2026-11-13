import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FamilyPage } from "./family-page";
import type { FamilyConsolidationResult } from "@/types";

let mockFamilyData: {
  family?: { id: string; name: string };
  currentMember?: { user_id: string; role?: string };
  members?: Array<{ user_id: string; role?: string }>;
} | null = null;
let mockIsFamilyLoading = false;
let mockIsFamilyModeEnabled = false;
let mockIsModeLoading = false;

let mockConsolidationData: FamilyConsolidationResult | null = null;
let mockIsConsolidationLoading = false;
let mockConsolidationError: Error | null = null;
const mockRefetch = vi.fn();
const mockToggleFamilyMode = vi.fn();

vi.mock("@/state", () => ({
  useMyFamily: () => ({
    data: mockFamilyData,
    isLoading: mockIsFamilyLoading,
  }),
  useFamilyMode: () => ({
    isFamilyModeEnabled: mockIsFamilyModeEnabled,
    isLoading: mockIsModeLoading,
    toggleFamilyMode: mockToggleFamilyMode,
    isPending: false,
  }),
  useFamilyConsolidation: () => ({
    data: mockConsolidationData,
    isLoading: mockIsConsolidationLoading,
    error: mockConsolidationError,
    refetch: mockRefetch,
  }),
  useRecordFamilySettlement: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateFamily: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useInviteFamilyMember: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateFamily: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateFamilyMember: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRevokeFamilyInvite: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRemoveFamilyMember: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useLeaveFamily: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteFamily: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSuggestedSplitRatio: () => ({
    data: null,
    isLoading: false,
  }),
  useFamilyIncomeRatioSuggestion: () => ({
    data: null,
    isLoading: false,
  }),
  useFamilyPortfolioSummary: () => ({
    data: null,
    isLoading: false,
  }),
}));

const sampleConsolidation: FamilyConsolidationResult = {
  family: {
    id: "fam-1",
    name: "Família Silva",
    owner_id: "user-1",
    monthly_budget_cents: 600000,
    split_rule: "equal",
  },
  month: "2026-11",
  monthly_ceiling_cents: 600000,
  total_spent_cents: 350000,
  total_income_cents: 1000000,
  remaining_cents: 250000,
  spent_percentage: 58.33,
  members: [
    {
      user_id: "user-1",
      role: "owner",
      display_name: "Gabriel",
      spent_cents: 200000,
      percentage_of_total: 57.14,
      pix_key: "gabriel@email.com",
      pix_key_type: "email",
      split_ratio: null,
    },
    {
      user_id: "user-2",
      role: "member",
      display_name: "Mariana",
      spent_cents: 150000,
      percentage_of_total: 42.86,
      pix_key: "11999999999",
      pix_key_type: "phone",
      split_ratio: null,
    },
  ],
  expenses: [
    {
      id: "exp-1",
      description: "Supermercado Semanal",
      date: "2026-11-03",
      amount_cents: 200000,
      category_id: "cat-1",
      category_name: "Supermercado",
      category_icon: "shopping-cart",
      category_color: "#10b981",
      user_id: "user-1",
      payer_name: "Gabriel",
      is_own: true,
      created_at: "2026-11-03T10:00:00Z",
    },
    {
      id: "exp-2",
      description: "Energia Elétrica",
      date: "2026-11-04",
      amount_cents: 150000,
      category_id: "cat-2",
      category_name: "Contas",
      category_icon: "zap",
      category_color: "#f59e0b",
      user_id: "user-2",
      payer_name: "Mariana",
      is_own: false,
      created_at: "2026-11-04T10:00:00Z",
    },
  ],
  is_settled: false,
  settlement: null,
  has_post_settlement_expenses: false,
};

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderPage(initialEntry = "/familia") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/familia" element={<FamilyPage />} />
          <Route path="/" element={<div data-testid="home-page">Página Inicial</div>} />
          <Route path="/configuracoes" element={<div data-testid="settings-page">Configurações</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FamilyPage (/familia)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFamilyData = null;
    mockIsFamilyLoading = false;
    mockIsFamilyModeEnabled = false;
    mockIsModeLoading = false;
    mockConsolidationData = null;
    mockIsConsolidationLoading = false;
    mockConsolidationError = null;
  });

  it("exibe skeleton durante o carregamento dos dados de família", () => {
    mockIsFamilyLoading = true;
    renderPage();

    expect(screen.getByTestId("family-page-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Modo Família")).not.toBeInTheDocument();
  });

  it("renderiza tela explicativa para ativar o modo familiar quando estiver desativado", () => {
    mockFamilyData = null;
    mockIsFamilyModeEnabled = false;
    renderPage();

    expect(screen.getByTestId("family-mode-inactive")).toBeInTheDocument();
    expect(screen.getByText("Modo Família desativado")).toBeInTheDocument();
    const activateButton = screen.getByRole("button", { name: "Ativar Modo Família" });
    expect(activateButton).toBeInTheDocument();
    fireEvent.click(activateButton);
    expect(mockToggleFamilyMode).toHaveBeenCalledWith(true);
  });

  it("renderiza empty state com botão de criar família quando o modo estiver ativo mas sem família criada", () => {
    mockFamilyData = null;
    mockIsFamilyModeEnabled = true;
    renderPage();

    expect(screen.getByRole("heading", { name: "Modo Família" })).toBeInTheDocument();
    expect(screen.getByText("Nenhuma família criada ainda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar Família" })).toBeInTheDocument();
  });

  it("renderiza o estado de erro da consolidação com botão de retry", () => {
    mockIsFamilyModeEnabled = true;
    mockFamilyData = {
      family: { id: "fam-1", name: "Família Silva" },
      currentMember: { user_id: "user-1" },
    };
    mockConsolidationError = new Error("Network error");
    renderPage();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Não foi possível carregar a consolidação familiar deste mês."),
    ).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: "Tentar novamente" });
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("renderiza os cards analíticos e extrato quando a consolidação carregar", () => {
    mockIsFamilyModeEnabled = true;
    mockFamilyData = {
      family: { id: "fam-1", name: "Família Silva" },
      currentMember: { user_id: "user-1" },
    };
    mockConsolidationData = sampleConsolidation;
    renderPage();

    expect(screen.getByRole("heading", { name: "Modo Família" })).toBeInTheDocument();
    expect(screen.getByText("Família Silva")).toBeInTheDocument();

    // Cards Analíticos
    expect(screen.getByText("Teto da Casa")).toBeInTheDocument();
    expect(screen.getByText("Equilíbrio do Mês")).toBeInTheDocument();
    expect(screen.getByText("Gráfico Comparativo")).toBeInTheDocument();
    expect(screen.getByText("Ranking de Consumo por Categoria")).toBeInTheDocument();
    expect(screen.getByText("Extrato Familiar")).toBeInTheDocument();

    // Valores e Lançamentos
    expect(screen.getByText("Supermercado Semanal")).toBeInTheDocument();
    expect(screen.getByText("Energia Elétrica")).toBeInTheDocument();
  });

  it("abre o diálogo de acerto de contas ao clicar em 'Acertar Contas'", () => {
    mockIsFamilyModeEnabled = true;
    mockFamilyData = {
      family: { id: "fam-1", name: "Família Silva" },
      currentMember: { user_id: "user-1" },
    };
    mockConsolidationData = sampleConsolidation;
    renderPage();

    const settleBtn = screen.getByRole("button", { name: "Acertar Contas (Pix)" });
    fireEvent.click(settleBtn);

    expect(screen.getByRole("heading", { name: "Acerto de Contas Familiar" })).toBeInTheDocument();
    expect(screen.getByText("Proposta de Compensação")).toBeInTheDocument();
  });

  it("exibe o botão Convidar para o titular quando a família não estiver cheia", () => {
    mockIsFamilyModeEnabled = true;
    mockFamilyData = {
      family: { id: "fam-1", name: "Família Silva" },
      currentMember: { user_id: "user-1", role: "owner" },
      members: [{ user_id: "user-1", role: "owner" }],
    };
    mockConsolidationData = sampleConsolidation;
    renderPage();

    expect(screen.getByRole("button", { name: /Convidar novo membro da família/i })).toBeInTheDocument();
  });

  it("abre o diálogo de configurações ao clicar no botão de engrenagem", () => {
    mockIsFamilyModeEnabled = true;
    mockFamilyData = {
      family: { id: "fam-1", name: "Família Silva" },
      currentMember: { user_id: "user-1", role: "owner" },
      members: [{ user_id: "user-1", role: "owner" }],
    };
    mockConsolidationData = sampleConsolidation;
    renderPage();

    const configBtn = screen.getByRole("button", { name: "Abrir configurações da família" });
    fireEvent.click(configBtn);

    expect(screen.getByRole("heading", { name: "Configurações da Família" })).toBeInTheDocument();
    expect(screen.getByText("Regras da Casa")).toBeInTheDocument();
  });

  it("abre o diálogo de configurações na aba de membros ao clicar em 'Convidar'", () => {
    mockIsFamilyModeEnabled = true;
    mockFamilyData = {
      family: { id: "fam-1", name: "Família Silva" },
      currentMember: { user_id: "user-1", role: "owner" },
      members: [{ user_id: "user-1", role: "owner" }],
    };
    mockConsolidationData = sampleConsolidation;
    renderPage();

    const inviteBtn = screen.getByRole("button", { name: /Convidar novo membro da família/i });
    fireEvent.click(inviteBtn);

    expect(screen.getByRole("heading", { name: "Configurações da Família" })).toBeInTheDocument();
    expect(screen.getByText("Convidar Familiar ou Parceiro")).toBeInTheDocument();
  });
});

