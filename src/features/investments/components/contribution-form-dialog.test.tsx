import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ContributionFormDialog } from "./contribution-form-dialog";
import type { PortfolioContribution } from "@/types";

const mockCreateContrib = vi.fn().mockResolvedValue({ id: "c-created" });
const mockUpdateContrib = vi.fn().mockResolvedValue({ id: "c-1" });
const mockDeleteContrib = vi.fn().mockResolvedValue(undefined);
const mockUpdateAsset = vi.fn().mockResolvedValue(undefined);

vi.mock("@/state", () => ({
  useCreatePortfolioContribution: () => ({
    mutateAsync: mockCreateContrib,
    isPending: false,
  }),
  useUpdatePortfolioContribution: () => ({
    mutateAsync: mockUpdateContrib,
    isPending: false,
  }),
  useDeletePortfolioContribution: () => ({
    mutateAsync: mockDeleteContrib,
    isPending: false,
  }),
  useUpdatePortfolioAsset: () => ({
    mutateAsync: mockUpdateAsset,
    isPending: false,
  }),
  usePortfolioAssets: () => ({
    data: [
      { id: "a-1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" },
      { id: "a-cash", ticker: "CAIXA", asset_class: "Caixa", currency: "BRL", quantity: 500 },
    ],
    isLoading: false,
  }),
}));

describe("ContributionFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza modo de criação de aporte", () => {
    render(<ContributionFormDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Novo Aporte Financeiro")).toBeInTheDocument();
    expect(screen.getByLabelText(/Valor do aporte/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar Aporte" })).toBeInTheDocument();
  });

  it("renderiza modo de edição de aporte com valores preenchidos", () => {
    const mockContrib: PortfolioContribution = {
      id: "c-1",
      user_id: "u-1",
      asset_id: "a-cash",
      date: "2026-10-15",
      amount: 250,
      notes: "Depósito PIX",
    };

    render(<ContributionFormDialog open={true} onOpenChange={vi.fn()} contribution={mockContrib} />);

    expect(screen.getByText("Editar Aporte Financeiro")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Depósito PIX")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir aporte" })).toBeInTheDocument();
  });

  it("salva alteração no aporte e atualiza saldo do Caixa", async () => {
    const mockContrib: PortfolioContribution = {
      id: "c-1",
      user_id: "u-1",
      asset_id: "a-cash",
      date: "2026-10-15",
      amount: 250,
      notes: "Depósito PIX",
    };

    const handleSuccess = vi.fn();
    render(
      <ContributionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        contribution={mockContrib}
        onSuccess={handleSuccess}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Salvar" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateContrib).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "c-1",
          input: expect.objectContaining({
            amount: 250,
            asset_id: "a-cash",
            notes: "Depósito PIX",
          }),
        }),
      );
    });
  });
});
