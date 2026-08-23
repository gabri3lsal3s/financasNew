import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TargetsTab } from "./targets-tab";

const saveTargetsMock = vi.fn();

vi.mock("@/state", () => ({
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
  useSectorCaps: () => ({
    data: { max_sector_acoes: 25, max_sector_fiis: 30 },
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
  useUpdateSectorCaps: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("TargetsTab — Fase 39 Normalização de Metas & Ações Rápidas", () => {
  beforeEach(() => {
    saveTargetsMock.mockClear();
  });

  it("renderiza a tabela de metas por ativo e exibe os botões de ações rápidas", async () => {
    saveTargetsMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TargetsTab />);

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
    render(<TargetsTab />);

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
    render(<TargetsTab />);

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
    render(<TargetsTab />);

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
});
