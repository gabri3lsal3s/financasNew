import type { InternalTransferKind, PaymentMethod, ReceiveType } from "@/types";
import { callRpc, unwrapRpc } from "./client";

export interface CreateInternalTransferPairParams {
  transferKind: InternalTransferKind;
  amount: number;
  date: string;
  description?: string | null;
  expenseCategoryId?: string | null;
  incomeCategoryId?: string | null;
  paymentMethod?: Exclude<PaymentMethod, "credit_card">;
  receiveType?: ReceiveType;
  sourceRef?: string | null;
}

export interface CreateInternalTransferPairResult {
  transfer_pair_id: string;
  expense_id: string;
  income_id: string;
  transfer_kind: InternalTransferKind;
  amount: number;
}

export interface DeleteInternalTransferPairResult {
  deleted: boolean;
  transfer_pair_id: string;
}

/** Cria atomicamente o par despesa/receita de transferência interna PF/PJ (Fase 2A). */
export async function createInternalTransferPair(
  params: CreateInternalTransferPairParams,
): Promise<CreateInternalTransferPairResult> {
  return unwrapRpc(
    callRpc("create_internal_transfer_pair", {
      p_transfer_kind: params.transferKind,
      p_amount: params.amount,
      p_date: params.date,
      p_description: params.description ?? null,
      p_expense_category_id: params.expenseCategoryId ?? null,
      p_income_category_id: params.incomeCategoryId ?? null,
      p_payment_method: params.paymentMethod ?? "pix",
      p_receive_type: params.receiveType ?? "pix",
      p_source_ref: params.sourceRef ?? null,
    }),
  );
}

/** Exclui atomicamente ambas as pernas de uma transferência interna pareada. */
export async function deleteInternalTransferPair(
  transferPairId: string,
): Promise<DeleteInternalTransferPairResult> {
  return unwrapRpc(
    callRpc("delete_internal_transfer_pair", {
      p_transfer_pair_id: transferPairId,
    }),
  );
}
