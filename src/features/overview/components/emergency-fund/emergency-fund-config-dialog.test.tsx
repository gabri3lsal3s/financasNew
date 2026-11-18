import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmergencyFundConfigDialog } from "./emergency-fund-config-dialog";
import type { PortfolioPositionRowLike } from "@/domain/projection";
import type { EmergencyFundConfig } from "@/types";
import * as sensoryService from "@/services/sensory";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

const baseConfig: EmergencyFundConfig = {
  includeCheckingAccounts: true,
  selectionMode: "selected_assets",
  selectedAssetIds: ["asset-selic"],
  selectedClasses: ["Caixa"],
  useNetValue: true,
  targetMonths: 6,
};

const mockRows: PortfolioPositionRowLike[] = [
  {
    assetId: "asset-selic",
    ticker: "TESOURO SELIC",
    assetClass: "Tesouro Direto",
    quantity: 1,
    valueBRL: 10000,
    netValueBRL: 9500,
    isCash: true,
  },
  {
    assetId: "asset-cdb",
    ticker: "CDB CDI 100%",
    assetClass: "Renda Fixa",
    quantity: 1,
    valueBRL: 5000,
    netValueBRL: 4800,
    isCash: false,
  },
];

describe("EmergencyFundConfigDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("alterna ativo apenas uma vez ao clicar diretamente no checkbox ou no rótulo (sem bug de duplo toggle)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EmergencyFundConfigDialog
        open={true}
        onOpenChange={vi.fn()}
        config={baseConfig}
        onSave={onSave}
        realCashCents={200000}
        portfolioRows={mockRows}
        monthlyExpensesCents={300000}
      />,
    );

    const cdbCheckbox = screen.getByRole("checkbox", { name: "Selecionar CDB CDI 100%" });
    expect(cdbCheckbox).not.toBeChecked();

    // Clique direto no Checkbox deve marcar em 1 único disparo
    await user.click(cdbCheckbox);
    expect(cdbCheckbox).toBeChecked();

    // Clique no rótulo associado também deve desmarcar em 1 único disparo
    await user.click(screen.getByText("CDB CDI 100%"));
    expect(cdbCheckbox).not.toBeChecked();
  });

  it("alterna classe apenas uma vez e emite feedback sensorial ao trocar o modo", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EmergencyFundConfigDialog
        open={true}
        onOpenChange={vi.fn()}
        config={baseConfig}
        onSave={onSave}
        realCashCents={200000}
        portfolioRows={mockRows}
        monthlyExpensesCents={300000}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Por Classes Inteiras/i }));
    expect(sensoryService.triggerSensory).toHaveBeenCalledWith("selection");

    const rfCheckbox = screen.getByRole("checkbox", { name: "Selecionar classe Renda Fixa" });
    expect(rfCheckbox).not.toBeChecked();

    await user.click(rfCheckbox);
    expect(rfCheckbox).toBeChecked();

    await user.click(screen.getByText("Renda Fixa"));
    expect(rfCheckbox).not.toBeChecked();
  });

  it("reseta alterações não salvas ao fechar e reabrir o modal", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <EmergencyFundConfigDialog
        open={true}
        onOpenChange={onOpenChange}
        config={baseConfig}
        onSave={vi.fn().mockResolvedValue(undefined)}
        realCashCents={200000}
        portfolioRows={mockRows}
        monthlyExpensesCents={300000}
      />,
    );

    const cdbCheckbox = screen.getByRole("checkbox", { name: "Selecionar CDB CDI 100%" });
    await user.click(cdbCheckbox);
    expect(cdbCheckbox).toBeChecked();

    // Fecha e reabre sem salvar
    rerender(
      <EmergencyFundConfigDialog
        open={false}
        onOpenChange={onOpenChange}
        config={baseConfig}
        onSave={vi.fn().mockResolvedValue(undefined)}
        realCashCents={200000}
        portfolioRows={mockRows}
        monthlyExpensesCents={300000}
      />,
    );
    rerender(
      <EmergencyFundConfigDialog
        open={true}
        onOpenChange={onOpenChange}
        config={baseConfig}
        onSave={vi.fn().mockResolvedValue(undefined)}
        realCashCents={200000}
        portfolioRows={mockRows}
        monthlyExpensesCents={300000}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Selecionar CDB CDI 100%" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
