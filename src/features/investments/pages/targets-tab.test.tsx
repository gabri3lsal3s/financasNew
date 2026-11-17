import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TargetsTab } from "./targets-tab";

const saveHierarchyTargetsMock = vi.fn();
const saveGroupTargetMock = vi.fn();
const removeGroupTargetMock = vi.fn();

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
  usePermission: () => ({
    canWrite: true,
    canRead: true,
    isHidden: false,
    isReadOnlyMode: false,
    accessLevel: "write",
  }),
  usePortfolioPosition: () => ({
    rows: [
      {
        assetId: "a1",
        ticker: "PETR4",
        assetClass: "Ações",
        sector: "Petróleo",
        valueBRL: 4000,
        pct: 33.33,
        isCash: false,
      },
      {
        assetId: "a2",
        ticker: "VALE3",
        assetClass: "Ações",
        sector: "Mineração",
        valueBRL: 4000,
        pct: 33.33,
        isCash: false,
      },
      {
        assetId: "a3",
        ticker: "MXRF11",
        assetClass: "FIIs",
        sector: "Papel",
        valueBRL: 2000,
        pct: 16.67,
        isCash: false,
      },
      {
        assetId: "c1",
        ticker: "CAIXA",
        assetClass: "Caixa",
        sector: null,
        valueBRL: 2000,
        pct: 16.67,
        isCash: true,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useGroupTargets: (groupType: "class" | "sector") => ({
    data:
      groupType === "class"
        ? [{ id: "g1", user_id: "u1", name: "Ações", group_type: "class", target_percentage: 60 }]
        : [
            {
              id: "s1",
              user_id: "u1",
              name: "Petróleo",
              class_name: "Ações",
              group_type: "sector",
              target_percentage: 50,
            },
          ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSaveGroupTarget: () => ({
    mutateAsync: saveGroupTargetMock,
    isPending: false,
  }),
  useRemoveGroupTarget: () => ({
    mutateAsync: removeGroupTargetMock,
    isPending: false,
  }),
  useSaveHierarchyTargets: () => ({
    mutateAsync: saveHierarchyTargetsMock,
    isPending: false,
  }),
  usePortfolioAssets: () => ({
    data: [
      {
        id: "a1",
        user_id: "u1",
        ticker: "PETR4",
        name: "Petrobras PN",
        asset_class: "Ações",
        sector: "Petróleo",
        currency: "BRL",
        score: null,
        allocation_status: "active",
      },
      {
        id: "a2",
        user_id: "u1",
        ticker: "VALE3",
        name: "Vale ON",
        asset_class: "Ações",
        sector: "Mineração",
        currency: "BRL",
        score: 8,
        allocation_status: "active",
      },
      {
        id: "a3",
        user_id: "u1",
        ticker: "MXRF11",
        name: "Maxi Renda",
        asset_class: "FIIs",
        sector: "Papel",
        currency: "BRL",
        score: 6,
        allocation_status: "quarantine",
      },
    ],
    isLoading: false,
    error: null,
  }),
  useUpdatePortfolioAsset: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("TargetsTab — Plano 42 Governança em 3 Níveis (Classes %, Setores % escopados, Notas 0-10)", () => {
  beforeEach(() => {
    saveHierarchyTargetsMock.mockReset();
    saveGroupTargetMock.mockReset();
    removeGroupTargetMock.mockReset();
  });

  function renderTargetsTab() {
    return render(
      <MemoryRouter>
        <TargetsTab />
      </MemoryRouter>,
    );
  }

  it("renderiza a aba Classes como padrão excluindo Caixa e salva via saveHierarchyTargets", async () => {
    saveHierarchyTargetsMock.mockResolvedValue(true);
    const user = userEvent.setup();
    renderTargetsTab();

    expect(screen.getByText("Metas por classe de ativo")).toBeInTheDocument();
    expect(screen.getByText("2 classes")).toBeInTheDocument();
    expect(screen.queryByText("Caixa")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Meta da classe Ações em %")).toBeInTheDocument();
    expect(screen.getByLabelText("Meta da classe FIIs em %")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Distribuir restante \(40\.0%\)/i }));
    await user.click(screen.getByRole("button", { name: "Salvar todas as classes" }));

    expect(saveHierarchyTargetsMock).toHaveBeenCalledWith({
      classes: [
        { name: "Ações", target_percentage: 60 },
        { name: "FIIs", target_percentage: 40 },
      ],
      sectors: [{ class_name: "Ações", name: "Petróleo", target_percentage: 50 }],
    });
  });

  it("renderiza sub-aba Setores com aviso de opcionalidade e persiste escopado por className", async () => {
    saveHierarchyTargetsMock.mockResolvedValue(true);
    const user = userEvent.setup();
    renderTargetsTab();

    await user.click(screen.getByRole("tab", { name: "Setores" }));

    expect(screen.getByText("Metas setoriais por classe")).toBeInTheDocument();
    expect(screen.getByText(/Opcional: defina a proporção/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar setores de Ações" }));

    expect(saveHierarchyTargetsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        classes: [{ name: "Ações", target_percentage: 60 }],
        sectors: [{ class_name: "Ações", name: "Petróleo", target_percentage: 50 }],
      }),
    );
  });

  it("exibe Nível 3 Notas & Status na aba Ativos sem inputs manuais de %, mostrando 'Sem nota' e abrindo avaliação", async () => {
    const user = userEvent.setup();
    renderTargetsTab();

    await user.click(screen.getByRole("tab", { name: "Ativos" }));

    const assetsCard = screen.getByRole("region", { name: "Notas e status por ativo" });
    expect(assetsCard).toHaveAttribute("data-tour", "targets-assets-card");
    expect(screen.getByText("Notas e status dos ativos")).toBeInTheDocument();

    // Zero inputs manuais de % para ativos
    expect(screen.queryByText(/Salvar metas por ativo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /PETR4/i })).not.toBeInTheDocument();

    // Sem nota real para PETR4 (nunca fake Nota 8!), Nota 8/10 para VALE3 e Quarentena para MXRF11
    expect(screen.getByText("Sem nota")).toBeInTheDocument();
    expect(screen.getByText("Nota 8/10")).toBeInTheDocument();
    expect(screen.getByText("Quarentena")).toBeInTheDocument();

    // Clica para avaliar PETR4
    await user.click(screen.getByRole("button", { name: "Avaliar nota e status de PETR4" }));
    expect(screen.getByText(/Avaliação de Tese: PETR4/i)).toBeInTheDocument();
  });

  it("permite descartar alterações do rascunho de metas em 1 toque (Salvaguarda S24)", async () => {
    const user = userEvent.setup();
    renderTargetsTab();

    await user.click(screen.getByRole("button", { name: /Normalizar classes para 100%/i }));

    expect(screen.getByText(/Existem alterações não salvas no rascunho de metas/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Descartar alterações" }));

    expect(screen.queryByText(/Existem alterações não salvas no rascunho de metas/i)).not.toBeInTheDocument();
  });

  it("exibe barra de progresso, botão Distribuir Restante e preserva data-tour das classes", async () => {
    const user = userEvent.setup();
    renderTargetsTab();

    const classesCard = screen.getByRole("region", { name: "Metas por classe" });
    expect(classesCard).toHaveAttribute("data-tour", "targets-classes-card");

    expect(screen.getByText("Total alocado em classes:")).toBeInTheDocument();
    expect(screen.getByText(/Faltam 40\.0%/i)).toBeInTheDocument();

    const distributeRemainingBtn = screen.getByRole("button", { name: /Distribuir restante \(40\.0%\)/i });
    await user.click(distributeRemainingBtn);

    expect(screen.getByText(/Completo/i)).toBeInTheDocument();
  });
});
