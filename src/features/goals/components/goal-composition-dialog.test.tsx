import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoalCompositionDialog } from "./goal-composition-dialog";

vi.mock("@/state", () => ({
  useRealCashBalance: () => ({
    cashBalance: { currentBalanceCents: 250000 },
  }),
  usePortfolioPosition: () => ({
    isLoading: false,
    rows: [
      {
        assetId: "asset-1",
        ticker: "WEGE3",
        assetClass: "Ações",
        quantity: 100,
        valueBRL: 5000,
        totalCostBRL: 4000,
      },
      {
        assetId: "asset-2",
        ticker: "HGLG11",
        assetClass: "FIIs",
        quantity: 20,
        valueBRL: 3200,
        totalCostBRL: 3000,
      },
    ],
  }),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("GoalCompositionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite marcar e desmarcar ativos diretamente pelo checkbox sem duplo toggle", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <GoalCompositionDialog
        open={true}
        onOpenChange={onOpenChange}
        targetCents={1000000}
        goalTitle="Reserva"
        config={{
          includeCheckingAccounts: false,
          accountIds: null,
          includeInvestments: true,
          investmentMode: "selected_assets",
          assetIds: [],
          classes: [],
          allocationCapCents: null,
          isCompletedLocked: false,
        }}
        onSave={onSave}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    // checkboxes[0] = checking, [1] = investments, [2] = WEGE3, [3] = HGLG11
    const wegeCheckbox = checkboxes[2]!;
    expect(wegeCheckbox).not.toBeChecked();

    await user.click(wegeCheckbox);
    expect(wegeCheckbox).toBeChecked();

    await user.click(screen.getByText("HGLG11"));
    expect(checkboxes[3]).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      includeInvestments: true,
      assetIds: ["asset-1", "asset-2"],
    });
  });
});
