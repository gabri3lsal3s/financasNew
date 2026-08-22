import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
      { id: "t1", user_id: "u1", asset_id: "a1", target_percentage: 50 },
      { id: "t2", user_id: "u1", asset_id: "a2", target_percentage: 50 },
      { id: "t3", user_id: "u1", asset_id: "a3", target_percentage: 50 },
    ],
    isLoading: false,
    error: null,
  }),
  useGroupTargets: () => ({
    data: [],
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

describe("TargetsTab — Fase 39 Normalização de Metas & Travas", () => {
  it("renderiza a tabela de metas por ativo e exibe o botão Normalizar para 100%", async () => {
    saveTargetsMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TargetsTab />);

    expect(screen.getByText("Metas por ativo (% do patrimônio)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Normalizar para 100%" })).toBeInTheDocument();

    // Clica em Normalizar para 100%
    await user.click(screen.getByRole("button", { name: "Normalizar para 100%" }));

    // Clica em Salvar metas por ativo
    await user.click(screen.getByRole("button", { name: "Salvar metas por ativo" }));

    expect(saveTargetsMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ assetId: "a1", target: 33.33 }),
        expect.objectContaining({ assetId: "a2", target: 33.33 }),
        expect.objectContaining({ assetId: "a3", target: 33.34 }),
      ]),
    );
  });
});
