/**
 * Serviço de Disparo de E-mails Transacionais via API Resend
 * Idempotente, seguro, com persistência em public.transactional_email_logs
 * e comportamento fail-safe (nunca interrompe fluxos de pagamento).
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { maskEmailForLog, sanitizeLogString } from "./http.ts";

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  html: string;
  text?: string;
  replyTo?: string;
  userId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

export function getResendApiKey(): string | null {
  const key = Deno.env.get("RESEND_API_KEY");
  return key && key.trim().length > 0 ? key.trim() : null;
}

export function getResendFromEmail(): string {
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  return from && from.trim().length > 0 ? from.trim() : "Axir <nao-responda@axir.com.br>";
}

export function getResendReplyToEmail(): string {
  const replyTo = Deno.env.get("RESEND_REPLY_TO_EMAIL");
  return replyTo && replyTo.trim().length > 0 ? replyTo.trim() : "suporte@axir.com.br";
}

async function upsertEmailLog(
  supabaseAdmin: SupabaseClient,
  row: {
    user_id: string | null;
    recipient_email: string;
    template_key: string;
    dedup_key: string;
    status: "sent" | "failed" | "skipped_missing_key";
    provider_message_id?: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  if (!row.user_id) {
    console.warn(
      "[resend] Ignorando persistência em transactional_email_logs sem userId (D-20):",
      row.template_key,
    );
    return;
  }
  const { error } = await supabaseAdmin
    .from("transactional_email_logs")
    .upsert(row, { onConflict: "dedup_key" });
  if (error) {
    console.warn("[resend] Falha ao persistir transactional_email_logs:", sanitizeLogString(error.message));
  }
}

/**
 * Envia e-mail transacional com rastreamento no banco e idempotência estrita.
 */
export async function sendTransactionalEmail(
  supabaseAdmin: SupabaseClient,
  options: SendEmailOptions,
): Promise<SendEmailResult> {
  const cleanTo = (options.to || "").trim().toLowerCase();
  const apiKey = getResendApiKey();
  const idempotencyKey = options.idempotencyKey?.trim() || null;

  if (!cleanTo || !cleanTo.includes("@")) {
    console.warn("[resend] Destinatário inválido:", maskEmailForLog(cleanTo));
    return { success: false, error: "E-mail de destino inválido." };
  }

  // 1. O webhook pode alterar o status após o provedor aceitar o envio.
  // Tanto a aceitação quanto os eventos de entrega bloqueiam um novo disparo.
  if (idempotencyKey) {
    try {
      const { data: existingLog } = await supabaseAdmin
        .from("transactional_email_logs")
        .select("id, status, provider_message_id")
        .eq("dedup_key", idempotencyKey)
        .in("status", ["sent", "delivered", "bounced", "complained", "delivery_delayed"])
        .maybeSingle();

      if (existingLog) {
        console.log(`[resend] E-mail com idempotency_key '${idempotencyKey}' já enviado. Ignorando reenvio.`);
        return { success: true, skipped: true, id: existingLog.provider_message_id || undefined };
      }
    } catch (err: unknown) {
      console.warn(
        "[resend] Falha ao verificar idempotência de e-mail:",
        sanitizeLogString(err instanceof Error ? err.message : String(err)),
      );
    }
  }

  const effectiveDedupKey = idempotencyKey || `${options.template}_${cleanTo}_${Date.now()}`;

  // 2. Se a chave do Resend não estiver configurada, registra fallback seguro sem bloquear futuras tentativas
  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY ausente no ambiente. Gravando log 'skipped_missing_key'.");
    try {
      await upsertEmailLog(supabaseAdmin, {
        user_id: options.userId || null,
        recipient_email: cleanTo,
        template_key: options.template,
        dedup_key: effectiveDedupKey,
        status: "skipped_missing_key",
        metadata: {
          ...options.metadata,
          subject: options.subject,
          idempotency_key: idempotencyKey,
          reason: "RESEND_API_KEY not configured",
        },
      });
    } catch (dbErr: unknown) {
      console.warn("[resend] Falha ao gravar log de e-mail ausente:", dbErr);
    }
    return { success: false, skipped: true, error: "Chave Resend não configurada." };
  }

  // 3. Execução do disparo via API HTTP do Resend com Idempotency-Key nativo
  const fromEmail = getResendFromEmail();
  const replyToEmail = options.replyTo?.trim() || getResendReplyToEmail();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": effectiveDedupKey,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [cleanTo],
        reply_to: replyToEmail,
        subject: options.subject,
        html: options.html,
        text: options.text || undefined,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `HTTP ${res.status}`;
      console.error("[resend] Erro retornado pela API do Resend:", errorMsg);

      await upsertEmailLog(supabaseAdmin, {
        user_id: options.userId || null,
        recipient_email: cleanTo,
        template_key: options.template,
        dedup_key: effectiveDedupKey,
        status: "failed",
        metadata: {
          ...options.metadata,
          subject: options.subject,
          error_message: String(errorMsg),
          idempotency_key: idempotencyKey,
        },
      });

      return { success: false, error: String(errorMsg) };
    }

    const providerId = data?.id || null;

    await upsertEmailLog(supabaseAdmin, {
      user_id: options.userId || null,
      recipient_email: cleanTo,
      template_key: options.template,
      dedup_key: effectiveDedupKey,
      status: "sent",
      provider_message_id: providerId,
      metadata: {
        ...options.metadata,
        subject: options.subject,
        idempotency_key: idempotencyKey,
      },
    });

    return { success: true, id: providerId || undefined };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[resend] Falha de conexão com API Resend:", errorMsg);

    try {
      await upsertEmailLog(supabaseAdmin, {
        user_id: options.userId || null,
        recipient_email: cleanTo,
        template_key: options.template,
        dedup_key: effectiveDedupKey,
        status: "failed",
        metadata: {
          ...options.metadata,
          subject: options.subject,
          error_message: errorMsg,
          idempotency_key: idempotencyKey,
        },
      });
    } catch {
      // noop
    }

    return { success: false, error: errorMsg };
  }
}
