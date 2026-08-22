import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { triggerSensory } from "@/services/sensory";
import { ManualPriceDialog } from "./manual-price-dialog";

const setManualMock = vi.fn();
const removeManualMock = vi.fn();

vi.mock("@/services/sensory", () => ({ triggerSensory: vi.fn() }));

vi.mock("@/state", () => ({
  useSetManualPrice: () => ({ mutateAsync: setManualMock, isPending: false }),
  useRemoveManualPrice: () => ({ mutateAsync: removeManualMock, isPending: false }),
}));

const mockAssetApi = {
  id: "a1",
  ticker: "PETR4",
  currency: "BRL" as const,
  priceBRL: 38.5,
  source: "api" as const,
};

const mockAssetManual = {
  id: "a2",
  ticker: "VALE3",
  currency: "BRL" as const,
  priceBRL: 60.0,
  source: "manual" as const,
};

describe("ManualPriceDialog", () => {
  beforeEach(() => {
    setManualMock.mockReset();
    removeManualMock.mockReset();
    vi.mocked(triggerSensory).mockClear();
  });

  it("permite salvar preço manual para um ativo com cotação de api", async () => {
    setManualMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ManualPriceDialog open={true} onOpenChange={vi.fn()} asset={mockAssetApi} />);

    expect(screen.getByText("Cotação · PETR4")).toBeInTheDocument();
    expect(screen.getByText("Cotação API")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Preço manual do ativo"), "40.50");
    await user.click(screen.getByRole("button", { name: "Salvar preço" }));

    expect(setManualMock).toHaveBeenCalledTimes(1);
    expect(setManualMock).toHaveBeenCalledWith({
      ticker: "PETR4",
      price: 40.5,
    });
    expect(triggerSensory).toHaveBeenCalledWith("success");
  });

  it("permite restaurar cotação automática em um ativo com preço manual", async () => {
    removeManualMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ManualPriceDialog open={true} onOpenChange={vi.fn()} asset={mockAssetManual} />);

    expect(screen.getByText("Cotação · VALE3")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();

    const restoreBtn = screen.getByRole("button", { name: "Usar cotação automática" });
    expect(restoreBtn).toBeInTheDocument();
    await user.click(restoreBtn);

    expect(removeManualMock).toHaveBeenCalledTimes(1);
    expect(removeManualMock).toHaveBeenCalledWith("VALE3");
    expect(triggerSensory).toHaveBeenCalledWith("success");
  });
});
