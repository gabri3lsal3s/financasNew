import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playSound } from "@/services/audio-fx";
import { triggerHaptic } from "@/services/haptics";
import { AssetFormDialog } from "./asset-form-dialog";

const createAssetMock = vi.fn();
const updateAssetMock = vi.fn();
const deleteAssetMock = vi.fn();

vi.mock("@/services/haptics", () => ({ triggerHaptic: vi.fn() }));
vi.mock("@/services/audio-fx", () => ({ playSound: vi.fn() }));

vi.mock("@/state", () => ({
  useCreatePortfolioAsset: () => ({ mutateAsync: createAssetMock, isPending: false }),
  useUpdatePortfolioAsset: () => ({ mutateAsync: updateAssetMock, isPending: false }),
  useDeletePortfolioAsset: () => ({ mutateAsync: deleteAssetMock, isPending: false }),
}));

const existingAsset = {
  id: "a1",
  user_id: "u1",
  ticker: "PETR4",
  asset_class: "Ações",
  currency: "BRL" as const,
};

describe("AssetFormDialog — feedback de escrita (F15)", () => {
  beforeEach(() => {
    createAssetMock.mockReset();
    updateAssetMock.mockReset();
    deleteAssetMock.mockReset();
    vi.mocked(triggerHaptic).mockClear();
    vi.mocked(playSound).mockClear();
  });

  it("dispara haptic success e áudio de confirmação ao adicionar um ativo", async () => {
    createAssetMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AssetFormDialog open={true} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Ticker do ativo"), "petr4");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(createAssetMock).toHaveBeenCalledTimes(1);
    // O ticker é normalizado para maiúsculas antes do envio.
    expect(createAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: "PETR4" }),
    );
    expect(triggerHaptic).toHaveBeenCalledWith("success");
    expect(playSound).toHaveBeenCalledWith("success", expect.any(Boolean));
  });

  it("não dispara feedback sem ticker preenchido", async () => {
    const user = userEvent.setup();
    render(<AssetFormDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(createAssetMock).not.toHaveBeenCalled();
    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(playSound).not.toHaveBeenCalled();
  });

  it("modo edição: salva via update com os dados do ativo (CRUD completo)", async () => {
    updateAssetMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AssetFormDialog open={true} onOpenChange={vi.fn()} asset={existingAsset} />);

    // O formulário inicia preenchido com os dados do ativo em edição.
    expect(screen.getByLabelText("Ticker do ativo")).toHaveValue("PETR4");
    await user.clear(screen.getByLabelText("Ticker do ativo"));
    await user.type(screen.getByLabelText("Ticker do ativo"), "petr3");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(updateAssetMock).toHaveBeenCalledTimes(1);
    expect(updateAssetMock).toHaveBeenCalledWith({
      id: "a1",
      patch: expect.objectContaining({ ticker: "PETR3" }),
    });
    expect(createAssetMock).not.toHaveBeenCalled();
  });

  it("modo edição: exclui o ativo com confirmação (cascata de transações/metas)", async () => {
    deleteAssetMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AssetFormDialog open={true} onOpenChange={vi.fn()} asset={existingAsset} />);

    await user.click(screen.getByRole("button", { name: "Excluir ativo" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(deleteAssetMock).toHaveBeenCalledTimes(1);
    expect(deleteAssetMock).toHaveBeenCalledWith("a1");
  });
});
