import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CashCheckpointDialog } from "./cash-checkpoint-dialog";
import * as stateModule from "@/state";

vi.mock("@/services/haptics", () => ({
  triggerHaptic: vi.fn(),
}));

describe("CashCheckpointDialog", () => {
  it("renderiza campos e submete novo checkpoint de saldo", async () => {
    const mutateAsyncMock = vi.fn().mockResolvedValue({});
    vi.spyOn(stateModule, "useCreateCashCheckpoint").mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useCreateCashCheckpoint>);

    const onOpenChange = vi.fn();

    render(
      <CashCheckpointDialog
        open={true}
        onOpenChange={onOpenChange}
        currentBalanceCents={350000}
      />,
    );

    expect(screen.getByText("Calibrar Saldo com o Banco")).toBeInTheDocument();
    expect(screen.getByLabelText(/Saldo Real no Banco/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Salvar Saldo Real/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          balance_cents: 350000,
        }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
