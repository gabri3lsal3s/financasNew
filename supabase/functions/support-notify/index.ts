import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";
import {
  buildTelegramSupportMessage,
  sendTelegramNotification,
  type SupportTicketNotificationData,
} from "../_shared/telegram.ts";

interface SupportNotifyPayload {
  ticketId?: string;
  type?: string;
  subject?: string;
  message?: string;
  current_route?: string;
  app_version?: string;
  device_info?: Record<string, unknown>;
  record?: {
    id?: string;
    user_id?: string;
    type?: string;
    status?: string;
    subject?: string | null;
    message?: string;
    user_name?: string | null;
    user_email?: string | null;
    app_version?: string | null;
    current_route?: string | null;
    device_info?: Record<string, unknown>;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método não permitido" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return safeErrorResponse(req, 500, "Configuração do servidor de banco incompleta.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const payload: SupportNotifyPayload = await req.json().catch(() => ({}));
    let notificationData: SupportTicketNotificationData;
    let resolvedTicketId: string | null = null;

    // Cenário 1: Disparo via Supabase Database Webhook (payload.record)
    if (payload.record && payload.record.message) {
      const rec = payload.record;
      resolvedTicketId = rec.id ?? null;

      let userName = rec.user_name ?? null;
      let userEmail = rec.user_email ?? null;

      if ((!userName || !userEmail) && rec.user_id) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("name, email")
          .eq("id", rec.user_id)
          .maybeSingle();

        if (profile) {
          userName = userName || profile.name;
          userEmail = userEmail || profile.email;
        }
      }

      notificationData = {
        ticketId: rec.id,
        userName,
        userEmail,
        type: rec.type || "doubt",
        subject: rec.subject,
        message: rec.message,
        currentRoute: rec.current_route,
        appVersion: rec.app_version,
        deviceInfo: rec.device_info,
      };
    } else {
      // Cenário 2: Chamada originada pelo cliente autenticado
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse(req, { error: "Sessão não informada" }, 401);
      }

      if (!anonKey) {
        return safeErrorResponse(req, 500, "Chave de autenticação pública não configurada.");
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: authError,
      } = await userClient.auth.getUser();

      if (authError || !user) {
        return jsonResponse(req, { error: "Sessão inválida ou expirada" }, 401);
      }

      // Se o cliente forneceu ticketId previamente criado
      if (payload.ticketId) {
        resolvedTicketId = payload.ticketId;
        const { data: ticket, error: ticketError } = await supabaseAdmin
          .from("support_tickets")
          .select("*")
          .eq("id", payload.ticketId)
          .single();

        if (ticketError || !ticket) {
          return jsonResponse(req, { error: "Chamado não localizado" }, 404);
        }

        // Validação estrita de IDOR: apenas o próprio titular ou admins podem despachar notificação
        if (ticket.user_id !== user.id) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (!profile || !["admin", "superadmin"].includes(profile.role)) {
            return jsonResponse(req, { error: "Acesso não autorizado ao chamado informado" }, 403);
          }
        }

        notificationData = {
          ticketId: ticket.id,
          userName: ticket.user_name || user.user_metadata?.name || user.email?.split("@")[0] || null,
          userEmail: ticket.user_email || user.email || null,
          type: ticket.type,
          subject: ticket.subject,
          message: ticket.message,
          currentRoute: ticket.current_route,
          appVersion: ticket.app_version,
          deviceInfo: ticket.device_info,
        };
      } else {
        // O cliente enviou os dados diretamente no corpo da requisição
        const messageText = (payload.message || "").trim();
        if (!messageText) {
          return jsonResponse(req, { error: "A mensagem do chamado é obrigatória" }, 400);
        }

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("name, email")
          .eq("id", user.id)
          .maybeSingle();

        const resolvedName = profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || "Cliente";
        const resolvedEmail = profile?.email || user.email || "";

        // Cria o ticket atomicamente caso ainda não tenha sido inserido
        const { data: createdTicket, error: insertError } = await supabaseAdmin
          .from("support_tickets")
          .insert({
            user_id: user.id,
            type: payload.type || "doubt",
            subject: payload.subject || null,
            message: messageText,
            user_name: resolvedName,
            user_email: resolvedEmail,
            current_route: payload.current_route || null,
            app_version: payload.app_version || null,
            device_info: payload.device_info || {},
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("[support-notify] Falha ao persistir support_ticket:", insertError);
          return safeErrorResponse(req, 500, "Falha ao registrar chamado no banco.");
        }

        resolvedTicketId = createdTicket?.id ?? null;

        notificationData = {
          ticketId: resolvedTicketId,
          userName: resolvedName,
          userEmail: resolvedEmail,
          type: payload.type || "doubt",
          subject: payload.subject || null,
          message: messageText,
          currentRoute: payload.current_route || null,
          appVersion: payload.app_version || null,
          deviceInfo: payload.device_info || null,
        };
      }
    }

    // Envio para o Bot do Telegram
    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!telegramBotToken || !telegramChatId) {
      console.warn(
        "[support-notify] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados nos secrets do Supabase. Notificação em tempo real ignorada.",
      );
      return jsonResponse(req, {
        success: true,
        ticketId: resolvedTicketId,
        delivered: false,
        warning: "telegram_secrets_missing",
      });
    }

    const messageHtml = buildTelegramSupportMessage(notificationData);
    const result = await sendTelegramNotification({
      botToken: telegramBotToken,
      chatId: telegramChatId,
      text: messageHtml,
    });

    if (!result.success) {
      console.error("[support-notify] Falha ao entregar mensagem no Telegram:", result.error);
      return jsonResponse(req, {
        success: true,
        ticketId: resolvedTicketId,
        delivered: false,
        error: result.error,
      });
    }

    return jsonResponse(req, {
      success: true,
      ticketId: resolvedTicketId,
      delivered: true,
    });
  } catch (err) {
    return safeErrorResponse(req, 500, "Erro interno ao processar notificação de suporte.", err);
  }
});
