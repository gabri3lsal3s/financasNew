import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { DbInsert, SupportTicket, SupportTicketStatus, SupportTicketType } from "@/types";

export interface CreateSupportTicketInput {
  type: SupportTicketType;
  subject?: string | null;
  message: string;
  user_name?: string | null;
  user_email?: string | null;
  app_version?: string | null;
  current_route?: string | null;
  device_info?: Record<string, unknown>;
}

export interface SupportTicketFilter {
  status?: SupportTicketStatus | null;
  type?: SupportTicketType | null;
}

/**
 * Cria um chamado de suporte técnico ou feedback na tabela public.support_tickets
 * e despacha a notificação assíncrona para o Telegram via Edge Function.
 */
export async function createSupportTicket(
  input: CreateSupportTicketInput,
): Promise<SupportTicket> {
  const user_id = await currentUserId();
  const payload: DbInsert<SupportTicket> = {
    user_id,
    type: input.type,
    status: "open",
    subject: input.subject ?? null,
    message: input.message.trim(),
    user_name: input.user_name ?? null,
    user_email: input.user_email ?? null,
    app_version: input.app_version ?? null,
    current_route: input.current_route ?? null,
    device_info: input.device_info ?? {},
    admin_notes: null,
  };

  const { data, error } = await resolveQuery<SupportTicket>(
    getSupabase()
      .from("support_tickets")
      .insert(payload)
      .select()
      .single(),
  );

  if (error || !data) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  // Despacho assíncrono para o Telegram (fail-open para não penalizar a experiência do usuário caso o webhook oscile)
  try {
    await getSupabase().functions.invoke("support-notify", {
      body: { ticketId: data.id },
    });
  } catch (notifyErr) {
    console.warn("[support] Notificação em segundo plano no Telegram falhou:", notifyErr);
  }

  return data;
}

/**
 * Consulta a lista de chamados de suporte para o painel administrativo.
 * Requer papel de administrador / superadmin via RLS.
 */
export async function listAdminSupportTickets(
  filter?: SupportTicketFilter,
): Promise<SupportTicket[]> {
  let query = getSupabase()
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }
  if (filter?.type) {
    query = query.eq("type", filter.type);
  }

  const { data, error } = await resolveQuery<SupportTicket[]>(query);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

/**
 * Atualiza o status operacional e as notas internas de atendimento de um chamado.
 */
export async function updateAdminSupportTicket(
  ticketId: string,
  patch: {
    status?: SupportTicketStatus;
    admin_notes?: string | null;
  },
): Promise<SupportTicket> {
  const { data, error } = await resolveQuery<SupportTicket>(
    getSupabase()
      .from("support_tickets")
      .update(patch)
      .eq("id", ticketId)
      .select()
      .single(),
  );

  if (error || !data) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data;
}

