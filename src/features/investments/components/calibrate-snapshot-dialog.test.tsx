import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalibrateSnapshotDialog } from "./calibrate-snapshot-dialog";
import * as stateModule from "@/state";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("CalibrateSnapshotDialog", () => {
  it("renderiza os campos pré-preenchidos e informações do fechamento oficial", () => {
    renderWithClient(
      <CalibrateSnapshotDialog
        open={true}
        onOpenChange={vi.fn()}
        snapshot={{
          month: "2026-08",
          valueBRL: 95000,
          costBRL: 85000,
          autoTotalValue: 90000,
          autoTotalCost: 80000,
          isManuallyCalibrated: true,
        }}
      />,
    );

    expect(screen.getByText("Calibrar Mês Ago/2026")).toBeInTheDocument();
    expect(screen.getByText(/Fechamento de mercado oficial:/)).toBeInTheDocument();
    expect(screen.getByLabelText("Patrimônio Total (R$)")).toBeInTheDocument();
    expect(screen.getByLabelText("Custo Total Aplicado (R$)")).toBeInTheDocument();
  });

  it("submete a calibração com sucesso através da mutation", async () => {
    const mutateAsyncMock = vi.fn().mockResolvedValue({});
    vi.spyOn(stateModule, "useCalibratePortfolioSnapshot").mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useCalibratePortfolioSnapshot>);

    const onOpenChange = vi.fn();

    renderWithClient(
      <CalibrateSnapshotDialog
        open={true}
        onOpenChange={onOpenChange}
        snapshot={{
          month: "2026-08",
          valueBRL: 95000,
          costBRL: 85000,
          autoTotalValue: 90000,
          autoTotalCost: 80000,
          isManuallyCalibrated: true,
        }}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: "Salvar Calibração" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        month: "2026-08",
        total_value: 95000,
        total_cost: 85000,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
