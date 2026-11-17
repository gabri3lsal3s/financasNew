import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TargetsTab } from "./targets-tab";

const saveTargetsMock = vi.fn();

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
      { assetId: "a1", ticker: "PETR4", assetClass: "Ações", valueBRL: 4000, pct: 40, isCash: false },
      { assetId: "a2", ticker: "VALE3", assetClass: "Ações", valueBRL: 4000, pct: 40, isCash: false },
      { assetId: "a3", ticker: "MXRF11", assetClass: "FIIs", valueBRL: 2000, pct: 20, isCash: false },
    ],
    isLoading: false,
    error: null,
  }),
  useAllocationTargets: () => ({
    data: [
      { id: "t1", user_id: "u1", asset_id: "a1", target_percentage: 30 },
      { id: "t2", user_id: "u1", asset_id: "a2", target_percentage: 30 },
      { id: "t3", user_id: "u1", asset_id: "a3", target_percentage: 20 },
    ],
    isLoading: false,
    error: null,
  }),
  useGroupTargets: () => ({
    data: [{ id: "g1", user_id: "u1", name: "Ações", group_type: "class", target_percentage: 60 }],
    isLoading: false,
    error: null,
  }),
  useSaveAllocationTargets: () => ({
    mutateAsync: saveTargetsMock,
    isPending: false,
  }),
  useSaveGroupTarget: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRemoveGroupTarget: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  usePortfolioAssets: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useUpdatePortfolioAsset: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("TargetsTab — Fase 39 Normalização de Metas & Ações Rápidas", () => {
  beforeEach(() => {
    saveTargetsMock.mockClear();
  });

  function renderTargetsTab() {
    return render(
      <MemoryRouter>
        <TargetsTab />
      </MemoryRouter>,
    );
  }

  it("renderiza a aba Classes como padrão e permite salvar todas as classes", async () => {
    renderTargetsTab();

    expect(screen.getByText("Metas por classe de ativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Normalizar classes para 100%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Distribuir igualmente (1/N)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar todas as classes" })).toBeInTheDocument();
  });

  it("renderiza a tabela de metas por ativo e exibe os botões de ações rápidas ao abrir a aba Ativos", async () => {
    saveTargetsMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderTargetsTab();

    // Clica na aba Ativos
    await user.click(screen.getByRole("tab", { name: "Ativos" }));

    expect(screen.getByText("Metas por ativo (% do patrimônio)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Normalizar para 100%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Distribuir igualmente (1/N)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Espelhar carteira atual" })).toBeInTheDocument();

    // Clica em Normalizar para 100%
    await user.click(screen.getByRole("button", { name: "Normalizar para 100%" }));

    // Clica em Salvar metas por ativo
    await user.click(screen.getByRole("button", { name: "Salvar metas por ativo" }));

    expect(saveTargetsMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ assetId: "a1", target: 37.5 }),
        expect.objectContaining({ assetId: "a2", target: 37.5 }),
        expect.objectContaining({ assetId: "a3", target: 25 }),
      ]),
    );
  });

  it("permite distribuir igualmente (1/N) entre todos os ativos", async () => {
    saveTargetsMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderTargetsTab();

    await user.click(screen.getByRole("tab", { name: "Ativos" }));
    await user.click(screen.getByRole("button", { name: "Distribuir igualmente (1/N)" }));
    await user.click(screen.getByRole("button", { name: "Salvar metas por ativo" }));

    expect(saveTargetsMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ assetId: "a1", target: 33.33 }),
        expect.objectContaining({ assetId: "a2", target: 33.33 }),
        expect.objectContaining({ assetId: "a3", target: 33.34 }),
      ]),
    );
  });

  it("permite espelhar a carteira atual", async () => {
    saveTargetsMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderTargetsTab();

    await user.click(screen.getByRole("tab", { name: "Ativos" }));
    await user.click(screen.getByRole("button", { name: "Espelhar carteira atual" }));
    await user.click(screen.getByRole("button", { name: "Salvar metas por ativo" }));

    expect(saveTargetsMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ assetId: "a1", target: 40 }),
        expect.objectContaining({ assetId: "a2", target: 40 }),
        expect.objectContaining({ assetId: "a3", target: 20 }),
      ]),
    );
  });

  it("respeita o filtro de classe ao normalizar a classe selecionada", async () => {
    saveTargetsMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderTargetsTab();

    await user.click(screen.getByRole("tab", { name: "Ativos" }));

    // Filtra para "Ações"
    await user.click(screen.getByRole("button", { name: "Ações" }));

    // Botão de normalização agora é contextual com teto da classe (60%)
    expect(screen.getByRole("button", { name: /Normalizar Ações para 60/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Normalizar Ações para 60/i }));
    await user.click(screen.getByRole("button", { name: "Salvar metas por ativo" }));

    // Ações a1 e a2 (30 e 30) normalizadas para 60% total -> 30 e 30; a3 permanece 20
    expect(saveTargetsMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ assetId: "a1", target: 30 }),
        expect.objectContaining({ assetId: "a2", target: 30 }),
        expect.objectContaining({ assetId: "a3", target: 20 }),
      ]),
    );
  });

  it("permite descartar alterações do rascunho de metas em 1 toque (Salvaguarda S24)", async () => {
    const user = userEvent.setup();
    renderTargetsTab();

    // Clica no botão de normalização para alterar o rascunho
    const normalizeBtn = screen.getByRole("button", { name: /Normalizar classes para 100%/i });
    await user.click(normalizeBtn);

    // Barra de rascunho deve surgir
    expect(screen.getByText(/Existem alterações não salvas no rascunho de metas/i)).toBeInTheDocument();
    const discardBtn = screen.getByRole("button", { name: "Descartar alterações" });
    expect(discardBtn).toBeInTheDocument();

    // Clica para descartar
    await user.click(discardBtn);

    // O aviso de rascunho deve sumir e o valor original ser restaurado
    expect(screen.queryByText(/Existem alterações não salvas no rascunho de metas/i)).not.toBeInTheDocument();
  });

  it("exibe barra de progresso, botão Distribuir Restante e preserva data-tour (Fase 10 / B10)", async () => {
    const user = userEvent.setup();
    renderTargetsTab();

    // Preserva data-tour do card de classes (B10)
    const classesCard = screen.getByRole("region", { name: "Metas por classe" });
    expect(classesCard).toHaveAttribute("data-tour", "targets-classes-card");

    // Verifica presença da barra de progresso macro (Ações tem meta 60%, FIIs tem 0% -> soma 60%, faltam 40%)
    expect(screen.getByText("Total alocado em classes:")).toBeInTheDocument();
    expect(screen.getByText(/Faltam 40\.0%/i)).toBeInTheDocument();

    // Botão 1-toque Distribuir Restante
    const distributeRemainingBtn = screen.getByRole("button", { name: /Distribuir restante \(40\.0%\)/i });
    expect(distributeRemainingBtn).toBeInTheDocument();

    // Clica no botão para fechar 100%
    await user.click(distributeRemainingBtn);

    // Agora deve estar em 100% completo
    expect(screen.getByText(/Completo/i)).toBeInTheDocument();

    // Navega para aba Ativos e valida data-tour (B10)
    await user.click(screen.getByRole("tab", { name: "Ativos" }));
    const assetsCard = screen.getByRole("region", { name: "Metas por ativo" });
    expect(assetsCard).toHaveAttribute("data-tour", "targets-assets-card");
  });
});
