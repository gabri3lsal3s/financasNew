import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { AssetSplitDialog } from "./asset-split-dialog";
import type { PortfolioAsset } from "@/types";

const updateAssetMock = vi.fn();
const createTxMock = vi.fn();

vi.mock("@/services/sensory", () => ({ triggerSensory: vi.fn() }));
vi.mock("@/services/toast", () => ({ pushToast: vi.fn() }));

vi.mock("@/state", () => ({
  useUpdatePortfolioAsset: () => ({ mutateAsync: updateAssetMock, isPending: false }),
  useCreatePortfolioTransaction: () => ({ mutateAsync: createTxMock, isPending: false }),
}));

const mockAsset: PortfolioAsset = {
  id: "asset-1",
  user_id: "user-1",
  ticker: "PETR4",
  asset_class: "Ações",
  currency: "BRL",
  quantity: 100,
  average_price: 30,
};

describe("AssetSplitDialog — Desdobramentos e Grupamentos", () => {
  beforeEach(() => {
    updateAssetMock.mockReset();
    createTxMock.mockReset();
    vi.mocked(triggerSensory).mockClear();
    vi.mocked(pushToast).mockClear();
  });

  it("renderiza os campos de proporção e a prévia do ajuste de cotas e PM", () => {
    render(<AssetSplitDialog open={true} onOpenChange={vi.fn()} asset={mockAsset} />);

    expect(screen.getByText(/Ajuste Societário · PETR4/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cotas antes da proporção/i)).toHaveValue("1");
    expect(screen.getByLabelText(/Cotas após a proporção/i)).toHaveValue("2");
    expect(screen.getByText(/100 cotas @ BRL 30.00/i)).toBeInTheDocument();
  });

  it("aplica atalho 1:10 e atualiza a custódia preservando custo invariante e gravando no ledger", async () => {
    updateAssetMock.mockResolvedValue({});
    createTxMock.mockResolvedValue({});
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<AssetSplitDialog open={true} onOpenChange={onOpenChange} asset={mockAsset} />);

    // Clica no atalho 1:10 (10x)
    const shortcut10x = screen.getByRole("button", { name: /1:10 \(10x\)/i });
    await user.click(shortcut10x);

    // Clica no botão de confirmação
    const confirmButton = screen.getByRole("button", { name: /Confirmar Desdobramento \(Split\)/i });
    await user.click(confirmButton);

    expect(createTxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "asset-1",
        type: "split",
        quantity: 10,
        price: 0,
        total: 0,
      }),
    );

    expect(updateAssetMock).toHaveBeenCalledWith({
      id: "asset-1",
      patch: {
        quantity: 1000,
        average_price: 3,
      },
    });

    expect(triggerSensory).toHaveBeenCalledWith("success");
    expect(pushToast).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("aplica grupamento (reverse split) gravando no ledger e atualizando custódia", async () => {
    updateAssetMock.mockResolvedValue({});
    createTxMock.mockResolvedValue({});
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<AssetSplitDialog open={true} onOpenChange={onOpenChange} asset={mockAsset} />);

    // Atalho 10:1 (inverso)
    const shortcutReverse = screen.getByRole("button", { name: /10:1/i });
    await user.click(shortcutReverse);

    const confirmButton = screen.getByRole("button", { name: /Confirmar Grupamento \(Reverse Split\)/i });
    await user.click(confirmButton);

    expect(createTxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "asset-1",
        type: "reverse_split",
        quantity: 10,
        price: 0,
        total: 0,
      }),
    );

    expect(updateAssetMock).toHaveBeenCalledWith({
      id: "asset-1",
      patch: {
        quantity: 10,
        average_price: 300,
      },
    });
  });
});
