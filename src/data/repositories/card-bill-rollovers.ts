import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import {
  deleteCardBillRolloverRpc,
  rolloverCardBillRpc,
  type DeleteCardBillRolloverResult,
  type RolloverCardBillParams,
  type RolloverCardBillResult,
} from "@/data/rpc/cards";
import { currentMonth, shiftMonth } from "@/lib/date";
import { AppError, classifyError } from "@/services/errors";
import type { CardBillRollover } from "@/types";

/**
 * Rolagens e parcelamentos de fatura (`card_bill_rollovers`) — integração remota.
 * Escritas exclusivas via RPCs auditadas (`rollover_card_bill`, `delete_card_bill_rollover`).
 */

/** Janela temporal padrão para consultas de rolagens de cartão (24 meses retroativos). */
export const DEFAULT_CARD_ROLLOVER_WINDOW_MONTHS = 24;

export interface CardBillRolloverQueryOptions {
  /**
   * Mês inicial (YYYY-MM) do corte temporal.
   * Se omitido (undefined), adota o padrão de 24 meses retroativos.
   * Se for null, desativa o corte temporal e executa busca irrestrita.
   */
  sinceMonth?: string | null;
}

function mapRollover(row: CardBillRollover): CardBillRollover {
  return {
    ...row,
    principal_amount: Number(row.principal_amount),
  };
}

/**
 * Fallback defensivo para ambientes em que a migration 0154 ainda não foi
 * aplicada no banco remoto: evita quebrar Home/Cartões com erro genérico.
 */
function isMissingRolloversTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; message?: unknown };
  const code = typeof err.code === "string" ? err.code : "";
  if (code === "PGRST205" || code === "42P01") return true;
  const msg = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return (
    msg.includes("card_bill_rollovers") &&
    (msg.includes("schema cache") || msg.includes("does not exist"))
  );
}

/** Rolagens e parcelamentos de um cartão (janela padrão de 24 meses ou customizada). */
export async function listCardBillRollovers(
  cardId: string,
  options?: CardBillRolloverQueryOptions,
): Promise<CardBillRollover[]> {
  let query = getSupabase()
    .from("card_bill_rollovers")
    .select("*")
    .eq("card_id", cardId);

  const resolvedSinceMonth =
    options?.sinceMonth === undefined
      ? shiftMonth(currentMonth(), -DEFAULT_CARD_ROLLOVER_WINDOW_MONTHS)
      : options.sinceMonth;

  if (resolvedSinceMonth) {
    query = query.or(
      `from_competence_month.gte.${resolvedSinceMonth},to_competence_month.gte.${resolvedSinceMonth}`,
    );
  }

  const { data, error } = await resolveQuery<CardBillRollover[]>(
    query.order("created_at", { ascending: false }),
  );
  if (error) {
    if (isMissingRolloversTableError(error)) {
      if (import.meta.env.DEV) {
        console.warn("[card_bill_rollovers] Tabela ausente no banco; aplique a migration 20260101000154.");
      }
      return [];
    }
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapRollover);
}

/** Todas as rolagens e parcelamentos de cartão do usuário (visão consolidada). */
export async function listAllCardBillRollovers(
  options?: CardBillRolloverQueryOptions,
): Promise<CardBillRollover[]> {
  let query = getSupabase().from("card_bill_rollovers").select("*");

  const resolvedSinceMonth =
    options?.sinceMonth === undefined
      ? shiftMonth(currentMonth(), -DEFAULT_CARD_ROLLOVER_WINDOW_MONTHS)
      : options.sinceMonth;

  if (resolvedSinceMonth) {
    query = query.or(
      `from_competence_month.gte.${resolvedSinceMonth},to_competence_month.gte.${resolvedSinceMonth}`,
    );
  }

  const { data, error } = await resolveQuery<CardBillRollover[]>(
    query.order("created_at", { ascending: false }),
  );
  if (error) {
    if (isMissingRolloversTableError(error)) {
      if (import.meta.env.DEV) {
        console.warn("[card_bill_rollovers] Tabela ausente no banco; aplique a migration 20260101000154.");
      }
      return [];
    }
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapRollover);
}

/** Rola o saldo em aberto de uma fatura vencida para a competência seguinte com encargos opcionais. */
export async function rolloverCardBill(
  input: RolloverCardBillParams,
): Promise<RolloverCardBillResult> {
  return rolloverCardBillRpc(input);
}

/** Desfaz atomicamente uma rolagem ou parcelamento de fatura (bloqueia se destino já pago/rolado). */
export async function deleteCardBillRollover(
  rolloverId: string,
): Promise<DeleteCardBillRolloverResult> {
  return deleteCardBillRolloverRpc(rolloverId);
}
