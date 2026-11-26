import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsonResponse, safeErrorResponse, timingSafeEqualString } from "../_shared/http.ts";

const MAX_SVIX_AGE_SECONDS = 300;

function decodeBase64Secret(secret: string) {
  const clean = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifySvixSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): Promise<boolean> {
  const tsNum = Number(svixTimestamp);
  if (!Number.isFinite(tsNum)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > MAX_SVIX_AGE_SECONDS) return false;

  const keyBytes = decodeBase64Secret(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedContent = new TextEncoder().encode(`${svixId}.${svixTimestamp}.${rawBody}`);
  const macBuffer = await crypto.subtle.sign("HMAC", cryptoKey, signedContent);
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(macBuffer)));

  const signatures = svixSignature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const sig of signatures) {
    const [version, value] = sig.split(",");
    if (version === "v1" && value && (await timingSafeEqualString(value, expectedB64))) {
      return true;
    }
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método não permitido." }, 405);
  }

  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    return safeErrorResponse(req, 500, "Configuração do webhook Resend incompleta.");
  }

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTimestamp || !svixSignature) {
    return jsonResponse(req, { error: "Cabeçalhos Svix ausentes." }, 401);
  }

  const rawBody = await req.text();
  let isValid: boolean;
  try {
    isValid = await verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, webhookSecret);
  } catch {
    isValid = false;
  }

  if (!isValid) {
    return jsonResponse(req, { error: "Assinatura Svix inválida." }, 401);
  }

  let event: {
    type?: string;
    data?: {
      email_id?: string;
      to?: string[];
      bounce?: { message?: string; type?: string };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse(req, { error: "JSON inválido." }, 400);
  }

  const eventType = event.type ?? "";
  const providerMessageId = event.data?.email_id ?? null;

  const statusMap: Record<string, string> = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivery_delayed": "delivery_delayed",
  };

  const mappedStatus = statusMap[eventType];
  if (!mappedStatus || !providerMessageId) {
    return jsonResponse(req, { received: true, ignored: true });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { error } = await supabase
    .from("transactional_email_logs")
    .update({
      status: mappedStatus,
      metadata: {
        last_webhook_event: eventType,
        svix_id: svixId,
        bounce: event.data?.bounce ?? null,
        updated_at: new Date().toISOString(),
      },
    })
    .eq("provider_message_id", providerMessageId);

  if (error) {
    console.error("[resend-webhook] Erro ao atualizar transactional_email_logs:", error);
    return safeErrorResponse(req, 500, "Falha ao atualizar log de e-mail.");
  }

  return jsonResponse(req, { received: true, status: mappedStatus });
});
