import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { createCardPayment, createRefund } from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type { CardPayment } from "@/types";

/**
 * Pagamentos e estornos de fatura — integração remota.
 * Pagamento: RPC auditado (`create_card_payment`). Estorno: RPC
 * `create_refund` (gera renda automática [REFUND] — §3.3.3).
 */

function mapPayment(row: CardPayment): CardPayment {
  return { ...row, amount: Number(row.amount) };
}

/** Pagamentos e estornos de um cartão (todas as competências, data desc). */
export async function listCardPayments(cardId: string): Promise<CardPayment[]> {
  const { data, error } = await resolveQuery<CardPayment[]>(
    getSupabase().from("card_payments").select("*").eq("card_id", cardId).order("date", { ascending: false }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapPayment);
}

/** Pagamento de fatura — RPC auditado (D2). Retorna o id do pagamento. */
export async function createPayment(input: {
  cardId: string;
  competenceMonth: string;
  amount: number;
  date: string;
  note?: string | null;
}): Promise<string> {
  return createCardPayment({
    cardId: input.cardId,
    competenceMonth: input.competenceMonth,
    amount: input.amount,
    date: input.date,
    note: input.note,
  });
}

/** Estorno — RPC `create_refund`: cria renda automática somente-leitura. */
export async function createRefundPayment(input: {
  cardId: string;
  competenceMonth: string;
  amount: number;
  date: string;
  note?: string | null;
}): Promise<string> {
  return createRefund({
    cardId: input.cardId,
    competenceMonth: input.competenceMonth,
    amount: input.amount,
    date: input.date,
    note: input.note,
  });
}
