import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { createCardPayment, createRefund, deleteCardPaymentRpc } from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import { currentMonth, shiftMonth } from "@/lib/date";
import type { CardPayment } from "@/types";

/**
 * Pagamentos e estornos de fatura — integração remota.
 * Pagamento: RPC auditado (`create_card_payment`). Estorno: RPC
 * `create_refund` (gera renda automática [REFUND] — §3.3.3).
 */

/** Janela temporal padrão para consultas de pagamentos de cartão (24 meses retroativos). */
export const DEFAULT_CARD_PAYMENT_WINDOW_MONTHS = 24;

export interface CardPaymentQueryOptions {
  /**
   * Mês inicial (YYYY-MM) do corte temporal.
   * Se omitido (undefined), adota o padrão de 24 meses retroativos.
   * Se for null, desativa o corte temporal e executa a busca irrestrita em todo o histórico.
   */
  sinceMonth?: string | null;
}

function mapPayment(row: CardPayment): CardPayment {
  return { ...row, amount: Number(row.amount) };
}

/** Pagamentos e estornos de um cartão (derivação de fatura com janela padrão de 24 meses ou customizada, data desc). */
export async function listCardPayments(cardId: string, options?: CardPaymentQueryOptions): Promise<CardPayment[]> {
  let query = getSupabase().from("card_payments").select("*").eq("card_id", cardId);

  const resolvedSinceMonth =
    options?.sinceMonth === undefined
      ? shiftMonth(currentMonth(), -DEFAULT_CARD_PAYMENT_WINDOW_MONTHS)
      : options.sinceMonth;

  if (resolvedSinceMonth) {
    query = query.gte("competence_month", resolvedSinceMonth);
  }

  const { data, error } = await resolveQuery<CardPayment[]>(
    query.order("date", { ascending: false }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapPayment);
}

/** Todos os pagamentos/estornos de cartão do usuário (visão consolidada com janela padrão de 24 meses ou customizada). */
export async function listAllCardPayments(options?: CardPaymentQueryOptions): Promise<CardPayment[]> {
  let query = getSupabase().from("card_payments").select("*");

  const resolvedSinceMonth =
    options?.sinceMonth === undefined
      ? shiftMonth(currentMonth(), -DEFAULT_CARD_PAYMENT_WINDOW_MONTHS)
      : options.sinceMonth;

  if (resolvedSinceMonth) {
    query = query.gte("competence_month", resolvedSinceMonth);
  }

  const { data, error } = await resolveQuery<CardPayment[]>(
    query.order("date", { ascending: false }),
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

/**
 * Exclui um pagamento de fatura ou estorno — RPC transacional
 * `delete_card_payment` (migração 0011): remove o pagamento e a renda
 * automática [REFUND] associada num único passo atômico no servidor.
 */
export async function deleteCardPayment(paymentId: string): Promise<void> {
  await deleteCardPaymentRpc(paymentId);
}
