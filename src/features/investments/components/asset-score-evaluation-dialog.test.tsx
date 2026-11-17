import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AssetScoreEvaluationDialog } from "./asset-score-evaluation-dialog";
import type { PortfolioAsset } from "@/types";

const mockUpdateAsset = vi.fn();

vi.mock("@/state", () => ({
  useUpdatePortfolioAsset: () => ({
    mutateAsync: mockUpdateAsset,
    isPending: false,
  }),
}));

const mockAsset: PortfolioAsset = {
  id: "asset-wege-1",
  user_id: "user-1",
  ticker: "WEGE3",
  asset_class: "Ações",
  sector: "Motores",
  currency: "BRL",
  quantity: 100,
  average_price: 40,
  score: 8,
  allocation_status: "active",
  score_criteria: { roic: 1, moat: 1 },
  last_reviewed_at: "2026-06-01T00:00:00.000Z",
  review_frequency_months: 6,
  thesis_summary: "Líder global em motores com forte rentabilidade.",
};

describe("AssetScoreEvaluationDialog (§F41)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateAsset.mockResolvedValue({ ...mockAsset, score: 9 });
  });

  it("renderiza os dados de avaliação do ativo (ticker, nota, status e tese)", () => {
    render(
      <AssetScoreEvaluationDialog
        open={true}
        onOpenChange={vi.fn()}
        asset={mockAsset}
      />,
    );

    expect(screen.getByText(/Avaliação de Tese: WEGE3/i)).toBeInTheDocument();
    expect(screen.getByText(/8 \/ 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Alta Convicção/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Líder global em motores/i)).toBeInTheDocument();
  });

  it("permite alterar a nota e atualiza o semáforo cognitivo", () => {
    render(
      <AssetScoreEvaluationDialog
        open={true}
        onOpenChange={vi.fn()}
        asset={mockAsset}
      />,
    );

    const button9 = screen.getByRole("button", { name: "Nota 9" });
    fireEvent.click(button9);

    expect(screen.getByText(/9 \/ 10/i)).toBeInTheDocument();
  });

  it("permite alterar o status para Quarentena", () => {
    render(
      <AssetScoreEvaluationDialog
        open={true}
        onOpenChange={vi.fn()}
        asset={mockAsset}
      />,
    );

    const quarantineBtn = screen.getByRole("button", { name: /Quarentena/i });
    fireEvent.click(quarantineBtn);

    expect(quarantineBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("salva a avaliação chamando useUpdatePortfolioAsset com os dados atualizados", async () => {
    const handleOpenChange = vi.fn();
    render(
      <AssetScoreEvaluationDialog
        open={true}
        onOpenChange={handleOpenChange}
        asset={mockAsset}
      />,
    );

    // Altera nota para 10
    const button10 = screen.getByRole("button", { name: "Nota 10" });
    fireEvent.click(button10);

    // Clica em Salvar
    const saveButton = screen.getByRole("button", { name: /Salvar Avaliação/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "asset-wege-1",
          patch: expect.objectContaining({
            score: 10,
            allocation_status: "active",
            review_frequency_months: 6,
            thesis_summary: "Líder global em motores com forte rentabilidade.",
          }),
        }),
      );
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
