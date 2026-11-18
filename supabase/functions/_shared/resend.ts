/**
 * Servico de Disparo de E-mails Transacionais via API Resend
 * Idempotente, seguro, com persistencia em public.transactional_email_logs
 * e comportamento fail-safe (nunca interrompe fluxos de pagamento).
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  html: string;
  text?: string;
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
  return from && from.trim().length > 0 ? from.trim() : "Axir <contato@axir.com.br>";
}

/**
 * Envia e-mail transacional com rastreamento no banco e idempotencia estrita
 */
export async function sendTransactionalEmail(
  supabaseAdmin: SupabaseClient,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const cleanTo = (options.to || "").trim().toLowerCase();
  const apiKey = getResendApiKey();
  const idempotencyKey = options.idempotencyKey || null;

  if (!cleanTo || !cleanTo.includes("@")) {
    console.warn("[resend] Destinatario invalido:", cleanTo);
    return { success: false, error: "E-mail de destino invalido." };
  }

  // 1. Verificacao de idempotencia no banco
  if (idempotencyKey) {
    try {
      const { data: existingLog } = await supabaseAdmin
        .from("transactional_email_logs")
        .select("id, status, provider_id")
        .eq("status", "sent")
        .contains("metadata", { idempotency_key: idempotencyKey })
        .maybeSingle();

      if (existingLog) {
        console.log(`[resend] E-mail com idempotency_key '${idempotencyKey}' ja enviado. Ignorando reenvio.`);
        return { success: true, skipped: true, id: existingLog.provider_id || undefined };
      }
    } catch (err: unknown) {
      console.warn("[resend] Falha ao verificar idempotencia de e-mail:", err);
    }
  }

  // 2. Se a chave do Resend nao estiver configurada, registrar log de fallback seguro
  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY ausente no ambiente. Gravando log 'skipped_missing_key'.");
    try {
      await supabaseAdmin.from("transactional_email_logs").insert({
        user_id: options.userId || null,
        recipient_email: cleanTo,
        template_name: options.template,
        subject: options.subject,
        status: "skipped_missing_key",
        metadata: {
          ...options.metadata,
          idempotency_key: idempotencyKey,
          reason: "RESEND_API_KEY not configured",
        },
      });
    } catch (dbErr: unknown) {
      console.warn("[resend] Falha ao gravar log de e-mail ausente:", dbErr);
    }
    return { success: false, skipped: true, error: "Chave Resend nao configurada." };
  }

  // 3. Execucao do disparo via API HTTP do Resend
  const fromEmail = getResendFromEmail();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [cleanTo],
        subject: options.subject,
        html: options.html,
        text: options.text || undefined,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `HTTP ${res.status}`;
      console.error("[resend] Erro retornado pela API do Resend:", errorMsg);

      await supabaseAdmin.from("transactional_email_logs").insert({
        user_id: options.userId || null,
        recipient_email: cleanTo,
        template_name: options.template,
        subject: options.subject,
        status: "failed",
        error_message: String(errorMsg),
        metadata: {
          ...options.metadata,
          idempotency_key: idempotencyKey,
        },
      });

      return { success: false, error: String(errorMsg) };
    }

    const providerId = data?.id || null;

    await supabaseAdmin.from("transactional_email_logs").insert({
      user_id: options.userId || null,
      recipient_email: cleanTo,
      template_name: options.template,
      subject: options.subject,
      status: "sent",
      provider_id: providerId,
      metadata: {
        ...options.metadata,
        idempotency_key: idempotencyKey,
      },
    });

    return { success: true, id: providerId || undefined };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[resend] Falha de conexao com API Resend:", errorMsg);

    try {
      await supabaseAdmin.from("transactional_email_logs").insert({
        user_id: options.userId || null,
        recipient_email: cleanTo,
        template_name: options.template,
        subject: options.subject,
        status: "failed",
        error_message: errorMsg,
        metadata: {
          ...options.metadata,
          idempotency_key: idempotencyKey,
        },
      });
    } catch {
      // noop
    }

    return { success: false, error: errorMsg };
  }
}
