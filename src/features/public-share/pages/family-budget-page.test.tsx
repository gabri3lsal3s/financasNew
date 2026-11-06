import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FamilyBudgetPage } from "./family-budget-page";
import * as publicShareQuery from "@/state/queries/use-public-shares";
import * as pwaInstallHook from "@/hooks/use-pwa-install";
import type { SharedFamilyBudgetResult } from "@/types";

vi.mock("@/state/queries/use-public-shares");
vi.mock("@/hooks/use-pwa-install");

const mockFamilyBudget: SharedFamilyBudgetResult = {
  token: "fam-test-123",
  month: "2026-11",
  owner_name: "Gabriel",
  monthly_ceiling_cents: 500000,
  total_spent_cents: 350000,
  remaining_cents: 150000,
  spent_percentage: 70,
  is_revoked: false,
  expires_at: null,
  expenses: [
    {
      id: "exp-1",
      description: "Supermercado Semanal",
      date: "2026-11-03",
      amount_cents: 250000,
    },
    {
      id: "exp-2",
      description: "Conta de Energia",
      date: "2026-11-04",
      amount_cents: 100000,
    },
  ],
};

function renderPage(token = "fam-test-123") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/orcamento-familiar/${token}`]}>
        <Routes>
          <Route path="/orcamento-familiar/:token" element={<FamilyBudgetPage />} />
          <Route path="/apresentacao" element={<div>Pagina Apresentacao</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FamilyBudgetPage (/orcamento-familiar/:token)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(pwaInstallHook, "usePWAInstall").mockReturnValue({
      canInstall: true,
      isIOS: false,
      isInstalled: false,
      isNativePromptAvailable: true,
      install: vi.fn(),
    });
  });

  it("exibe estado de carregamento esqueleto enquanto carrega os dados", () => {
    vi.spyOn(publicShareQuery, "useSharedFamilyBudget").mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedFamilyBudget>);

    renderPage();
    expect(document.querySelector(".animate-shimmer")).toBeInTheDocument();
  });

  it("exibe estado de link revogado ou inexistente quando os dados forem nulos", () => {
    vi.spyOn(publicShareQuery, "useSharedFamilyBudget").mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedFamilyBudget>);

    renderPage();
    expect(
      screen.getByText("Orçamento familiar não encontrado ou expirado"),
    ).toBeInTheDocument();
    expect(screen.getByText("Conhecer o Áxis Finance")).toBeInTheDocument();
  });

  it("exibe estado de link revogado quando is_revoked for true", () => {
    vi.spyOn(publicShareQuery, "useSharedFamilyBudget").mockReturnValue({
      data: { ...mockFamilyBudget, is_revoked: true },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedFamilyBudget>);

    renderPage();
    expect(
      screen.getByText("Orçamento familiar não encontrado ou expirado"),
    ).toBeInTheDocument();
  });

  it("renderiza os indicadores de teto, total gasto e saldo restante", () => {
    vi.spyOn(publicShareQuery, "useSharedFamilyBudget").mockReturnValue({
      data: mockFamilyBudget,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedFamilyBudget>);

    renderPage();

    expect(screen.getByText("Orçamento Familiar · Gabriel")).toBeInTheDocument();
    expect(screen.getAllByText("Orçamento Familiar").length).toBeGreaterThan(0);
    expect(screen.getByText("Dentro do Teto (70%)")).toBeInTheDocument();
    expect(screen.getByText("70% consumido")).toBeInTheDocument();

    // KPIs
    expect(screen.getByText("Teto do Mês")).toBeInTheDocument();
    expect(screen.getByText("Total Gasto")).toBeInTheDocument();
    expect(screen.getByText("Saldo Restante")).toBeInTheDocument();
    expect(screen.getByText("Disponível até o final do mês")).toBeInTheDocument();

    // Lista de despesas
    expect(screen.getByText("Supermercado Semanal")).toBeInTheDocument();
    expect(screen.getByText("Conta de Energia")).toBeInTheDocument();
    expect(screen.getByText("03/11/2026")).toBeInTheDocument();
    expect(screen.getByText("04/11/2026")).toBeInTheDocument();
  });

  it("exibe badge de atencao quando consumo estiver proximo ao teto", () => {
    vi.spyOn(publicShareQuery, "useSharedFamilyBudget").mockReturnValue({
      data: {
        ...mockFamilyBudget,
        spent_percentage: 90,
        total_spent_cents: 450000,
        remaining_cents: 50000,
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedFamilyBudget>);

    renderPage();
    expect(screen.getByText("Atenção (90%)")).toBeInTheDocument();
  });

  it("exibe badge de teto excedido quando saldo restante for negativo", () => {
    vi.spyOn(publicShareQuery, "useSharedFamilyBudget").mockReturnValue({
      data: {
        ...mockFamilyBudget,
        spent_percentage: 110,
        total_spent_cents: 550000,
        remaining_cents: -50000,
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedFamilyBudget>);

    renderPage();
    expect(screen.getByText("Teto Excedido (110%)")).toBeInTheDocument();
    expect(screen.getByText("Excedente acima do planejado")).toBeInTheDocument();
  });

  it("lida corretamente com orcamento sem despesas lancadas", () => {
    vi.spyOn(publicShareQuery, "useSharedFamilyBudget").mockReturnValue({
      data: {
        ...mockFamilyBudget,
        total_spent_cents: 0,
        remaining_cents: 500000,
        spent_percentage: 0,
        expenses: [],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedFamilyBudget>);

    renderPage();
    expect(
      screen.getByText("Nenhuma despesa familiar registrada neste mês"),
    ).toBeInTheDocument();
  });

  it("aciona instalador PWA quando usuario clica em Adicionar a Tela Inicial", async () => {
    const user = userEvent.setup();
    const installMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(pwaInstallHook, "usePWAInstall").mockReturnValue({
      canInstall: true,
      isIOS: false,
      isInstalled: false,
      isNativePromptAvailable: true,
      install: installMock,
    });

    vi.spyOn(publicShareQuery, "useSharedFamilyBudget").mockReturnValue({
      data: mockFamilyBudget,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedFamilyBudget>);

    renderPage();

    const addBtn = screen.getByRole("button", { name: /Adicionar à Tela Inicial/i });
    await user.click(addBtn);

    expect(installMock).toHaveBeenCalledTimes(1);
  });

  it("abre dialogo de instrucoes quando no iOS", async () => {
    const user = userEvent.setup();
    vi.spyOn(pwaInstallHook, "usePWAInstall").mockReturnValue({
      canInstall: false,
      isIOS: true,
      isInstalled: false,
      isNativePromptAvailable: false,
      install: vi.fn(),
    });

    vi.spyOn(publicShareQuery, "useSharedFamilyBudget").mockReturnValue({
      data: mockFamilyBudget,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedFamilyBudget>);

    renderPage();

    const iosBtn = screen.getByRole("button", { name: /Como fixar no iPhone/i });
    await user.click(iosBtn);

    expect(screen.getByRole("heading", { name: "Instalar no iPhone ou iPad" })).toBeInTheDocument();
  });
});
