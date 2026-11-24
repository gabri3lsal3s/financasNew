import { describe, expect, it, vi } from "vitest";
import { createInternalTransferPair, deleteInternalTransferPair } from "./business";

const { callRpcMock, unwrapRpcMock } = vi.hoisted(() => ({
  callRpcMock: vi.fn(),
  unwrapRpcMock: vi.fn((p: Promise<unknown>) => p),
}));

vi.mock("./client", () => ({
  callRpc: callRpcMock,
  unwrapRpc: unwrapRpcMock,
}));

describe("data/rpc/business (Transferências Internas Pareadas)", () => {
  it("chama create_internal_transfer_pair com os parâmetros esperados incluindo source_ref", async () => {
    callRpcMock.mockResolvedValueOnce({
      transfer_pair_id: "pair-1",
      expense_id: "e-1",
      income_id: "i-1",
      transfer_kind: "card_reimbursement",
      amount: 450,
    });

    const result = await createInternalTransferPair({
      transferKind: "card_reimbursement",
      amount: 450,
      date: "2026-11-15",
      description: "Reembolso cartão misto",
      sourceRef: "[REIMBURSEMENT]c1:2026-11",
    });

    expect(callRpcMock).toHaveBeenCalledWith("create_internal_transfer_pair", {
      p_transfer_kind: "card_reimbursement",
      p_amount: 450,
      p_date: "2026-11-15",
      p_description: "Reembolso cartão misto",
      p_expense_category_id: null,
      p_income_category_id: null,
      p_payment_method: "pix",
      p_receive_type: "pix",
      p_source_ref: "[REIMBURSEMENT]c1:2026-11",
    });
    expect(result.transfer_pair_id).toBe("pair-1");
  });

  it("chama delete_internal_transfer_pair pelo UUID do par", async () => {
    callRpcMock.mockResolvedValueOnce({ deleted: true, transfer_pair_id: "pair-1" });

    const res = await deleteInternalTransferPair("pair-1");
    expect(callRpcMock).toHaveBeenCalledWith("delete_internal_transfer_pair", {
      p_transfer_pair_id: "pair-1",
    });
    expect(res.deleted).toBe(true);
  });
});
