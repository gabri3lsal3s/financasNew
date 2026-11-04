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
    admin_reply: null,
    admin_replied_at: null,
    user_read_at: null,
    admin_id: null,
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
 * Lista os chamados abertos pelo próprio usuário autenticado.
 */
export async function listMySupportTickets(): Promise<SupportTicket[]> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<SupportTicket[]>(
    getSupabase()
      .from("support_tickets")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

/**
 * Marca a resposta de um chamado como lida pelo usuário autenticado.
 */
export async function markTicketAsRead(ticketId: string): Promise<SupportTicket> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<SupportTicket>(
    getSupabase()
      .from("support_tickets")
      .update({ user_read_at: new Date().toISOString() })
      .eq("id", ticketId)
      .eq("user_id", user_id)
      .select()
      .single(),
  );

  if (error || !data) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data;
}

/**
 * Atualiza o status operacional, as notas internas e opcionalmente envia resposta oficial ao usuário.
 */
export async function updateAdminSupportTicket(
  ticketId: string,
  patch: {
    status?: SupportTicketStatus;
    admin_notes?: string | null;
    admin_reply?: string | null;
  },
): Promise<SupportTicket> {
  const updateData: Partial<DbInsert<SupportTicket>> = {
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.admin_notes !== undefined ? { admin_notes: patch.admin_notes } : {}),
  };
  if (patch.admin_reply !== undefined) {
    updateData.admin_reply = patch.admin_reply;
    if (patch.admin_reply && patch.admin_reply.trim()) {
      updateData.admin_replied_at = new Date().toISOString();
      // Reseta o lido caso seja uma nova resposta
      updateData.user_read_at = null;
    }
  }

  const { data, error } = await resolveQuery<SupportTicket>(
    getSupabase()
      .from("support_tickets")
      .update(updateData)
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


