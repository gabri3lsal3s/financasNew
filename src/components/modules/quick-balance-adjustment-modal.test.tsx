import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickBalanceAdjustmentModal } from "./quick-balance-adjustment-modal";
import * as stateModule from "@/state";

describe("QuickBalanceAdjustmentModal", () => {
  it("renderiza modal acolhedor Zero Culpa e sincroniza saldo com 1 clique", async () => {
    const mutateAsyncMock = vi.fn().mockResolvedValue({});
    vi.spyOn(stateModule, "useCreateCashCheckpoint").mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useCreateCashCheckpoint>);

    const onOpenChange = vi.fn();

    render(
      <QuickBalanceAdjustmentModal
        open={true}
        onOpenChange={onOpenChange}
        currentBalanceCents={250000}
      />,
    );

    expect(screen.getByText("Alinhamento de Saldo em 60s")).toBeInTheDocument();
    expect(screen.getByText(/Sem tempo para lançar tudo\? Sem problemas!/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Qual o seu saldo total nas contas hoje\?/i)).toBeInTheDocument();

    const syncButton = screen.getByRole("button", { name: /Sincronizar em 1 Clique/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          balance_cents: 250000,
          notes: "Alinhamento Rápido de Saldo (Zero Culpa)",
        }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
