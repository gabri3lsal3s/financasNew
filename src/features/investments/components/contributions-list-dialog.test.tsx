import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContributionsListDialog } from "./contributions-list-dialog";

const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockCreate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/state", () => ({
  usePortfolioContributions: () => ({
    data: [
      { id: "c-1", user_id: "u-1", asset_id: "a-1", date: "2026-08-10", amount: 1500, notes: "Aporte mensal em PETR4" },
      { id: "c-2", user_id: "u-1", asset_id: null, date: "2026-08-15", amount: 500, notes: "Transferência para corretora" },
    ],
    isLoading: false,
  }),
  usePortfolioAssets: () => ({
    data: [{ id: "a-1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" }],
    isLoading: false,
  }),
  useCreatePortfolioContribution: () => ({
    mutateAsync: mockCreate,
    isPending: false,
  }),
  useDeletePortfolioContribution: () => ({
    mutateAsync: mockDelete,
    isPending: false,
  }),
}));

describe("ContributionsListDialog — Fase 37", () => {
  it("renderiza os aportes do mês selecionado e totalizador", () => {
    render(<ContributionsListDialog open={true} onOpenChange={vi.fn()} defaultMonth="2026-08" />);

    expect(screen.getByText("Gerenciar Aportes do Mês")).toBeInTheDocument();
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("Geral / Caixa")).toBeInTheDocument();
    expect(screen.getByText("Aporte mensal em PETR4")).toBeInTheDocument();
    expect(screen.getByText("Transferência para corretora")).toBeInTheDocument();
    expect(screen.getByText("2 registros")).toBeInTheDocument();
  });

  it("abre diálogo de confirmação ao clicar no botão de excluir aporte", () => {
    render(<ContributionsListDialog open={true} onOpenChange={vi.fn()} defaultMonth="2026-08" />);

    const deleteButtons = screen.getAllByRole("button", { name: /Excluir aporte/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    const firstButton = deleteButtons[0];
    if (!firstButton) throw new Error("Botão de exclusão não encontrado");
    fireEvent.click(firstButton);

    expect(screen.getByText("Excluir lançamento de aporte?")).toBeInTheDocument();
  });
});
